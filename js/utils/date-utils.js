export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function ageFromBirthDate(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function addMonths(dateISO, months) {
  const date = new Date(`${dateISO}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}
