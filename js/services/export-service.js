import { enrichEntries } from "./progress-service.js";
import { formatDate } from "../utils/date-utils.js";

export function exportCsv(profile, entries) {
  const rows = enrichEntries(profile, entries);
  const header = ["Data", "Peso kg", "Cintura cm", "Pescoço cm", "Quadril cm", "IMC", "Gordura %", "Método", "Observações"];
  const body = rows.map((entry) => [
    formatDate(entry.date),
    entry.weightKg,
    entry.waistCm,
    entry.neckCm || "",
    entry.hipCm || "",
    entry.bmi ? entry.bmi.toFixed(1) : "",
    entry.bodyFat ? entry.bodyFat.toFixed(1) : "",
    entry.bodyFatMethod || "",
    entry.notes || ""
  ]);

  return [header, ...body]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
}

export function downloadText(filename, text, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
