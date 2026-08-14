const eventTypes = new Set(["appointment", "block"]);
const appointmentStatuses = new Set(["scheduled", "confirmed", "completed", "cancelled", "no-show"]);
const modalities = new Set(["in-person", "online", "home", "other"]);
const bookingModes = new Set(["exclusive", "group", "informational"]);
const recurrenceFrequencies = new Set(["none", "weekly"]);

const statusColors = {
  scheduled: "#b66a16",
  confirmed: "#2f7d68",
  completed: "#3d6f9e",
  cancelled: "#7a8280",
  "no-show": "#b64d4d",
  blocked: "#596166"
};

export function agendaStatusColor(status) {
  return statusColors[status] || statusColors.scheduled;
}

export const weekDays = [
  { key: "monday", label: "Segunda-feira", index: 1 },
  { key: "tuesday", label: "Terça-feira", index: 2 },
  { key: "wednesday", label: "Quarta-feira", index: 3 },
  { key: "thursday", label: "Quinta-feira", index: 4 },
  { key: "friday", label: "Sexta-feira", index: 5 },
  { key: "saturday", label: "Sábado", index: 6 },
  { key: "sunday", label: "Domingo", index: 0 }
];

function localISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`);
}

function cleanText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))
    && !Number.isNaN(parseDate(value).getTime());
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function minutesFromTime(value) {
  if (!validTime(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function timeFromMinutes(value) {
  const minutes = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function normalizeRecurrence(input, date, type) {
  const source = input.recurrence || {};
  const frequency = recurrenceFrequencies.has(source.frequency) ? source.frequency : "none";
  if (frequency === "none") {
    return { frequency, weekDays: [], untilDate: null, excludedDates: [] };
  }

  const dateDay = parseDate(date).getDay();
  const days = Array.isArray(source.weekDays)
    ? source.weekDays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const weekDayValues = [...new Set(days.length ? days : [dateDay])];
  const untilDate = validDate(source.untilDate) && source.untilDate >= date
    ? source.untilDate
    : addCalendarMonths(date, 3);
  const excludedDates = Array.isArray(source.excludedDates)
    ? [...new Set(source.excludedDates.filter((item) =>
      validDate(item) && item >= date && item <= untilDate
    ))].sort()
    : [];
  return { frequency, weekDays: weekDayValues, untilDate, excludedDates };
}

function resolveTiming(input, type) {
  const allDay = type === "block" && input.allDay === true;
  if (allDay) {
    return { startTime: "00:00", endTime: "00:00", durationMinutes: 1440, allDay: true };
  }

  const startTime = cleanText(input.startTime);
  if (!validTime(startTime)) throw new Error("Informe um horário inicial válido.");

  if (type === "block") {
    const endTime = cleanText(input.endTime);
    const startMinutes = minutesFromTime(startTime);
    const endMinutes = minutesFromTime(endTime);
    if (endMinutes === null || endMinutes <= startMinutes) {
      throw new Error("O horário final deve ser posterior ao horário inicial.");
    }
    return {
      startTime,
      endTime,
      durationMinutes: endMinutes - startMinutes,
      allDay: false
    };
  }

  const durationMinutes = Math.round(Number(input.durationMinutes));
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
    throw new Error("A duração deve estar entre 15 minutos e 12 horas.");
  }
  return {
    startTime,
    endTime: timeFromMinutes(minutesFromTime(startTime) + durationMinutes),
    durationMinutes,
    allDay: false
  };
}

export function normalizeAgendaEvent(input, professionalId, existing = {}) {
  const type = eventTypes.has(input.type) ? input.type : "appointment";
  const date = cleanText(input.date);
  if (!professionalId) throw new Error("Profissional não identificado.");
  if (!validDate(date)) throw new Error("Informe uma data válida.");

  const timing = resolveTiming(input, type);
  const startsAtDate = new Date(`${date}T${timing.startTime}:00`);
  if (Number.isNaN(startsAtDate.getTime())) throw new Error("Data ou horário inválido.");

  const patientId = type === "appointment" ? cleanText(input.patientId) || null : null;
  const patientName = patientId ? cleanText(input.patientName) : "";
  const guestName = type === "appointment" && !patientId ? cleanText(input.guestName) : "";
  if (type === "appointment" && !patientId && !guestName) {
    throw new Error("Selecione um acompanhamento ou informe o nome da pessoa.");
  }

  const status = type === "block"
    ? "blocked"
    : appointmentStatuses.has(input.status) ? input.status : "scheduled";
  const modality = type === "appointment" && modalities.has(input.modality)
    ? input.modality
    : type === "appointment" ? "in-person" : "";
  const title = type === "block"
    ? cleanText(input.title, "Indisponível") || "Indisponível"
    : cleanText(input.title, "Atendimento") || "Atendimento";
  const appointmentType = type === "appointment"
    ? cleanText(input.appointmentType, existing.appointmentType) || "__custom"
    : "";
  const color = agendaStatusColor(status);
  const bookingMode = type === "appointment" && bookingModes.has(input.bookingMode)
    ? input.bookingMode
    : type === "appointment" ? "exclusive" : "exclusive";
  const capacity = type === "appointment" && bookingMode === "group"
    ? Math.max(2, Math.min(100, Math.round(Number(input.capacity) || 2)))
    : 1;

  return {
    professionalId,
    createdBy: existing.createdBy || professionalId,
    type,
    title,
    appointmentType,
    date,
    startTime: timing.startTime,
    endTime: timing.endTime,
    durationMinutes: timing.durationMinutes,
    allDay: timing.allDay,
    startsAt: startsAtDate.toISOString(),
    endsAt: addMinutes(startsAtDate, timing.durationMinutes).toISOString(),
    timeZone: cleanText(input.timeZone)
      || Intl.DateTimeFormat().resolvedOptions().timeZone
      || "America/Cuiaba",
    patientId,
    patientName,
    guestName,
    participants: patientId ? [professionalId, patientId] : [professionalId],
    modality,
    location: type === "appointment" ? cleanText(input.location) : "",
    status,
    color,
    bookingMode,
    capacity,
    blocksAvailability: type === "block" || bookingMode !== "informational",
    privateNotes: cleanText(input.privateNotes),
    cancellationReason: cleanText(input.cancellationReason, existing.cancellationReason),
    relatedEventId: cleanText(input.relatedEventId, existing.relatedEventId) || null,
    seriesId: cleanText(input.seriesId, existing.seriesId) || null,
    occurrenceDate: validDate(input.occurrenceDate)
      ? input.occurrenceDate
      : validDate(existing.occurrenceDate) ? existing.occurrenceDate : null,
    visibility: "private",
    confirmationStatus: existing.confirmationStatus || "not_requested",
    recurrence: normalizeRecurrence(input, date, type),
    reminderMinutes: existing.reminderMinutes ?? null
  };
}

export function cancellationBlockInput(
  appointment,
  { blockMode = "current", blockDetails = {}, reason = "" } = {}
) {
  if (!appointment?.id || appointment.type !== "appointment") {
    throw new Error("Compromisso não identificado.");
  }
  if (blockMode === "none") return null;

  const custom = blockMode === "custom";
  const allDay = custom && blockDetails.allDay === true;
  return {
    type: "block",
    title: "Indisponível após cancelamento",
    date: custom ? blockDetails.date : appointment.date,
    startTime: allDay ? "00:00" : custom ? blockDetails.startTime : appointment.startTime,
    endTime: allDay ? "00:00" : custom ? blockDetails.endTime : appointment.endTime,
    allDay,
    color: "#657076",
    recurrence: { frequency: "none", weekDays: [], untilDate: null },
    privateNotes: reason
      ? `Horário bloqueado após cancelamento. Motivo: ${reason}`
      : "Horário bloqueado após cancelamento.",
    relatedEventId: appointment.id
  };
}

export function normalizeAvailability(input, professionalId) {
  if (!professionalId) throw new Error("Profissional não identificado.");
  const weekly = {};

  weekDays.forEach(({ key }) => {
    const intervals = Array.isArray(input.weekly?.[key]) ? input.weekly[key] : [];
    weekly[key] = intervals.map((interval) => {
      const startTime = cleanText(interval.startTime);
      const endTime = cleanText(interval.endTime);
      const start = minutesFromTime(startTime);
      const end = minutesFromTime(endTime);
      if (start === null || end === null || end <= start) {
        throw new Error(`Revise os horários de ${weekDays.find((day) => day.key === key).label}.`);
      }
      return { startTime, endTime };
    }).sort((a, b) => a.startTime.localeCompare(b.startTime));

    weekly[key].forEach((interval, index) => {
      const previous = weekly[key][index - 1];
      if (previous && previous.endTime > interval.startTime) {
        throw new Error(`Existem horários sobrepostos em ${weekDays.find((day) => day.key === key).label}.`);
      }
    });
  });

  return {
    professionalId,
    timeZone: cleanText(input.timeZone)
      || Intl.DateTimeFormat().resolvedOptions().timeZone
      || "America/Cuiaba",
    slotIntervalMinutes: [15, 30, 45, 60].includes(Number(input.slotIntervalMinutes))
      ? Number(input.slotIntervalMinutes)
      : 30,
    weekly
  };
}

export function agendaEventPerson(event) {
  return event.patientName || event.guestName || "";
}

export function startOfWeek(dateISO) {
  const date = parseDate(dateISO);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return localISODate(date);
}

export function addCalendarDays(dateISO, days) {
  const date = parseDate(dateISO);
  date.setDate(date.getDate() + days);
  return localISODate(date);
}

export function addCalendarMonths(dateISO, months) {
  const date = parseDate(dateISO);
  const originalDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(originalDay, lastDay));
  return localISODate(date);
}

export function agendaViewDays(anchorISO, view) {
  if (view === "day") return [anchorISO];
  if (view === "week") {
    const first = startOfWeek(anchorISO);
    return Array.from({ length: 7 }, (_, index) => addCalendarDays(first, index));
  }

  const anchor = parseDate(anchorISO);
  const firstOfMonth = localISODate(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  const first = startOfWeek(firstOfMonth);
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(first, index));
}

export function moveAgendaAnchor(anchorISO, view, direction) {
  if (view === "day") return addCalendarDays(anchorISO, direction);
  if (view === "week") return addCalendarDays(anchorISO, direction * 7);
  return addCalendarMonths(anchorISO, direction);
}

export function agendaPeriodLabel(anchorISO, view, locale = "pt-BR") {
  const date = parseDate(anchorISO);
  if (view === "day") {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  }
  if (view === "week") {
    const days = agendaViewDays(anchorISO, view);
    const first = parseDate(days[0]);
    const last = parseDate(days[6]);
    const firstLabel = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(first);
    const lastLabel = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", year: "numeric" }).format(last);
    return `${firstLabel} a ${lastLabel}`;
  }
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(date);
}

export function filterAgendaEvents(events, filters = {}) {
  return (events || []).filter((event) => {
    if (filters.status && event.status !== filters.status) return false;
    if (filters.patient === "__guest" && event.patientId) return false;
    if (filters.patient && filters.patient !== "__guest" && event.patientId !== filters.patient) return false;
    if (filters.location && event.location !== filters.location) return false;
    return true;
  });
}

export function expandRecurringEvents(events, visibleDates) {
  const dates = Array.isArray(visibleDates) ? visibleDates : [];
  return (events || []).flatMap((event) => {
    if (event.recurrence?.frequency !== "weekly") return [event];
    const untilDate = event.recurrence.untilDate || event.date;
    const weekDaySet = new Set(event.recurrence.weekDays || []);
    const excludedDates = new Set(event.recurrence.excludedDates || []);
    const occurrences = dates
      .filter((date) =>
        date >= event.date
        && date <= untilDate
        && !excludedDates.has(date)
        && weekDaySet.has(parseDate(date).getDay())
      )
      .map((date) => ({
        ...event,
        id: `${event.id}__${date}`,
        sourceEventId: event.id,
        date,
        startsAt: new Date(`${date}T${event.startTime}:00`).toISOString(),
        endsAt: addMinutes(new Date(`${date}T${event.startTime}:00`), event.durationMinutes).toISOString()
      }));
    return occurrences;
  });
}

export function eventConflicts(candidate, events) {
  if (!candidate.blocksAvailability) return [];
  const candidateStart = new Date(candidate.startsAt).getTime();
  const candidateEnd = new Date(candidate.endsAt).getTime();
  return (events || []).filter((event) => {
    const sourceId = event.sourceEventId || event.id;
    const candidateId = candidate.sourceEventId || candidate.id;
    if (candidateId && sourceId === candidateId) return false;
    if (!event.blocksAvailability || ["cancelled", "no-show"].includes(event.status)) return false;
    const start = new Date(event.startsAt).getTime();
    const end = new Date(event.endsAt).getTime();
    return candidateStart < end && candidateEnd > start;
  });
}

export function eventIsWithinAvailability(event, availability) {
  const weekly = availability?.weekly;
  if (!weekly || event.type === "block" || event.bookingMode === "informational") return true;
  const day = weekDays.find((item) => item.index === parseDate(event.date).getDay());
  const intervals = weekly[day?.key] || [];
  if (!intervals.length) return false;
  const start = minutesFromTime(event.startTime);
  const end = start + event.durationMinutes;
  return intervals.some((interval) =>
    start >= minutesFromTime(interval.startTime)
    && end <= minutesFromTime(interval.endTime)
  );
}
