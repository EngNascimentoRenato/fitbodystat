import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { listPatientsForProfessional } from "../data/firestore-store.js";
import {
  agendaEventPerson,
  agendaPeriodLabel,
  agendaViewDays,
  filterAgendaEvents,
  moveAgendaAnchor
} from "../models/agenda-model.js";
import {
  deleteAgendaEvent,
  listAgendaEvents,
  saveAgendaEvent
} from "../services/agenda-service.js";
import { formatDate, todayISO } from "../utils/date-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatPhone } from "../utils/phone-utils.js";

const statusLabels = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  "no-show": "Falta",
  blocked: "Indisponível"
};

const modalityLabels = {
  "in-person": "Presencial",
  online: "On-line",
  home: "Em domicílio",
  other: "Outro"
};

const weekDayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const agendaUi = {
  view: "week",
  anchor: todayISO(),
  filters: { status: "", patient: "", location: "" },
  editorOpen: false,
  draft: null
};

function parseLocalDate(dateISO) {
  return new Date(`${dateISO}T00:00:00`);
}

function shortDayLabel(dateISO) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(parseLocalDate(dateISO)).replace(".", "");
}

function capitalizeFirst(value) {
  return value ? value[0].toUpperCase() + value.slice(1) : "";
}

function defaultStartTime(dateISO) {
  if (dateISO !== todayISO()) return "09:00";
  const now = new Date();
  const minutes = now.getMinutes() <= 30 ? 30 : 0;
  const hour = now.getHours() + (now.getMinutes() > 30 ? 1 : 0);
  return `${String(Math.min(hour, 23)).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function patientId(patient) {
  return patient.uid || patient.id;
}

function selectedPatient(event, patients) {
  return event?.patientId
    ? patients.find((patient) => patientId(patient) === event.patientId)
    : null;
}

function eventTitle(event) {
  if (event.type === "block") return event.title || "Indisponível";
  const person = agendaEventPerson(event);
  return person ? `${event.title || "Atendimento"} · ${person}` : event.title || "Atendimento";
}

function eventColor(event) {
  return /^#[0-9a-f]{6}$/i.test(String(event.color || ""))
    ? event.color
    : event.type === "block" ? "#657076" : "#25636f";
}

function renderStatusBadge(status) {
  const tone = status === "cancelled" || status === "no-show"
    ? "danger"
    : status === "confirmed" || status === "completed"
      ? "success"
      : status === "blocked" ? "neutral" : "";
  return `<span class="agenda-status ${tone}">${escapeHtml(statusLabels[status] || status)}</span>`;
}

function renderEventButton(event, compact = false) {
  return `
    <button class="agenda-event ${compact ? "compact" : ""} ${event.type === "block" ? "block" : ""}"
      type="button" data-agenda-event="${escapeAttribute(event.id)}"
      style="--event-color:${eventColor(event)}">
      <span class="agenda-event-time">${escapeHtml(event.startTime)}</span>
      <strong>${escapeHtml(eventTitle(event))}</strong>
      ${compact ? "" : renderStatusBadge(event.status)}
    </button>
  `;
}

function eventsByDate(events) {
  return events.reduce((groups, event) => {
    groups[event.date] ||= [];
    groups[event.date].push(event);
    return groups;
  }, {});
}

function renderDayView(days, groups, patients) {
  const date = days[0];
  const events = groups[date] || [];
  return `
    <section class="agenda-day" aria-label="Agenda de ${escapeAttribute(formatDate(date))}">
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(shortDayLabel(date))}</p>
          <h2>${events.length} ${events.length === 1 ? "item" : "itens"}</h2>
        </div>
        <button class="button" type="button" data-create-on-date="${escapeAttribute(date)}">Adicionar</button>
      </header>
      <div class="agenda-day-list">
        ${events.map((event) => {
          const patient = selectedPatient(event, patients);
          return `
            <article class="agenda-day-event" style="--event-color:${eventColor(event)}">
              <button type="button" data-agenda-event="${escapeAttribute(event.id)}">
                <span class="agenda-day-time">${escapeHtml(event.startTime)}<small>${event.durationMinutes} min</small></span>
                <span class="agenda-day-main">
                  <strong>${escapeHtml(eventTitle(event))}</strong>
                  <small>${escapeHtml([
                    modalityLabels[event.modality],
                    event.location
                  ].filter(Boolean).join(" · ") || "Compromisso privado")}</small>
                </span>
                ${renderStatusBadge(event.status)}
              </button>
              ${patient?.phone ? `<a class="agenda-phone" href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>` : ""}
            </article>
          `;
        }).join("") || `<div class="agenda-empty-day"><p>Nenhum compromisso neste dia.</p><button class="button primary" type="button" data-create-on-date="${escapeAttribute(date)}">Criar compromisso</button></div>`}
      </div>
    </section>
  `;
}

function renderWeekView(days, groups) {
  return `
    <div class="agenda-week">
      ${days.map((date) => {
        const events = groups[date] || [];
        return `
          <section class="agenda-week-day ${date === todayISO() ? "today" : ""}">
            <button class="agenda-day-heading" type="button" data-open-day="${escapeAttribute(date)}">
              <span>${escapeHtml(shortDayLabel(date))}</span>
              <strong>${events.length}</strong>
            </button>
            <div class="agenda-week-events">
              ${events.map((event) => renderEventButton(event)).join("")
                || `<button class="agenda-empty-slot" type="button" data-create-on-date="${escapeAttribute(date)}">Adicionar</button>`}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderMonthView(days, groups, anchor) {
  const currentMonth = anchor.slice(0, 7);
  return `
    <div class="agenda-month">
      <div class="agenda-month-weekdays">
        ${weekDayLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>
      <div class="agenda-month-grid">
        ${days.map((date) => {
          const events = groups[date] || [];
          const outside = date.slice(0, 7) !== currentMonth;
          return `
            <section class="agenda-month-day ${outside ? "outside" : ""} ${date === todayISO() ? "today" : ""}">
              <button class="agenda-month-date" type="button" data-open-day="${escapeAttribute(date)}"
                aria-label="Abrir ${escapeAttribute(formatDate(date))}">${Number(date.slice(-2))}</button>
              <div class="agenda-month-events">
                ${events.slice(0, 3).map((event) => renderEventButton(event, true)).join("")}
                ${events.length > 3 ? `<button class="agenda-more" type="button" data-open-day="${escapeAttribute(date)}">+${events.length - 3}</button>` : ""}
              </div>
              <button class="agenda-add-day" type="button" data-create-on-date="${escapeAttribute(date)}" aria-label="Adicionar em ${escapeAttribute(formatDate(date))}">+</button>
            </section>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderFilters(events, patients) {
  const locations = [...new Set(events.map((event) => event.location).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return `
    <div class="agenda-filters" aria-label="Filtros da agenda">
      <div class="field">
        <label for="agenda-filter-status">Estado</label>
        <select id="agenda-filter-status">
          <option value="">Todos</option>
          ${Object.entries(statusLabels).map(([value, label]) =>
            `<option value="${value}" ${agendaUi.filters.status === value ? "selected" : ""}>${label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="field">
        <label for="agenda-filter-patient">Paciente</label>
        <select id="agenda-filter-patient">
          <option value="">Todos</option>
          ${patients.map((patient) => {
            const id = patientId(patient);
            return `<option value="${escapeAttribute(id)}" ${agendaUi.filters.patient === id ? "selected" : ""}>${escapeHtml(patient.name || patient.email)}</option>`;
          }).join("")}
          <option value="__guest" ${agendaUi.filters.patient === "__guest" ? "selected" : ""}>Pessoas avulsas</option>
        </select>
      </div>
      <div class="field">
        <label for="agenda-filter-location">Local</label>
        <select id="agenda-filter-location">
          <option value="">Todos</option>
          ${locations.map((location) =>
            `<option value="${escapeAttribute(location)}" ${agendaUi.filters.location === location ? "selected" : ""}>${escapeHtml(location)}</option>`
          ).join("")}
        </select>
      </div>
      <button class="button text-button agenda-clear-filters" id="agenda-clear-filters" type="button">Limpar filtros</button>
    </div>
  `;
}

function blankDraft(type = "appointment", date = agendaUi.anchor) {
  return {
    type,
    title: type === "block" ? "Indisponível" : "Atendimento",
    date,
    startTime: defaultStartTime(date),
    durationMinutes: 60,
    patientId: "",
    patientName: "",
    guestName: "",
    modality: "in-person",
    location: "",
    status: type === "block" ? "blocked" : "scheduled",
    color: type === "block" ? "#657076" : "#25636f",
    privateNotes: ""
  };
}

function renderEditor(patients) {
  const event = agendaUi.draft || blankDraft();
  const isEdit = Boolean(event.id);
  const isBlock = event.type === "block";
  const patientValue = event.patientId || "__guest";
  const patient = selectedPatient(event, patients);
  return `
    <dialog class="agenda-dialog" id="agenda-dialog">
      <form class="form agenda-form" id="agenda-form">
        <input type="hidden" name="eventId" value="${escapeAttribute(event.id || "")}" />
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">${isEdit ? "Editar agenda" : "Novo item"}</p>
            <h2>${isBlock ? "Bloqueio de horário" : "Compromisso"}</h2>
          </div>
          <button class="icon-button" id="close-agenda-dialog" type="button" aria-label="Fechar">×</button>
        </header>

        <div class="agenda-type-switch" role="group" aria-label="Tipo de item">
          <label><input type="radio" name="type" value="appointment" ${!isBlock ? "checked" : ""} /><span>Compromisso</span></label>
          <label><input type="radio" name="type" value="block" ${isBlock ? "checked" : ""} /><span>Indisponibilidade</span></label>
        </div>

        <div class="form-grid">
          <div class="field">
            <label for="agenda-title">Título</label>
            <input id="agenda-title" name="title" maxlength="80" required value="${escapeAttribute(event.title || "")}" />
          </div>
          <div class="field">
            <label for="agenda-date">Data</label>
            <input id="agenda-date" name="date" type="date" required value="${escapeAttribute(event.date)}" />
          </div>
          <div class="field">
            <label for="agenda-start-time">Horário inicial</label>
            <input id="agenda-start-time" name="startTime" type="time" required value="${escapeAttribute(event.startTime)}" />
          </div>
          <div class="field">
            <label for="agenda-duration">Duração em minutos</label>
            <input id="agenda-duration" name="durationMinutes" type="number" min="15" max="720" step="15" required
              value="${escapeAttribute(event.durationMinutes)}" />
          </div>
        </div>

        <div class="form-grid agenda-appointment-fields" ${isBlock ? "hidden" : ""}>
          <div class="field">
            <label for="agenda-patient">Paciente ou pessoa avulsa</label>
            <select id="agenda-patient" name="patientId">
              ${patients.map((item) => {
                const id = patientId(item);
                return `<option value="${escapeAttribute(id)}" ${patientValue === id ? "selected" : ""}>${escapeHtml(item.name || item.email)}</option>`;
              }).join("")}
              <option value="__guest" ${patientValue === "__guest" ? "selected" : ""}>Pessoa ainda não cadastrada</option>
            </select>
          </div>
          <div class="field agenda-guest-field" ${patientValue !== "__guest" ? "hidden" : ""}>
            <label for="agenda-guest-name">Nome da pessoa</label>
            <input id="agenda-guest-name" name="guestName" maxlength="80" value="${escapeAttribute(event.guestName || "")}" />
          </div>
          <div class="field">
            <label for="agenda-modality">Modalidade</label>
            <select id="agenda-modality" name="modality">
              ${Object.entries(modalityLabels).map(([value, label]) =>
                `<option value="${value}" ${event.modality === value ? "selected" : ""}>${label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="agenda-location">Local ou link</label>
            <input id="agenda-location" name="location" maxlength="160" value="${escapeAttribute(event.location || "")}" />
          </div>
          <div class="field">
            <label for="agenda-status">Estado</label>
            <select id="agenda-status" name="status">
              ${Object.entries(statusLabels).filter(([value]) => value !== "blocked").map(([value, label]) =>
                `<option value="${value}" ${event.status === value ? "selected" : ""}>${label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="agenda-color">Cor do compromisso</label>
            <input id="agenda-color" name="color" type="color" value="${escapeAttribute(event.color || "#25636f")}" />
          </div>
        </div>

        ${patient?.phone ? `
          <p class="agenda-contact">
            Telefone compartilhado: <a href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>
          </p>
        ` : ""}

        <div class="field">
          <label for="agenda-private-notes">Observações privadas</label>
          <textarea id="agenda-private-notes" name="privateNotes" maxlength="1000">${escapeHtml(event.privateNotes || "")}</textarea>
          <span class="help-text">Visíveis somente para você nesta versão.</span>
        </div>

        <footer class="agenda-dialog-actions">
          ${isEdit ? `<button class="button danger" id="delete-agenda-event" type="button">Excluir</button>` : "<span></span>"}
          <div class="button-row">
            <button class="button" id="cancel-agenda-dialog" type="button">Cancelar</button>
            <button class="button primary" type="submit">Salvar</button>
          </div>
        </footer>
      </form>
    </dialog>
  `;
}

export function renderAgenda(authState) {
  if (authState.role !== "professional") {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é destinada a profissionais.</p></section>`;
  }

  const events = authState.agendaEvents || [];
  const patients = authState.patients || [];
  const filteredEvents = filterAgendaEvents(events, agendaUi.filters);
  const days = agendaViewDays(agendaUi.anchor, agendaUi.view);
  const visibleDates = new Set(days);
  const visibleEvents = filteredEvents.filter((event) => visibleDates.has(event.date));
  const groups = eventsByDate(visibleEvents);
  const appointmentCount = visibleEvents.filter((event) => event.type === "appointment").length;
  const blockCount = visibleEvents.filter((event) => event.type === "block").length;

  const calendar = agendaUi.view === "day"
    ? renderDayView(days, groups, patients)
    : agendaUi.view === "month"
      ? renderMonthView(days, groups, agendaUi.anchor)
      : renderWeekView(days, groups);

  return `
    <div class="view-stack agenda-view">
      <section class="agenda-toolbar">
        <div class="agenda-toolbar-main">
          <div class="agenda-navigation">
            <button class="icon-button" id="agenda-previous" type="button" aria-label="Período anterior">‹</button>
            <button class="button" id="agenda-today" type="button">Hoje</button>
            <button class="icon-button" id="agenda-next" type="button" aria-label="Próximo período">›</button>
          </div>
          <h2>${escapeHtml(capitalizeFirst(agendaPeriodLabel(agendaUi.anchor, agendaUi.view)))}</h2>
          <div class="agenda-view-switch" role="group" aria-label="Visualização da agenda">
            ${["day", "week", "month"].map((view) => `
              <button type="button" data-agenda-view="${view}" ${agendaUi.view === view ? 'aria-pressed="true"' : ""}>
                ${{ day: "Dia", week: "Semana", month: "Mês" }[view]}
              </button>
            `).join("")}
          </div>
        </div>
        <div class="agenda-toolbar-actions">
          <p>${appointmentCount} ${appointmentCount === 1 ? "compromisso" : "compromissos"} · ${blockCount} ${blockCount === 1 ? "bloqueio" : "bloqueios"}</p>
          <div class="button-row">
            <button class="button" id="refresh-agenda" type="button">Atualizar</button>
            <button class="button" data-new-agenda-event="block" type="button">Bloquear horário</button>
            <button class="button primary" data-new-agenda-event="appointment" type="button">Novo compromisso</button>
          </div>
        </div>
        ${renderFilters(events, patients)}
      </section>

      <section class="agenda-calendar" aria-busy="${authState.agendaEvents === null}">
        ${authState.agendaEvents === null
          ? `<div class="empty-state"><p>Carregando agenda...</p></div>`
          : calendar}
      </section>
    </div>
    ${agendaUi.editorOpen ? renderEditor(patients) : ""}
  `;
}

async function refreshAgenda(context) {
  try {
    const [events, patients] = await Promise.all([
      listAgendaEvents(context.authState.user.uid),
      listPatientsForProfessional(context.authState.user.uid)
    ]);
    context.authState.agendaEvents = events;
    context.authState.patients = patients;
    context.render();
  } catch (error) {
    context.authState.agendaEvents = [];
    showToast(`Não foi possível carregar a agenda: ${error.message}`);
    context.render();
  }
}

function openEditor(context, event = null, type = "appointment", date = agendaUi.anchor) {
  agendaUi.draft = event ? { ...event } : blankDraft(type, date);
  agendaUi.editorOpen = true;
  context.render();
}

function closeEditor() {
  agendaUi.editorOpen = false;
  agendaUi.draft = null;
  document.getElementById("agenda-dialog")?.close();
}

function updateEditorVisibility() {
  const form = document.getElementById("agenda-form");
  if (!form) return;
  const isBlock = form.elements.type.value === "block";
  const guest = form.elements.patientId?.value === "__guest";
  const heading = document.querySelector(".agenda-dialog-header h2");
  const title = form.elements.title;
  const color = form.elements.color;
  if (heading) heading.textContent = isBlock ? "Bloqueio de horário" : "Compromisso";
  if (title?.value === "Atendimento" && isBlock) title.value = "Indisponível";
  else if (title?.value === "Indisponível" && !isBlock) title.value = "Atendimento";
  if (color) {
    if (isBlock && color.value === "#25636f") color.value = "#657076";
    else if (!isBlock && color.value === "#657076") color.value = "#25636f";
  }
  document.querySelector(".agenda-appointment-fields")?.toggleAttribute("hidden", isBlock);
  document.querySelector(".agenda-guest-field")?.toggleAttribute("hidden", isBlock || !guest);
  if (form.elements.guestName) form.elements.guestName.required = !isBlock && guest;
}

export function bindAgenda(context) {
  if (context.authState.role !== "professional") return;

  document.getElementById("agenda-previous")?.addEventListener("click", () => {
    agendaUi.anchor = moveAgendaAnchor(agendaUi.anchor, agendaUi.view, -1);
    context.render();
  });
  document.getElementById("agenda-next")?.addEventListener("click", () => {
    agendaUi.anchor = moveAgendaAnchor(agendaUi.anchor, agendaUi.view, 1);
    context.render();
  });
  document.getElementById("agenda-today")?.addEventListener("click", () => {
    agendaUi.anchor = todayISO();
    context.render();
  });
  document.querySelectorAll("[data-agenda-view]").forEach((button) => {
    button.addEventListener("click", () => {
      agendaUi.view = button.dataset.agendaView;
      context.render();
    });
  });
  document.querySelectorAll("[data-open-day]").forEach((button) => {
    button.addEventListener("click", () => {
      agendaUi.anchor = button.dataset.openDay;
      agendaUi.view = "day";
      context.render();
    });
  });
  document.querySelectorAll("[data-create-on-date]").forEach((button) => {
    button.addEventListener("click", () => openEditor(context, null, "appointment", button.dataset.createOnDate));
  });
  document.querySelectorAll("[data-new-agenda-event]").forEach((button) => {
    button.addEventListener("click", () => openEditor(context, null, button.dataset.newAgendaEvent));
  });
  document.querySelectorAll("[data-agenda-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = (context.authState.agendaEvents || []).find((item) => item.id === button.dataset.agendaEvent);
      if (event) openEditor(context, event);
    });
  });

  [
    ["agenda-filter-status", "status"],
    ["agenda-filter-patient", "patient"],
    ["agenda-filter-location", "location"]
  ].forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener("change", (event) => {
      agendaUi.filters[key] = event.target.value;
      context.render();
    });
  });
  document.getElementById("agenda-clear-filters")?.addEventListener("click", () => {
    agendaUi.filters = { status: "", patient: "", location: "" };
    context.render();
  });
  document.getElementById("refresh-agenda")?.addEventListener("click", () => refreshAgenda(context));

  const dialog = document.getElementById("agenda-dialog");
  if (dialog) {
    if (!dialog.open) dialog.showModal();
    dialog.addEventListener("cancel", () => {
      agendaUi.editorOpen = false;
      agendaUi.draft = null;
    });
  }
  document.getElementById("close-agenda-dialog")?.addEventListener("click", closeEditor);
  document.getElementById("cancel-agenda-dialog")?.addEventListener("click", closeEditor);
  document.querySelectorAll('input[name="type"]').forEach((input) => input.addEventListener("change", updateEditorVisibility));
  document.getElementById("agenda-patient")?.addEventListener("change", updateEditorVisibility);
  updateEditorVisibility();

  document.getElementById("agenda-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const existing = (context.authState.agendaEvents || []).find((item) => item.id === data.eventId) || null;
    const patient = (context.authState.patients || []).find((item) => patientId(item) === data.patientId);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      await saveAgendaEvent(context.authState.user.uid, {
        ...data,
        patientId: patient ? patientId(patient) : "",
        patientName: patient?.name || patient?.email || "",
        guestName: data.patientId === "__guest" ? data.guestName : "",
        timeZone: existing?.timeZone
      }, existing);
      agendaUi.editorOpen = false;
      agendaUi.draft = null;
      showToast(existing ? "Compromisso atualizado." : "Item adicionado à agenda.");
      await refreshAgenda(context);
    } catch (error) {
      submit.disabled = false;
      showToast(`Não foi possível salvar: ${error.message}`);
    }
  });

  document.getElementById("delete-agenda-event")?.addEventListener("click", async () => {
    const event = agendaUi.draft;
    if (!event?.id || !confirmAction("Excluir este item da agenda?")) return;
    try {
      await deleteAgendaEvent(context.authState.user.uid, event.id);
      agendaUi.editorOpen = false;
      agendaUi.draft = null;
      showToast("Item excluído da agenda.");
      await refreshAgenda(context);
    } catch (error) {
      showToast(`Não foi possível excluir: ${error.message}`);
    }
  });

  if (context.authState.agendaEvents === null) refreshAgenda(context);
}
