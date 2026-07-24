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
import { normalizeAgendaEvent, normalizeAvailability } from "../models/agenda-model.js";

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

export async function deleteAgendaEvent(professionalId, eventId) {
  await deleteDoc(doc(db, "professionalAgendas", professionalId, "events", eventId));
}

export async function cancelAgendaAppointment(
  professionalId,
  existing,
  { reason = "", blockSlot = true } = {}
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

  let block = null;
  let blockReference = null;
  if (blockSlot) {
    blockReference = doc(agendaCollection(professionalId));
    block = normalizeAgendaEvent({
      type: "block",
      title: "Indisponível após cancelamento",
      date: existing.date,
      startTime: existing.startTime,
      endTime: existing.endTime,
      allDay: false,
      color: "#657076",
      recurrence: { frequency: "none", weekDays: [], untilDate: null },
      privateNotes: reason
        ? `Horário bloqueado após cancelamento. Motivo: ${reason}`
        : "Horário bloqueado após cancelamento.",
      relatedEventId: existing.id
    }, professionalId);
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
