export function invitationIsPending(invitation, now = Date.now()) {
  if (invitation?.status !== "pending") return false;
  const expiresAt = typeof invitation.expiresAt?.toDate === "function"
    ? invitation.expiresAt.toDate().getTime()
    : null;
  return expiresAt === null || expiresAt > now;
}
