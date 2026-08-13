function timestampDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (Number.isFinite(value.seconds)) return new Date(value.seconds * 1000);
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function latestDate(user, fields) {
  return fields
    .map((field) => timestampDate(user[field]))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;
}

function withinDays(date, days, now = new Date()) {
  return Boolean(date && now.getTime() - date.getTime() <= days * 86400000);
}

export function formatAdminDate(value) {
  const date = timestampDate(value);
  return date
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)
    : "Sem dados";
}

export function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}

export function buildAdminMetrics(users = [], links = [], invitations = [], now = new Date()) {
  const userActivity = users.map((user) => ({
    ...user,
    latestUse: latestDate(user, ["lastAccessAt", "lastWriteAt", "lastMeasurementAt", "lastActivityAt", "lastProjectUpdateAt"]),
    latestRecord: latestDate(user, ["lastMeasurementAt", "lastActivityAt"])
  }));
  const versionCounts = new Map();
  const deviceCounts = new Map();
  userActivity.forEach((user) => {
    if (user.appVersion) versionCounts.set(user.appVersion, (versionCounts.get(user.appVersion) || 0) + 1);
    if (user.deviceType) deviceCounts.set(user.deviceType, (deviceCounts.get(user.deviceType) || 0) + 1);
  });
  return {
    total: users.length,
    professionals: users.filter((user) => user.role === "professional").length,
    new7: users.filter((user) => withinDays(timestampDate(user.createdAt), 7, now)).length,
    active7: userActivity.filter((user) => withinDays(user.latestUse, 7, now)).length,
    active30: userActivity.filter((user) => withinDays(user.latestUse, 30, now)).length,
    stale30: userActivity.filter((user) => user.latestUse && !withinDays(user.latestUse, 30, now)).length,
    profileCompleted: users.filter((user) => user.profileCompleted === true).length,
    activeProjects: users.filter((user) => user.hasActiveProject === true).length,
    firstRecords: users.filter((user) => user.hasAnyRecord === true).length,
    telemetryCoverage: users.filter((user) => timestampDate(user.lastAccessAt)).length,
    activeLinks: links.filter((item) => item.status === "active").length,
    pendingInvitations: invitations.filter((item) => item.status === "pending").length,
    acceptedInvitations: invitations.filter((item) => item.status === "accepted").length,
    versions: [...versionCounts.entries()].sort((a, b) => b[1] - a[1]),
    devices: [...deviceCounts.entries()].sort((a, b) => b[1] - a[1]),
    recentUsers: userActivity.filter((user) => user.latestUse).sort((a, b) => b.latestUse - a.latestUse).slice(0, 8)
  };
}
