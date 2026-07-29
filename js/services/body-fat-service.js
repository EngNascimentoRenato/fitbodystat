export function calculateBodyFatByNavy({ sex, heightCm, waistCm, neckCm, hipCm }) {
  if (!sex || !heightCm || !waistCm || !neckCm) return null;

  if (sex === "female") {
    if (!hipCm || waistCm + hipCm - neckCm <= 0) return null;
    return 495 / (1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm)) - 450;
  }

  if (waistCm - neckCm <= 0) return null;
  return 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
}

export function calculateBodyFatBySkinfoldThreeSite(input = {}) {
  const age = Number(input.age);
  if (!["male", "female"].includes(input.sex)
    || !Number.isFinite(age)
    || age < 18
    || age > 100) return null;

  const siteKeys = input.sex === "male"
    ? ["chestMm", "abdomenMm", "thighMm"]
    : ["tricepsMm", "suprailiacMm", "thighMm"];
  const readings = siteKeys.map((key) => Number(input[key]));
  if (readings.some((value) => !Number.isFinite(value) || value <= 0 || value > 100)) {
    return null;
  }

  const sum = readings.reduce((total, value) => total + value, 0);
  const density = input.sex === "male"
    ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * age
    : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * age;
  const bodyFatPercent = 495 / density - 450;
  if (!Number.isFinite(bodyFatPercent) || bodyFatPercent <= 0 || bodyFatPercent >= 75) {
    return null;
  }
  return {
    protocol: "jackson-pollock-3",
    sex: input.sex,
    age,
    readingsMm: Object.fromEntries(siteKeys.map((key, index) => [key, readings[index]])),
    sumMm: Number(sum.toFixed(1)),
    density: Number(density.toFixed(6)),
    bodyFatPercent: Number(bodyFatPercent.toFixed(1)),
    conversion: "siri"
  };
}

export function classifyBodyFat(sex, bodyFat) {
  if (!bodyFat) return "Sem dados";
  if (!["male", "female"].includes(sex)) return "Referência não informada";
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
  if (entry.bodyFatManual !== null && entry.bodyFatManual !== undefined && entry.bodyFatManual !== "") {
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

export function resolveProfileBodyFat(profile) {
  return resolveBodyFat({
    waistCm: profile.startWaistCm,
    neckCm: profile.startNeckCm,
    hipCm: profile.startHipCm,
    bodyFatManual: profile.startBodyFatManual
  }, profile);
}
