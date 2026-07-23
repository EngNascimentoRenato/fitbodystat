import { entryForm } from "../components/entry-form.js";
import { createEntry } from "../models/entry-model.js";
import { toNumber } from "../utils/number-utils.js";
import { showToast } from "../components/toast.js";

export function renderEntry(state) {
  return `
    <div class="view-stack">
      ${entryForm(state.profile)}
      <section class="card">
        <h2>Como medir</h2>
        <p class="muted">Para consistência, registre pela manhã, em jejum, depois de ir ao banheiro. No método por medidas, mantenha a fita nivelada e sem apertar a pele.</p>
      </section>
    </div>
  `;
}

export function bindEntry(state, persist, render) {
  document.getElementById("entry-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entry = createEntry({
      date: data.get("date"),
      weightKg: toNumber(data.get("weightKg")),
      waistCm: toNumber(data.get("waistCm")),
      neckCm: toNumber(data.get("neckCm")),
      hipCm: toNumber(data.get("hipCm")),
      bodyFatMethod: data.get("bodyFatMethod"),
      bodyFatManual: toNumber(data.get("bodyFatManual")),
      notes: data.get("notes").trim()
    });
    state.entries = [...state.entries.filter((item) => item.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date));
    persist({ type: "entry-upsert", entry });
    showToast("Registro salvo.");
    location.hash = "#/dashboard";
    render();
  });
}
