function workspaceKey(userId) {
  return `fitbodystat:${userId}:active-workspace`;
}

export function personalWorkspaceEnabled(authState) {
  return authState?.role === "professional"
    && Boolean(authState.professionalProfile)
    && authState.professionalProfile?.personalWorkspaceEnabled !== false;
}

export function loadDeviceWorkspace(userId, enabled) {
  if (!enabled || !userId) return "professional";
  try {
    return localStorage.getItem(workspaceKey(userId)) === "personal"
      ? "personal"
      : "professional";
  } catch {
    return "professional";
  }
}

export function saveDeviceWorkspace(userId, workspace) {
  if (!userId) return;
  try {
    localStorage.setItem(
      workspaceKey(userId),
      workspace === "personal" ? "personal" : "professional"
    );
  } catch {
    // The active environment remains available for this session.
  }
}

export function clearDeviceWorkspace(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(workspaceKey(userId));
  } catch {
    // Nothing else is required when local storage is unavailable.
  }
}
