function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export function normalizeProfessionalLocations(locations = []) {
  const normalized = (Array.isArray(locations) ? locations : [])
    .slice(0, 20)
    .map((location, index) => ({
      id: cleanText(location.id, 80) || `location-${index + 1}`,
      name: cleanText(location.name, 80),
      address: cleanText(location.address, 220),
      contact: cleanText(location.contact, 120)
    }))
    .filter((location) => location.name || location.address || location.contact);

  normalized.forEach((location) => {
    if (location.name.length < 2) {
      throw new Error("Informe um nome válido para cada local de atendimento.");
    }
  });

  const names = normalized.map((location) => location.name.toLocaleLowerCase("pt-BR"));
  if (new Set(names).size !== names.length) {
    throw new Error("Existem locais de atendimento com o mesmo nome.");
  }
  return normalized;
}
