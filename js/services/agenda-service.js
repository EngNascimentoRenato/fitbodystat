import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc
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
