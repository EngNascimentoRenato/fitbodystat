export function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

export function classifyBmi(bmi) {
  if (!bmi) return "Sem dados";
  if (bmi < 18.5) return "Abaixo do peso";
  if (bmi < 25) return "Peso normal";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade I";
  if (bmi < 40) return "Obesidade II";
  return "Obesidade III";
}

export function weightForBmi(heightCm, bmi) {
  if (!heightCm || !bmi) return null;
  const heightM = heightCm / 100;
  return bmi * heightM * heightM;
}

export function formatBmiWeight(heightCm, bmi) {
  const weight = weightForBmi(heightCm, bmi);
  return weight ? Number(weight.toFixed(1)) : null;
}

export function getBmiTargets(heightCm) {
  return {
    normalMinKg: formatBmiWeight(heightCm, 18.5),
    normalMaxKg: formatBmiWeight(heightCm, 24.9),
    overweightLimitKg: formatBmiWeight(heightCm, 25),
    obesityExitKg: formatBmiWeight(heightCm, 30)
  };
}
