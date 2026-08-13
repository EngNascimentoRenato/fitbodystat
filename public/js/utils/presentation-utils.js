export function presentationIsActive(mode) {
  return mode === "identity" || mode === "evolution";
}

export function demonstrationLabel(type = "user", index = null) {
  if (type === "patient") {
    return Number.isInteger(index) ? `Paciente ${String(index + 1).padStart(2, "0")}` : "Paciente de demonstração";
  }
  if (type === "professional") return "Profissional de demonstração";
  if (type === "guest") return "Pessoa de demonstração";
  if (type === "location") return "Local de atendimento";
  return "Usuário de demonstração";
}

export function anonymizeAgendaData(events = [], patients = []) {
  const aliases = new Map(patients.map((patient, index) => [
    patient.uid || patient.id,
    demonstrationLabel("patient", index)
  ]));
  const safePatients = patients.map((patient, index) => ({
    ...patient,
    name: demonstrationLabel("patient", index),
    email: "",
    phone: ""
  }));
  const safeEvents = events.map((event) => ({
    ...event,
    patientName: event.patientId
      ? aliases.get(event.patientId) || demonstrationLabel("patient")
      : "",
    guestName: event.guestName ? demonstrationLabel("guest") : "",
    location: event.location ? demonstrationLabel("location") : "",
    privateNotes: "",
    cancellationReason: event.cancellationReason ? "Informação ocultada na apresentação" : ""
  }));
  return { events: safeEvents, patients: safePatients };
}
