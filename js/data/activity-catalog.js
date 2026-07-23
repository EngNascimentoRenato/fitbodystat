export const activityCatalog = [
  { id: "strength", label: "Musculação", category: "strength" },
  { id: "walking", label: "Caminhada", category: "cardio" },
  { id: "running", label: "Corrida", category: "cardio" },
  { id: "cycling", label: "Ciclismo", category: "cardio" },
  { id: "swimming", label: "Natação", category: "cardio" },
  { id: "water-aerobics", label: "Hidroginástica", category: "cardio" },
  { id: "yoga", label: "Yoga", category: "mind-body" },
  { id: "pilates", label: "Pilates", category: "mind-body" },
  { id: "crossfit", label: "CrossFit", category: "strength" },
  { id: "functional", label: "Treino funcional", category: "strength" },
  { id: "calisthenics", label: "Calistenia", category: "strength" },
  { id: "dance", label: "Dança", category: "cardio" },
  { id: "martial-arts", label: "Artes marciais", category: "sport" },
  { id: "football", label: "Futebol", category: "sport" },
  { id: "futsal", label: "Futsal", category: "sport" },
  { id: "basketball", label: "Basquete", category: "sport" },
  { id: "volleyball", label: "Vôlei", category: "sport" },
  { id: "tennis", label: "Tênis", category: "sport" },
  { id: "beach-tennis", label: "Beach tennis", category: "sport" },
  { id: "water-sports", label: "Esportes aquáticos", category: "sport" },
  { id: "stretching", label: "Alongamento", category: "recovery" },
  { id: "mobility", label: "Mobilidade", category: "recovery" },
  { id: "rehabilitation", label: "Fisioterapia ou reabilitação", category: "recovery" }
];

const activityMap = new Map(activityCatalog.map((activity) => [activity.id, activity]));

export function getActivity(activityId) {
  return activityMap.get(activityId) || null;
}

export function activityLabel(activityId) {
  return getActivity(activityId)?.label || activityId;
}

export function activityCategory(activityId) {
  return getActivity(activityId)?.category || "other";
}
