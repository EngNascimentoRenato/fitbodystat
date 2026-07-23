import { todayISO } from "../utils/date-utils.js";

export function parseLocalDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`);
}

export function localDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(dateISO, days) {
  const date = parseLocalDate(dateISO);
  date.setDate(date.getDate() + days);
  return localDateISO(date);
}

export function weekDates(referenceDate = todayISO()) {
  const reference = parseLocalDate(referenceDate);
  const mondayOffset = (reference.getDay() + 6) % 7;
  const monday = new Date(reference);
  monday.setDate(reference.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return localDateISO(date);
  });
}

export function weeklyActivitySummary(activities = [], goalDays = 3, referenceDate = todayISO()) {
  const dates = weekDates(referenceDate);
  const activeDates = new Set(
    activities.filter((activity) => activity.completed && dates.includes(activity.date)).map((activity) => activity.date)
  );
  const completedDays = activeDates.size;
  const goal = Math.min(7, Math.max(1, Number(goalDays) || 3));
  return {
    dates,
    activeDates,
    completedDays,
    goalDays: goal,
    progress: Math.min(100, Math.round((completedDays / goal) * 100))
  };
}

export function recentWeekTotals(activities = [], numberOfWeeks = 4, referenceDate = todayISO()) {
  const currentMonday = weekDates(referenceDate)[0];
  return Array.from({ length: numberOfWeeks }, (_, reverseIndex) => {
    const weeksAgo = numberOfWeeks - reverseIndex - 1;
    const start = addDays(currentMonday, weeksAgo * -7);
    const dates = weekDates(start);
    const count = new Set(
      activities.filter((activity) => activity.completed && dates.includes(activity.date)).map((activity) => activity.date)
    ).size;
    return { start, count };
  });
}

export function monthCalendar(monthISO, activities = []) {
  const [year, month] = monthISO.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const leadingDays = (firstDay.getDay() + 6) % 7;
  const activityByDate = new Map(activities.map((activity) => [activity.date, activity]));
  const cells = [];

  for (let index = 0; index < leadingDays; index += 1) cells.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = localDateISO(new Date(year, month - 1, day));
    cells.push({ date, day, activity: activityByDate.get(date) || null });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function monthLabel(monthISO) {
  const [year, month] = monthISO.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, month - 1, 1));
}

export function shiftMonth(monthISO, amount) {
  const [year, month] = monthISO.split("-").map(Number);
  return localDateISO(new Date(year, month - 1 + amount, 1)).slice(0, 7);
}
