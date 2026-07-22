export function calculateBodyFatByNavy({ sex, heightCm, waistCm, neckCm, hipCm }) {
  if (!sex || !heightCm || !waistCm || !neckCm) return null;

  if (sex === "female") {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }

  if (waistCm - neckCm <= 0) return null;
  return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
}

export function classifyBodyFat(sex, bodyFat) {
  if (!bodyFat) return "Sem dados";
  if (sex === "female") {
    if (bodyFat < 14) return "Gordura essencial";
    if (bodyFat < 21) return "Atleta";
    if (bodyFat < 25) return "Fitness";
    if (bodyFat < 32) return "Média";
    return "Elevado";
  }

  if (bodyFat < 6) return "Gordura essencial";
  if (bodyFat < 14) return "Atleta";
  if (bodyFat < 18) return "Fitness";
  if (bodyFat < 25) return "Média";
  return "Elevado";
}

export function resolveBodyFat(entry, profile) {
  if (entry.bodyFatManual) {
    return Number(entry.bodyFatManual);
  }

  return calculateBodyFatByNavy({
    sex: profile.sex,
    heightCm: profile.heightCm,
    waistCm: entry.waistCm,
    neckCm: entry.neckCm,
    hipCm: entry.hipCm
  });
}
