import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../services/firebase-core.js";
import {
  careAreaForProfession
} from "./professional-catalog.js";
import {
  CARE_RELATIONSHIP_SCHEMA_VERSION,
  createCareEpisode,
  normalizeCareLink
} from "../models/care-episode-model.js";

function publicUserData(user, role = "user", status = "active") {
  return {
    uid: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    role,
    status,
    updatedAt: serverTimestamp()
  };
}

function clientUsageData() {
  const version = globalThis.FITBODYSTAT_VERSION || {};
  const userAgent = globalThis.navigator?.userAgent || "";
  return {
    appVersion: version.version || "desconhecida",
    appBuild: Number(version.build) || null,
    deviceType: /Mobi|Android|iPhone|iPad/i.test(userAgent) ? "mobile" : "desktop",
    installedPwa: Boolean(globalThis.matchMedia?.("(display-mode: standalone)")?.matches)
  };
}

function usageUpdate(fields = {}) {
  return {
    ...fields,
    ...clientUsageData(),
    lastWriteAt: serverTimestamp()
  };
}

function withoutMetadata(data = {}) {
  const { ownerId, updatedAt, createdAt, updatedBy, updatedByRole, ...content } = data;
  return content;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...publicUserData(user),
      ...clientUsageData(),
      lastAccessAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return { role: "user" };
  }

  const data = snapshot.data();
  if (data.status === "suspended") return data;
  const nextPublicData = publicUserData(user, data.role || "user", data.status || "active");
  const directoryChanged = data.uid !== nextPublicData.uid
    || data.name !== nextPublicData.name
    || data.email !== nextPublicData.email
    || data.role !== nextPublicData.role
    || data.status !== nextPublicData.status;
  await setDoc(userRef, {
    ...(directoryChanged ? nextPublicData : {}),
    ...clientUsageData(),
    lastAccessAt: serverTimestamp()
  }, { merge: true });
  return data;
}

export async function getUser(userId) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function loadCloudState(userId, options = {}) {
  const includeContact = options.includeContact !== false;
  const [profileSnapshot, planSnapshot, settingsSnapshot, entriesSnapshot, activitiesSnapshot, cyclesSnapshot, contactSnapshot] = await Promise.all([
    getDoc(doc(db, "profiles", userId)),
    getDoc(doc(db, "plans", userId)),
    getDoc(doc(db, "settings", userId)),
    getDocs(collection(db, "users", userId, "measurements")),
    getDocs(collection(db, "users", userId, "activities")),
    getDocs(collection(db, "users", userId, "cycles")),
    includeContact ? getDoc(doc(db, "contacts", userId)) : Promise.resolve(null)
  ]);

  const hasData = profileSnapshot.exists()
    || planSnapshot.exists()
    || settingsSnapshot.exists()
    || !entriesSnapshot.empty
    || !activitiesSnapshot.empty
    || !cyclesSnapshot.empty
    || contactSnapshot?.exists();

  if (!hasData) return null;

  const planData = planSnapshot.exists() ? planSnapshot.data() : {};
  return {
    profile: profileSnapshot.exists() ? withoutMetadata(profileSnapshot.data()) : {},
    contact: contactSnapshot?.exists() ? withoutMetadata(contactSnapshot.data()) : { phone: "" },
    goalPlan: planData.goalPlan || [],
    settings: settingsSnapshot.exists() ? withoutMetadata(settingsSnapshot.data()) : {},
    entries: entriesSnapshot.docs
      .map((item) => ({ id: item.id, ...withoutMetadata(item.data()) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    activities: activitiesSnapshot.docs
      .map((item) => ({ id: item.id, ...withoutMetadata(item.data()) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    cycles: cyclesSnapshot.docs
      .map((item) => ({ id: item.id, ...withoutMetadata(item.data()) }))
      .sort((a, b) => String(a.startedAt || "").localeCompare(String(b.startedAt || ""))),
    activeCycleId: profileSnapshot.exists() ? profileSnapshot.data().activeCycleId || null : null
  };
}

export async function saveCloudState(userId, state, actor = {}) {
  const measurementsRef = collection(db, "users", userId, "measurements");
  const activitiesRef = collection(db, "users", userId, "activities");
  const cyclesRef = collection(db, "users", userId, "cycles");
  const [existingEntries, existingActivities, existingCycles] = await Promise.all([
    getDocs(measurementsRef),
    getDocs(activitiesRef),
    getDocs(cyclesRef)
  ]);
  const batch = writeBatch(db);
  const audit = {
    ownerId: userId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid || userId,
    updatedByRole: actor.role || "user"
  };

  batch.set(doc(db, "profiles", userId), {
    ...state.profile,
    activeCycleId: state.activeCycleId || null,
    ...audit
  }, { merge: true });
  batch.set(doc(db, "plans", userId), { goalPlan: state.goalPlan || [], ...audit }, { merge: true });
  batch.set(doc(db, "settings", userId), { ...(state.settings || {}), ...audit }, { merge: true });
  batch.set(doc(db, "contacts", userId), { ...(state.contact || { phone: "" }), ...audit }, { merge: true });
  if ((actor.uid || userId) === userId) {
    batch.set(doc(db, "users", userId), usageUpdate({
      profileCompleted: Boolean(state.profile?.name && state.profile?.heightCm),
      hasActiveProject: Boolean(state.activeCycleId),
      projectCount: (state.cycles || []).length
    }), { merge: true });
  }

  const currentIds = new Set((state.entries || []).map((entry) => entry.id));
  existingEntries.docs.forEach((entrySnapshot) => {
    if (!currentIds.has(entrySnapshot.id)) batch.delete(entrySnapshot.ref);
  });

  (state.entries || []).forEach((entry) => {
    batch.set(doc(measurementsRef, entry.id), { ...entry, ...audit }, { merge: true });
  });

  const currentActivityIds = new Set((state.activities || []).map((activity) => activity.id));
  existingActivities.docs.forEach((activitySnapshot) => {
    if (!currentActivityIds.has(activitySnapshot.id)) batch.delete(activitySnapshot.ref);
  });

  (state.activities || []).forEach((activity) => {
    batch.set(doc(activitiesRef, activity.id), { ...activity, ...audit }, { merge: true });
  });

  const currentCycleIds = new Set((state.cycles || []).map((cycle) => cycle.id));
  existingCycles.docs.forEach((cycleSnapshot) => {
    const cycle = cycleSnapshot.data();
    const invalidInitialCycle = cycleSnapshot.id === "initial-cycle"
      && (cycle.startWeightKg === null || cycle.startWeightKg === "");
    if (invalidInitialCycle && !currentCycleIds.has(cycleSnapshot.id)) {
      batch.delete(cycleSnapshot.ref);
    }
  });

  (state.cycles || []).forEach((cycle) => {
    batch.set(doc(cyclesRef, cycle.id), { ...cycle, ...audit }, { merge: true });
  });

  await batch.commit();
}

function auditData(userId, actor = {}) {
  return {
    ownerId: userId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid || userId,
    updatedByRole: actor.role || "user"
  };
}

export async function saveProfileAndPlan(userId, state, actor = {}, change = {}) {
  const audit = auditData(userId, actor);
  const batch = writeBatch(db);
  batch.set(doc(db, "profiles", userId), {
    ...state.profile,
    activeCycleId: state.activeCycleId || null,
    ...audit
  }, { merge: true });
  batch.set(doc(db, "plans", userId), { goalPlan: state.goalPlan || [], ...audit }, { merge: true });
  (state.cycles || []).forEach((cycle) => {
    batch.set(doc(db, "users", userId, "cycles", cycle.id), { ...cycle, ...audit }, { merge: true });
  });
  if ((actor.uid || userId) === userId) {
    batch.set(doc(db, "users", userId), usageUpdate({
      profileCompleted: Boolean(state.profile?.name && state.profile?.heightCm),
      hasActiveProject: Boolean(state.activeCycleId),
      projectCount: (state.cycles || []).length,
      lastProjectUpdateAt: serverTimestamp()
    }), { merge: true });
  }
  if (change.auditEvent?.type) {
    const eventId = change.auditEvent.id
      || globalThis.crypto?.randomUUID?.()
      || `audit-${Date.now()}`;
    batch.set(doc(db, "users", userId, "auditEvents", eventId), {
      id: eventId,
      ownerId: userId,
      actorId: actor.uid || userId,
      actorRole: actor.role || "user",
      type: change.auditEvent.type,
      cycleId: change.auditEvent.cycleId || state.activeCycleId || null,
      previousObjective: change.auditEvent.previousObjective || null,
      nextObjective: change.auditEvent.nextObjective || null,
      discardedCustomGoalCount: Number(change.auditEvent.discardedCustomGoalCount) || 0,
      reasonCode: change.auditEvent.reasonCode || null,
      previousPlanning: change.auditEvent.previousPlanning || null,
      nextPlanning: change.auditEvent.nextPlanning || null,
      createdAt: serverTimestamp()
    });
  }
  await batch.commit();
}

export async function saveSettings(userId, settings, actor = {}) {
  await setDoc(doc(db, "settings", userId), {
    ...(settings || {}),
    ...auditData(userId, actor)
  }, { merge: true });
}

export async function saveContact(userId, contact, actor = {}) {
  await setDoc(doc(db, "contacts", userId), {
    ...(contact || { phone: "" }),
    ...auditData(userId, actor)
  }, { merge: true });
}

export async function saveMeasurement(userId, entry, actor = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", userId, "measurements", entry.id), {
    ...entry,
    ...auditData(userId, actor)
  }, { merge: true });
  if ((actor.uid || userId) === userId) {
    batch.set(doc(db, "users", userId), usageUpdate({
      hasMeasurement: true,
      hasAnyRecord: true,
      lastMeasurementAt: serverTimestamp()
    }), { merge: true });
  }
  await batch.commit();
}

export async function saveMeasurementAndProfile(userId, state, entry, actor = {}) {
  const audit = auditData(userId, actor);
  const batch = writeBatch(db);
  batch.set(doc(db, "profiles", userId), {
    ...state.profile,
    activeCycleId: state.activeCycleId || null,
    ...audit
  }, { merge: true });
  batch.set(doc(db, "users", userId, "measurements", entry.id), { ...entry, ...audit }, { merge: true });
  if ((actor.uid || userId) === userId) {
    batch.set(doc(db, "users", userId), usageUpdate({
      profileCompleted: Boolean(state.profile?.name && state.profile?.heightCm),
      hasActiveProject: Boolean(state.activeCycleId),
      hasMeasurement: true,
      hasAnyRecord: true,
      lastMeasurementAt: serverTimestamp()
    }), { merge: true });
  }
  await batch.commit();
}

export async function deleteMeasurement(userId, entryId) {
  await deleteDoc(doc(db, "users", userId, "measurements", entryId));
}

export async function saveActivity(userId, activity, actor = {}) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", userId, "activities", activity.id), {
    ...activity,
    ...auditData(userId, actor)
  }, { merge: true });
  if ((actor.uid || userId) === userId) {
    batch.set(doc(db, "users", userId), usageUpdate({
      hasActivity: true,
      hasAnyRecord: true,
      lastActivityAt: serverTimestamp()
    }), { merge: true });
  }
  await batch.commit();
}

export async function deleteActivity(userId, activityId) {
  await deleteDoc(doc(db, "users", userId, "activities", activityId));
}

export async function updateOwnDirectoryName(userId, name) {
  await updateDoc(doc(db, "users", userId), {
    name: String(name || "").trim(),
    updatedAt: serverTimestamp()
  });
}

export async function completeUserOnboarding(userId, role = "user") {
  const completion = {
    onboardingCompleted: true,
    onboardingCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (role === "professional") {
    completion.professionalOnboardingCompleted = true;
    completion.professionalOnboardingCompletedAt = serverTimestamp();
  }
  await updateDoc(doc(db, "users", userId), completion);
}

export async function loadProfessionalProfile(userId) {
  const snapshot = await getDoc(doc(db, "professionalProfiles", userId));
  return snapshot.exists() ? withoutMetadata(snapshot.data()) : null;
}

export async function saveProfessionalProfile(userId, profile, actor = {}) {
  await setDoc(doc(db, "professionalProfiles", userId), {
    ...(profile || {}),
    ...auditData(userId, actor)
  }, { merge: true });
}

export async function listUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listProfessionalRegistrations() {
  const snapshot = await getDocs(collection(db, "professionalRegistrations"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listProfessionalAccessRequests() {
  const snapshot = await getDocs(collection(db, "professionalAccessRequests"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listPersonalAccessRequests() {
  const snapshot = await getDocs(collection(db, "personalAccessRequests"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listPersonalAccessGrants() {
  const snapshot = await getDocs(collection(db, "personalAccessGrants"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function updateUserRole(userId, role) {
  await updateDoc(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp()
  });
}

export async function updateUserStatus(userId, status) {
  await updateDoc(doc(db, "users", userId), {
    status,
    updatedAt: serverTimestamp()
  });
}

export async function listInvitationsForProfessional(professionalId) {
  const snapshot = await getDocs(query(
    collection(db, "careInvitations"),
    where("professionalId", "==", professionalId)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listInvitationsForUser(email) {
  const snapshot = await getDocs(query(
    collection(db, "careInvitations"),
    where("patientEmailLower", "==", normalizeEmail(email))
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAllCareInvitations() {
  const snapshot = await getDocs(collection(db, "careInvitations"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function respondToCareInvitation(invitation, user, response, options = {}) {
  if (!['accepted', 'rejected'].includes(response)) throw new Error("Resposta inválida.");
  if (invitation.expiresAt?.toDate?.().getTime() <= Date.now()) {
    throw new Error("Este convite expirou. Solicite um novo convite ao profissional.");
  }

  const invitationRef = doc(db, "careInvitations", invitation.id);
  if (response === "rejected") {
    await updateDoc(invitationRef, {
      status: response,
      patientId: user.uid,
      patientName: user.displayName || "",
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }

  const professionType = invitation.professionType || invitation.professionalArea || "";
  const careArea = invitation.careArea || careAreaForProfession(professionType);
  const conflictingProfessional = (options.existingProfessionals || []).find((professional) =>
    professional.link?.status === "active"
    && (professional.link?.careArea || careAreaForProfession(professional.professionType)) === careArea
    && professional.uid !== invitation.professionalId
  );
  if (conflictingProfessional) {
    throw new Error("Já existe um profissional responsável por esta área de acompanhamento.");
  }

  const linkId = `${invitation.professionalId}_${user.uid}`;
  const linkRef = doc(db, "careLinks", linkId);
  const episodeRef = doc(db, "careEpisodes", invitation.id);
  const assignmentRef = doc(db, "users", user.uid, "careAreaAssignments", careArea);
  await runTransaction(db, async (transaction) => {
    const [invitationSnapshot, assignmentSnapshot] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(assignmentRef)
    ]);
    if (!invitationSnapshot.exists() || invitationSnapshot.data().status !== "pending") {
      throw new Error("Este convite não está mais disponível.");
    }
    if (assignmentSnapshot.exists()
      && assignmentSnapshot.data().status === "active"
      && assignmentSnapshot.data().professionalId !== invitation.professionalId) {
      throw new Error("Já existe um profissional responsável por esta área de acompanhamento.");
    }

    transaction.update(invitationRef, {
      status: "accepted",
      patientId: user.uid,
      patientName: user.displayName || "",
      respondedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    const permissions = {
      ...(invitation.permissions || { viewData: true, editData: true }),
      createCycles: invitation.permissions?.createCycles !== false,
      sharePhone: options.sharePhone === true
    };
    const accessBenefit = invitation.accessBenefit || {
      source: "professional-link",
      activeWhileLinked: true
    };
    const timestamp = serverTimestamp();
    transaction.set(episodeRef, createCareEpisode({
      episodeId: invitation.id,
      linkId,
      invitation,
      patientId: user.uid,
      professionType,
      careArea,
      permissions,
      accessBenefit,
      timestamp
    }));
    transaction.set(linkRef, {
      relationshipModelVersion: CARE_RELATIONSHIP_SCHEMA_VERSION,
      activeEpisodeId: invitation.id,
      episodeStatus: "active",
      invitationId: invitation.id,
      professionalId: invitation.professionalId,
      patientId: user.uid,
      professionType,
      careArea,
      status: "active",
      permissions,
      originInvitationId: invitation.id,
      accessBenefit,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    if (!assignmentSnapshot.exists()) {
      transaction.set(assignmentRef, {
        patientId: user.uid,
        professionalId: invitation.professionalId,
        linkId,
        professionType,
        careArea,
        status: "active",
        activeEpisodeId: invitation.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  });
}

export async function listCareLinksForProfessional(professionalId) {
  const snapshot = await getDocs(query(
    collection(db, "careLinks"),
    where("professionalId", "==", professionalId)
  ));
  return snapshot.docs
    .map((item) => normalizeCareLink({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active");
}

export async function listCareLinksForUser(patientId) {
  const snapshot = await getDocs(query(
    collection(db, "careLinks"),
    where("patientId", "==", patientId)
  ));
  return snapshot.docs
    .map((item) => normalizeCareLink({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active");
}

export async function listPatientsForProfessional(professionalId) {
  const links = await listCareLinksForProfessional(professionalId);
  const patients = await Promise.all(links.map(async (link) => {
    const [user, profileSnapshot, contactSnapshot, measurementSnapshot, activitySnapshot] = await Promise.all([
      getUser(link.patientId),
      getDoc(doc(db, "profiles", link.patientId)),
      link.permissions?.sharePhone === true
        ? getDoc(doc(db, "contacts", link.patientId))
        : Promise.resolve(null),
      getDocs(query(
        collection(db, "users", link.patientId, "measurements"),
        orderBy("date", "desc"),
        limit(1)
      )),
      getDocs(query(
        collection(db, "users", link.patientId, "activities"),
        orderBy("date", "desc"),
        limit(1)
      ))
    ]);
    if (!user) return null;
    const profile = profileSnapshot.exists() ? withoutMetadata(profileSnapshot.data()) : {};
    const contact = contactSnapshot?.exists() ? withoutMetadata(contactSnapshot.data()) : {};
    const activeCycleId = profile.activeCycleId || null;
    const cycleSnapshot = activeCycleId
      ? await getDoc(doc(db, "users", link.patientId, "cycles", activeCycleId))
      : null;
    const activeCycle = cycleSnapshot?.exists()
      ? withoutMetadata(cycleSnapshot.data())
      : null;
    const latestMeasurement = measurementSnapshot.docs[0]?.data() || null;
    const latestActivity = activitySnapshot.docs[0]?.data() || null;
    const lastRecord = [
      latestMeasurement ? { type: "measurement", date: latestMeasurement.date } : null,
      latestActivity ? { type: "activity", date: latestActivity.date } : null
    ].filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0] || null;
      return {
        ...user,
        name: profile.name || user.name,
        phone: contact.phone || "",
        profile,
        activeCycle,
        lastMeasurement: latestMeasurement ? { type: "measurement", date: latestMeasurement.date } : null,
        lastActivity: latestActivity ? { type: "activity", date: latestActivity.date } : null,
        lastRecord,
        link
      };
  }));
  return patients.filter(Boolean);
}

export async function listProfessionalsForUser(patientId) {
  const links = await listCareLinksForUser(patientId);
  const professionals = await Promise.all(links.map(async (link) => {
    const [user, contactSnapshot, professionalProfileSnapshot] = await Promise.all([
      getUser(link.professionalId),
      getDoc(doc(db, "contacts", link.professionalId)),
      getDoc(doc(db, "professionalProfiles", link.professionalId))
    ]);
    const contact = contactSnapshot.exists() ? withoutMetadata(contactSnapshot.data()) : {};
    const professionalProfile = professionalProfileSnapshot.exists()
      ? withoutMetadata(professionalProfileSnapshot.data())
      : {};
    const professionType = professionalProfile.professionType || link.professionType || "";
    const careArea = link.careArea || careAreaForProfession(professionType);
    return user ? {
      ...user,
      phone: contact.phone || "",
      professionType,
      careArea,
      needsCareAreaMigration: !link.careArea,
      link: { ...link, professionType, careArea }
    } : null;
  }));
  const activeProfessionals = professionals.filter(Boolean);
  await Promise.all(activeProfessionals.map(async (professional) => {
    if (!professional.needsCareAreaMigration
      || !professional.professionType
      || !["physical-training", "nutrition"].includes(professional.careArea)) return;
    const linkRef = doc(db, "careLinks", professional.link.id);
    const assignmentRef = doc(db, "users", patientId, "careAreaAssignments", professional.careArea);
    try {
      await runTransaction(db, async (transaction) => {
        const assignmentSnapshot = await transaction.get(assignmentRef);
        if (assignmentSnapshot.exists()
          && assignmentSnapshot.data().professionalId !== professional.uid) return;
        transaction.update(linkRef, {
          professionType: professional.professionType,
          careArea: professional.careArea,
          updatedAt: serverTimestamp()
        });
        if (!assignmentSnapshot.exists()) {
          transaction.set(assignmentRef, {
            patientId,
            professionalId: professional.uid,
            linkId: professional.link.id,
            professionType: professional.professionType,
            careArea: professional.careArea,
            status: "active",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      });
    } catch (error) {
      console.warn("Não foi possível migrar a área do vínculo existente.", error);
    }
  }));
  return activeProfessionals.map(({ needsCareAreaMigration, ...professional }) => professional);
}

export async function listAllCareLinks() {
  const snapshot = await getDocs(collection(db, "careLinks"));
  return snapshot.docs.map((item) => normalizeCareLink({ id: item.id, ...item.data() }));
}

export async function revokeCareLink(link, actorId) {
  const linkRef = doc(db, "careLinks", link.id);
  const episodeRef = link.activeEpisodeId
    ? doc(db, "careEpisodes", link.activeEpisodeId)
    : null;
  const assignmentRef = link.careArea
    ? doc(db, "users", link.patientId, "careAreaAssignments", link.careArea)
    : null;
  await runTransaction(db, async (transaction) => {
    const [assignmentSnapshot, episodeSnapshot] = await Promise.all([
      assignmentRef ? transaction.get(assignmentRef) : Promise.resolve(null),
      episodeRef ? transaction.get(episodeRef) : Promise.resolve(null)
    ]);
    transaction.update(linkRef, {
      status: "revoked",
      episodeStatus: "ended",
      revokedBy: actorId,
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    if (assignmentSnapshot?.exists() && assignmentSnapshot.data().linkId === link.id) {
      transaction.delete(assignmentRef);
    }
    if (episodeSnapshot?.exists() && episodeSnapshot.data().status === "active") {
      transaction.update(episodeRef, {
        status: "ended",
        endedBy: actorId,
        endedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  });
}

export async function updateCareLinkPhoneSharing(link, sharePhone) {
  await updateDoc(doc(db, "careLinks", link.id), {
    permissions: {
      ...(link.permissions || { viewData: true, editData: true }),
      createCycles: link.permissions?.createCycles !== false,
      sharePhone: sharePhone === true
    },
    updatedAt: serverTimestamp()
  });
}
