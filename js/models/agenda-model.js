const eventTypes = new Set(["appointment", "block"]);
const appointmentStatuses = new Set(["scheduled", "confirmed", "completed", "cancelled", "no-show"]);
const modalities = new Set(["in-person", "online", "home", "other"]);

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

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function normalizeAgendaEvent(input, professionalId, existing = {}) {
  const type = eventTypes.has(input.type) ? input.type : "appointment";
  const date = cleanText(input.date);
  const startTime = cleanText(input.startTime);
  const durationMinutes = Math.round(Number(input.durationMinutes));

  if (!professionalId) throw new Error("Profissional não identificado.");
  if (!validDate(date)) throw new Error("Informe uma data válida.");
  if (!validTime(startTime)) throw new Error("Informe um horário válido.");
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 720) {
    throw new Error("A duração deve estar entre 15 minutos e 12 horas.");
  }

  const startsAtDate = new Date(`${date}T${startTime}:00`);
  if (Number.isNaN(startsAtDate.getTime())) throw new Error("Data ou horário inválido.");

  const patientId = type === "appointment" ? cleanText(input.patientId) || null : null;
  const patientName = patientId ? cleanText(input.patientName) : "";
  const guestName = type === "appointment" && !patientId ? cleanText(input.guestName) : "";
  if (type === "appointment" && !patientId && !guestName) {
    throw new Error("Selecione um paciente ou informe o nome da pessoa.");
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
  const color = /^#[0-9a-f]{6}$/i.test(cleanText(input.color))
    ? cleanText(input.color).toLowerCase()
    : type === "block" ? "#657076" : "#25636f";

  return {
    professionalId,
    createdBy: existing.createdBy || professionalId,
    type,
    title,
    date,
    startTime,
    durationMinutes,
    startsAt: startsAtDate.toISOString(),
    endsAt: addMinutes(startsAtDate, durationMinutes).toISOString(),
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
    privateNotes: cleanText(input.privateNotes),
    visibility: "private",
    confirmationStatus: existing.confirmationStatus || "not_requested",
    recurrence: existing.recurrence || { frequency: "none" },
    reminderMinutes: existing.reminderMinutes ?? null
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

