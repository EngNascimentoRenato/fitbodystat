import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "./firebase-core.js";
import {
  addCalendarDays,
  cancellationBlockInput,
  normalizeAgendaEvent,
  normalizeAvailability
} from "../models/agenda-model.js";

function agendaCollection(professionalId) {
  return collection(db, "professionalAgendas", professionalId, "events");
}

function withoutMetadata(data = {}) {
  const { createdAt, updatedAt, ...content } = data;
  return content;
}

export async function listAgendaEvents(professionalId) {
  const snapshot = await getDocs(agendaCollection(professionalId));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...withoutMetadata(item.data()) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function saveAgendaEvent(professionalId, input, existing = null) {
  const event = normalizeAgendaEvent(input, professionalId, existing || {});
  const metadata = { updatedAt: serverTimestamp() };

  if (existing?.id) {
    await setDoc(
      doc(db, "professionalAgendas", professionalId, "events", existing.id),
      { ...event, ...metadata },
      { merge: true }
    );
    return { id: existing.id, ...event };
  }

  const reference = await addDoc(agendaCollection(professionalId), {
    ...event,
    ...metadata,
    createdAt: serverTimestamp()
  });
  return { id: reference.id, ...event };
}

export async function saveAgendaOccurrence(professionalId, source, occurrenceDate, input) {
  if (!source?.id || source.recurrence?.frequency !== "weekly") {
    throw new Error("Série recorrente não identificada.");
  }
  const excludedDates = [...new Set([
    ...(source.recurrence.excludedDates || []),
    occurrenceDate
  ])].sort();
  const updatedSource = normalizeAgendaEvent({
    ...source,
    recurrence: { ...source.recurrence, excludedDates }
  }, professionalId, source);
  const occurrence = normalizeAgendaEvent({
    ...input,
    date: occurrenceDate,
    recurrence: { frequency: "none", weekDays: [], untilDate: null, excludedDates: [] },
    seriesId: source.id,
    occurrenceDate
  }, professionalId);
  const occurrenceReference = doc(agendaCollection(professionalId));
  const batch = writeBatch(db);
  batch.set(
    doc(db, "professionalAgendas", professionalId, "events", source.id),
    { ...updatedSource, updatedAt: serverTimestamp() },
    { merge: true }
  );
  batch.set(occurrenceReference, {
    ...occurrence,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  return {
    source: { id: source.id, ...updatedSource },
    occurrence: { id: occurrenceReference.id, ...occurrence }
  };
}

export async function splitAgendaSeries(professionalId, source, occurrenceDate, input) {
  if (!source?.id || source.recurrence?.frequency !== "weekly") {
    throw new Error("Série recorrente não identificada.");
  }
  const previousDate = addCalendarDays(occurrenceDate, -1);
  if (previousDate < source.date) {
    const updatedSource = normalizeAgendaEvent({
      ...input,
      date: source.date,
      recurrence: {
        ...source.recurrence,
        ...input.recurrence,
        frequency: "weekly",
        untilDate: source.recurrence.untilDate
      },
      seriesId: source.seriesId
    }, professionalId, source);
    await setDoc(
      doc(db, "professionalAgendas", professionalId, "events", source.id),
      { ...updatedSource, updatedAt: serverTimestamp() },
      { merge: true }
    );
    return {
      source: { id: source.id, ...updatedSource },
      nextSeries: null
    };
  }
  const originalUntilDate = source.recurrence.untilDate;
  const updatedSource = normalizeAgendaEvent({
    ...source,
    recurrence: { ...source.recurrence, untilDate: previousDate }
  }, professionalId, source);
  const nextSeries = normalizeAgendaEvent({
    ...input,
    date: occurrenceDate,
    recurrence: {
      ...input.recurrence,
      frequency: "weekly",
      untilDate: originalUntilDate,
      excludedDates: (source.recurrence.excludedDates || [])
        .filter((date) => date >= occurrenceDate)
    },
    seriesId: source.id
  }, professionalId);
  const nextReference = doc(agendaCollection(professionalId));
  const batch = writeBatch(db);
  batch.set(
    doc(db, "professionalAgendas", professionalId, "events", source.id),
    { ...updatedSource, updatedAt: serverTimestamp() },
    { merge: true }
  );
  batch.set(nextReference, {
    ...nextSeries,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  return {
    source: { id: source.id, ...updatedSource },
    nextSeries: { id: nextReference.id, ...nextSeries }
  };
}

export async function excludeAgendaOccurrence(professionalId, source, occurrenceDate) {
  if (!source?.id || source.recurrence?.frequency !== "weekly") {
    throw new Error("Série recorrente não identificada.");
  }
  const event = normalizeAgendaEvent({
    ...source,
    recurrence: {
      ...source.recurrence,
      excludedDates: [...new Set([
        ...(source.recurrence.excludedDates || []),
        occurrenceDate
      ])].sort()
    }
  }, professionalId, source);
  await setDoc(
    doc(db, "professionalAgendas", professionalId, "events", source.id),
    { ...event, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return { id: source.id, ...event };
}

export async function truncateAgendaSeries(professionalId, source, occurrenceDate) {
  if (!source?.id || source.recurrence?.frequency !== "weekly") {
    throw new Error("Série recorrente não identificada.");
  }
  const untilDate = addCalendarDays(occurrenceDate, -1);
  if (untilDate < source.date) {
    await deleteAgendaEvent(professionalId, source.id);
    return null;
  }
  const event = normalizeAgendaEvent({
    ...source,
    recurrence: { ...source.recurrence, untilDate }
  }, professionalId, source);
  await setDoc(
    doc(db, "professionalAgendas", professionalId, "events", source.id),
    { ...event, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return { id: source.id, ...event };
}

export async function deleteAgendaEvent(professionalId, eventId) {
  await deleteDoc(doc(db, "professionalAgendas", professionalId, "events", eventId));
}

export async function cancelAgendaAppointment(
  professionalId,
  existing,
  { reason = "", blockMode = "current", blockDetails = {} } = {}
) {
  if (!existing?.id || existing.type !== "appointment") {
    throw new Error("Compromisso não identificado.");
  }

  const appointment = normalizeAgendaEvent(
    { ...existing, status: "cancelled", cancellationReason: reason },
    professionalId,
    existing
  );
  const batch = writeBatch(db);
  const appointmentReference = doc(
    db,
    "professionalAgendas",
    professionalId,
    "events",
    existing.id
  );
  batch.set(appointmentReference, {
    ...appointment,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  const blockInput = cancellationBlockInput(existing, {
    blockMode,
    blockDetails,
    reason
  });
  let block = null;
  let blockReference = null;
  if (blockInput) {
    blockReference = doc(agendaCollection(professionalId));
    block = normalizeAgendaEvent(blockInput, professionalId);
    batch.set(blockReference, {
      ...block,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
  return {
    appointment: { id: existing.id, ...appointment },
    block: block ? { id: blockReference.id, ...block } : null
  };
}

export async function reopenAgendaAppointment(
  professionalId,
  existing,
  { status = "scheduled", linkedBlock = null } = {}
) {
  if (!existing?.id || existing.type !== "appointment" || existing.status !== "cancelled") {
    throw new Error("Compromisso cancelado não identificado.");
  }
  if (!["scheduled", "confirmed"].includes(status)) {
    throw new Error("Escolha um estado válido para reabrir o compromisso.");
  }
  if (linkedBlock && (
    linkedBlock.type !== "block"
    || linkedBlock.relatedEventId !== existing.id
  )) {
    throw new Error("O bloqueio informado não pertence a este compromisso.");
  }

  const appointment = normalizeAgendaEvent(
    { ...existing, status },
    professionalId,
    existing
  );
  const batch = writeBatch(db);
  const appointmentReference = doc(
    db,
    "professionalAgendas",
    professionalId,
    "events",
    existing.id
  );
  batch.set(appointmentReference, {
    ...appointment,
    reopenedAt: serverTimestamp(),
    reopenCount: Number(existing.reopenCount || 0) + 1,
    updatedAt: serverTimestamp()
  }, { merge: true });
  if (linkedBlock) {
    batch.delete(doc(
      db,
      "professionalAgendas",
      professionalId,
      "events",
      linkedBlock.id
    ));
  }
  await batch.commit();
  return {
    appointment: {
      id: existing.id,
      ...appointment,
      reopenCount: Number(existing.reopenCount || 0) + 1
    },
    removedBlockId: linkedBlock?.id || null
  };
}

export async function loadAgendaAvailability(professionalId) {
  const snapshot = await getDoc(
    doc(db, "professionalAgendas", professionalId, "settings", "availability")
  );
  return snapshot.exists() ? withoutMetadata(snapshot.data()) : null;
}

export async function saveAgendaAvailability(professionalId, input) {
  const availability = normalizeAvailability(input, professionalId);
  await setDoc(
    doc(db, "professionalAgendas", professionalId, "settings", "availability"),
    { ...availability, updatedAt: serverTimestamp() },
    { merge: true }
  );
  return availability;
}
