import test from "node:test";
import assert from "node:assert/strict";

import {
  agendaEventPerson,
  agendaPeriodLabel,
  agendaViewDays,
  cancellationBlockInput,
  eventConflicts,
  eventIsWithinAvailability,
  expandRecurringEvents,
  filterAgendaEvents,
  moveAgendaAnchor,
  normalizeAvailability,
  normalizeAgendaEvent,
  startOfWeek
} from "../js/models/agenda-model.js";

test("normaliza compromisso com paciente e horário absoluto", () => {
  const event = normalizeAgendaEvent({
    type: "appointment",
    title: "Avaliação",
    date: "2026-07-27",
    startTime: "09:30",
    durationMinutes: 60,
    patientId: "patient-1",
    patientName: "Paciente Teste",
    modality: "in-person",
    location: "Consultório",
    status: "confirmed",
    color: "#25636f"
  }, "professional-1");

  assert.equal(event.professionalId, "professional-1");
  assert.equal(event.patientId, "patient-1");
  assert.deepEqual(event.participants, ["professional-1", "patient-1"]);
  assert.equal(event.status, "confirmed");
  assert.equal(new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime(), 60 * 60 * 1000);
});

test("permite pessoa avulsa e exige sua identificação", () => {
  const event = normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "10:00",
    durationMinutes: 45,
    guestName: "Pessoa avulsa",
    modality: "online"
  }, "professional-1");

  assert.equal(agendaEventPerson(event), "Pessoa avulsa");
  assert.equal(event.patientId, null);
  assert.throws(() => normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "10:00",
    durationMinutes: 45
  }, "professional-1"), /Selecione um paciente/);
});

test("bloqueio remove dados de paciente e usa estado próprio", () => {
  const event = normalizeAgendaEvent({
    type: "block",
    title: "Almoço",
    date: "2026-07-27",
    startTime: "12:00",
    endTime: "13:00",
    patientId: "patient-1",
    patientName: "Paciente Teste"
  }, "professional-1");

  assert.equal(event.status, "blocked");
  assert.equal(event.patientId, null);
  assert.equal(event.modality, "");
  assert.deepEqual(event.participants, ["professional-1"]);
});

test("compromisso é exclusivo por padrão e coletivo aceita capacidade", () => {
  const exclusive = normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "10:00",
    durationMinutes: 60,
    guestName: "Paciente"
  }, "professional-1");
  const group = normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "11:00",
    durationMinutes: 60,
    guestName: "Turma",
    bookingMode: "group",
    capacity: 12
  }, "professional-1");

  assert.equal(exclusive.bookingMode, "exclusive");
  assert.equal(exclusive.blocksAvailability, true);
  assert.equal(group.capacity, 12);
});

test("cancelamento preserva o compromisso e registra seu motivo", () => {
  const existing = normalizeAgendaEvent({
    type: "appointment",
    title: "Avaliação",
    date: "2026-07-24",
    startTime: "10:00",
    durationMinutes: 60,
    patientId: "patient-1",
    patientName: "Paciente",
    status: "confirmed"
  }, "professional-1");
  const cancelled = normalizeAgendaEvent({
    ...existing,
    status: "cancelled",
    cancellationReason: "Imprevisto profissional"
  }, "professional-1", { id: "event-1", ...existing });

  assert.equal(cancelled.type, "appointment");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.cancellationReason, "Imprevisto profissional");
  assert.equal(cancelled.blocksAvailability, true);

  const reopened = normalizeAgendaEvent({
    ...cancelled,
    status: "scheduled"
  }, "professional-1", { id: "event-1", ...cancelled });
  assert.equal(reopened.status, "scheduled");
  assert.equal(reopened.cancellationReason, "Imprevisto profissional");
});

test("cancelamento permite não bloquear, manter o período ou definir outro", () => {
  const appointment = {
    id: "event-1",
    type: "appointment",
    date: "2026-07-24",
    startTime: "08:00",
    endTime: "09:00"
  };
  assert.equal(cancellationBlockInput(appointment, { blockMode: "none" }), null);

  const current = cancellationBlockInput(appointment, { blockMode: "current" });
  assert.equal(current.date, "2026-07-24");
  assert.equal(current.startTime, "08:00");
  assert.equal(current.endTime, "09:00");

  const custom = cancellationBlockInput(appointment, {
    blockMode: "custom",
    blockDetails: {
      date: "2026-07-25",
      startTime: "08:00",
      endTime: "13:00"
    }
  });
  assert.equal(custom.date, "2026-07-25");
  assert.equal(custom.endTime, "13:00");
  assert.equal(custom.relatedEventId, "event-1");
});

test("bloqueio aceita dia inteiro e recorrência semanal", () => {
  const event = normalizeAgendaEvent({
    type: "block",
    date: "2026-07-26",
    allDay: true,
    recurrence: {
      frequency: "weekly",
      weekDays: [0, 1],
      untilDate: "2026-08-10"
    }
  }, "professional-1");
  const occurrences = expandRecurringEvents(
    [{ id: "block-1", ...event }],
    ["2026-07-26", "2026-07-27", "2026-08-02", "2026-08-03"]
  );

  assert.equal(event.durationMinutes, 1440);
  assert.equal(occurrences.length, 4);
  assert.ok(occurrences.every((item) => item.sourceEventId === "block-1"));
});

test("normaliza vários períodos por dia e valida sobreposição", () => {
  const availability = normalizeAvailability({
    slotIntervalMinutes: 30,
    weekly: {
      monday: [
        { startTime: "06:00", endTime: "10:00" },
        { startTime: "18:00", endTime: "22:00" }
      ]
    }
  }, "professional-1");

  assert.equal(availability.weekly.monday.length, 2);
  assert.throws(() => normalizeAvailability({
    weekly: {
      monday: [
        { startTime: "08:00", endTime: "12:00" },
        { startTime: "11:00", endTime: "13:00" }
      ]
    }
  }, "professional-1"), /sobrepostos/);
});

test("detecta conflito e compromisso fora da disponibilidade", () => {
  const base = normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "09:00",
    durationMinutes: 60,
    guestName: "Paciente 1"
  }, "professional-1");
  const candidate = normalizeAgendaEvent({
    type: "appointment",
    date: "2026-07-27",
    startTime: "09:30",
    durationMinutes: 60,
    guestName: "Paciente 2"
  }, "professional-1");
  const availability = normalizeAvailability({
    weekly: { monday: [{ startTime: "08:00", endTime: "10:00" }] }
  }, "professional-1");

  assert.equal(eventConflicts(candidate, [{ id: "base", ...base }]).length, 1);
  assert.equal(eventIsWithinAvailability(candidate, availability), false);
});

test("gera períodos de dia, semana e mês", () => {
  assert.equal(startOfWeek("2026-07-29"), "2026-07-27");
  assert.deepEqual(agendaViewDays("2026-07-29", "week"), [
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31",
    "2026-08-01",
    "2026-08-02"
  ]);
  assert.equal(agendaViewDays("2026-07-29", "month").length, 42);
  assert.equal(moveAgendaAnchor("2026-07-29", "week", 1), "2026-08-05");
  assert.match(agendaPeriodLabel("2026-07-29", "month"), /julho de 2026/i);
});

test("filtra por estado, paciente e local", () => {
  const events = [
    { status: "confirmed", patientId: "p1", location: "Sala 1" },
    { status: "scheduled", patientId: null, location: "On-line" }
  ];

  assert.equal(filterAgendaEvents(events, { status: "confirmed" }).length, 1);
  assert.equal(filterAgendaEvents(events, { patient: "__guest" }).length, 1);
  assert.equal(filterAgendaEvents(events, { patient: "p1", location: "Sala 1" }).length, 1);
});
