import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { listPatientsForProfessional } from "../data/firestore-store.js";
import {
  agendaEventPerson,
  agendaPeriodLabel,
  agendaStatusColor,
  agendaViewDays,
  cancellationBlockInput,
  eventConflicts,
  eventIsWithinAvailability,
  expandRecurringEvents,
  filterAgendaEvents,
  moveAgendaAnchor,
  normalizeAgendaEvent,
  weekDays
} from "../models/agenda-model.js";
import {
  cancelAgendaAppointment,
  deleteAgendaEvent,
  excludeAgendaOccurrence,
  listAgendaEvents,
  loadAgendaAvailability,
  reopenAgendaAppointment,
  saveAgendaAvailability,
  saveAgendaEvent,
  saveAgendaOccurrence,
  splitAgendaSeries,
  truncateAgendaSeries
} from "../services/agenda-service.js";
import { addMonths, formatDate, todayISO } from "../utils/date-utils.js";
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

const bookingModeLabels = {
  exclusive: "Exclusivo",
  group: "Coletivo",
  informational: "Informativo"
};

const weekDayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const agendaUi = {
  view: "week",
  anchor: todayISO(),
  filters: { status: "", patient: "", location: "" },
  filtersOpen: false,
  detailOpen: false,
  detailEventId: null,
  detailOccurrenceDate: null,
  cancelOpen: false,
  reopenOpen: false,
  editorOpen: false,
  draft: null,
  availabilityOpen: false,
  availabilityDraft: null
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

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
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
  return agendaStatusColor(event.status);
}

function renderStatusBadge(status) {
  const tone = status === "cancelled" || status === "no-show"
    ? "danger"
    : status === "confirmed" || status === "completed"
      ? "success"
      : status === "blocked" ? "neutral" : "";
  return `<span class="agenda-status event-status ${tone}" style="--status-color:${agendaStatusColor(status)}">${escapeHtml(statusLabels[status] || status)}</span>`;
}

function renderEventButton(event, compact = false) {
  const sourceId = event.sourceEventId || event.id;
  const recurring = event.recurrence?.frequency === "weekly";
  return `
    <button class="agenda-event ${compact ? "compact" : ""} ${event.type === "block" ? "block" : ""}"
      type="button" data-agenda-event="${escapeAttribute(sourceId)}"
      data-occurrence-date="${escapeAttribute(event.date)}"
      style="--event-color:${eventColor(event)}">
      <span class="agenda-event-time">${escapeHtml(event.startTime)}</span>
      <strong>${escapeHtml(eventTitle(event))}${recurring ? ` <span class="agenda-recurrence-mark" title="Evento recorrente" aria-label="Evento recorrente">↻</span>` : ""}</strong>
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

function availabilityLabel(date, availability) {
  if (!availability?.weekly) return "Horário não configurado";
  const day = weekDays.find((item) => item.index === parseLocalDate(date).getDay());
  const intervals = availability?.weekly?.[day?.key] || [];
  return intervals.length
    ? intervals.map((interval) => `${interval.startTime}–${interval.endTime}`).join(", ")
    : "Não atende";
}

function renderDayView(days, groups, patients, availability) {
  const date = days[0];
  const events = groups[date] || [];
  return `
    <section class="agenda-day" aria-label="Agenda de ${escapeAttribute(formatDate(date))}">
      <header>
        <div>
          <p class="eyebrow">${escapeHtml(shortDayLabel(date))}</p>
          <h2>${events.length} ${events.length === 1 ? "item" : "itens"}</h2>
          <small class="agenda-availability-label">${escapeHtml(availabilityLabel(date, availability))}</small>
        </div>
        <button class="icon-button agenda-add-date" type="button"
          data-create-on-date="${escapeAttribute(date)}"
          aria-label="Adicionar compromisso em ${escapeAttribute(formatDate(date))}"
          title="Adicionar compromisso">+</button>
      </header>
      <div class="agenda-day-list">
        ${events.map((event) => {
          const patient = selectedPatient(event, patients);
          const sourceId = event.sourceEventId || event.id;
          return `
            <article class="agenda-day-event" style="--event-color:${eventColor(event)}">
              <button type="button" data-agenda-event="${escapeAttribute(sourceId)}"
                data-occurrence-date="${escapeAttribute(event.date)}">
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
        }).join("") || `<div class="agenda-empty-day"><p>Nenhum compromisso neste dia.</p><button class="icon-button agenda-add-date" type="button" data-create-on-date="${escapeAttribute(date)}" aria-label="Adicionar compromisso" title="Adicionar compromisso">+</button></div>`}
      </div>
    </section>
  `;
}

function renderWeekView(days, groups, availability) {
  return `
    <div class="agenda-week">
      ${days.map((date) => {
        const events = groups[date] || [];
        return `
          <section class="agenda-week-day ${date === todayISO() ? "today" : ""}">
            <button class="agenda-day-heading" type="button" data-open-day="${escapeAttribute(date)}">
              <span><b>${escapeHtml(shortDayLabel(date))}</b><small>${escapeHtml(availabilityLabel(date, availability))}</small></span>
              <strong>${events.length}</strong>
            </button>
            <div class="agenda-week-events">
              ${events.map((event) => renderEventButton(event)).join("")
                || `<button class="agenda-empty-slot" type="button" data-create-on-date="${escapeAttribute(date)}" aria-label="Adicionar compromisso em ${escapeAttribute(formatDate(date))}" title="Adicionar compromisso">+</button>`}
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
    <div class="agenda-filters" aria-label="Filtros da agenda" ${agendaUi.filtersOpen ? "" : "hidden"}>
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
      <button class="button text-button agenda-clear-filters" data-clear-agenda-filters type="button">Limpar filtros</button>
    </div>
  `;
}

function activeFilterLabels(patients) {
  const labels = [];
  if (agendaUi.filters.status) {
    labels.push(statusLabels[agendaUi.filters.status] || agendaUi.filters.status);
  }
  if (agendaUi.filters.patient) {
    const patient = patients.find((item) => patientId(item) === agendaUi.filters.patient);
    labels.push(agendaUi.filters.patient === "__guest"
      ? "Pessoas avulsas"
      : `Paciente: ${patient?.name || patient?.email || "Selecionado"}`);
  }
  if (agendaUi.filters.location) labels.push(`Local: ${agendaUi.filters.location}`);
  return labels;
}

function renderActiveFilters(patients, resultCount) {
  const labels = activeFilterLabels(patients);
  if (!labels.length) return "";
  return `
    <div class="agenda-active-filters" role="status">
      <div>
        <strong>Filtros ativos</strong>
        <span class="agenda-filter-chips">
          ${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}
        </span>
        <small>${resultCount} ${resultCount === 1 ? "item encontrado" : "itens encontrados"} neste período</small>
      </div>
      <button class="button text-button" data-clear-agenda-filters type="button">Limpar filtros</button>
    </div>
  `;
}

function blankDraft(type = "appointment", date = agendaUi.anchor) {
  const startTime = defaultStartTime(date);
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = Math.min(hours * 60 + minutes + 60, 23 * 60 + 59);
  return {
    type,
    title: type === "block" ? "Indisponível" : "Atendimento",
    date,
    startTime,
    endTime: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
    durationMinutes: 60,
    allDay: false,
    patientId: "",
    patientName: "",
    guestName: "",
    modality: "in-person",
    location: "",
    status: type === "block" ? "blocked" : "scheduled",
    bookingMode: "exclusive",
    capacity: 2,
    recurrence: { frequency: "none", weekDays: [], untilDate: null },
    privateNotes: ""
  };
}

function renderEditor(patients, professionalProfile = {}) {
  const event = agendaUi.draft || blankDraft();
  const isEdit = Boolean(event.id);
  const isBlock = event.type === "block";
  const patientValue = event.patientId || "__guest";
  const patient = selectedPatient(event, patients);
  const locations = (professionalProfile.locations || []).filter((location) => location?.name);
  const knownLocation = locations.find((location) => location.name === event.location);
  const locationChoice = event.location ? knownLocation?.name || "__custom" : "";
  const bookingMode = event.bookingMode || "exclusive";
  const recurrence = event.recurrence || { frequency: "none", weekDays: [], untilDate: null };
  const recurrenceDays = new Set(recurrence.weekDays || []);
  const occurrenceDate = event._occurrenceDate || event.date;
  const isRecurringEdit = isEdit && recurrence.frequency === "weekly";
  const endTime = event.endTime || (() => {
    const [hours, minutes] = event.startTime.split(":").map(Number);
    const total = Math.min(hours * 60 + minutes + Number(event.durationMinutes || 60), 1439);
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  })();
  return `
    <dialog class="agenda-dialog" id="agenda-dialog">
      <form class="form agenda-form" id="agenda-form">
        <input type="hidden" name="eventId" value="${escapeAttribute(event.id || "")}" />
        <input type="hidden" name="sourceDate" value="${escapeAttribute(event.date || "")}" />
        <input type="hidden" name="occurrenceDate" value="${escapeAttribute(occurrenceDate)}" />
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">${isEdit ? "Editar agenda" : "Novo item"}</p>
            <h2>${isBlock ? "Bloqueio de horário" : "Compromisso"}</h2>
          </div>
          <button class="icon-button" id="close-agenda-dialog" type="button" aria-label="Fechar">×</button>
        </header>

        ${isEdit ? `
          <input type="hidden" name="type" value="${isBlock ? "block" : "appointment"}" />
          <p class="agenda-fixed-type">
            <strong>Tipo do registro:</strong> ${isBlock ? "Indisponibilidade" : "Compromisso"}
            <small>O tipo é preservado para manter o histórico da agenda.</small>
          </p>
        ` : `
          <div class="agenda-type-switch" role="group" aria-label="Tipo de item">
            <label><input type="radio" name="type" value="appointment" ${!isBlock ? "checked" : ""} /><span>Compromisso</span></label>
            <label><input type="radio" name="type" value="block" ${isBlock ? "checked" : ""} /><span>Indisponibilidade</span></label>
          </div>
        `}
        ${isRecurringEdit ? `
          <fieldset class="agenda-form-section agenda-series-scope">
            <legend>Aplicar alterações</legend>
            <div class="agenda-booking-switch">
              <label>
                <input type="radio" name="editScope" value="occurrence" checked />
                <span><strong>Somente esta ocorrência</strong><small>${formatDate(occurrenceDate)}</small></span>
              </label>
              <label>
                <input type="radio" name="editScope" value="future" />
                <span><strong>Esta e as próximas</strong><small>Divide a série a partir desta data</small></span>
              </label>
              <label>
                <input type="radio" name="editScope" value="series" />
                <span><strong>Toda a série</strong><small>Altera inclusive ocorrências anteriores</small></span>
              </label>
            </div>
          </fieldset>
        ` : ""}

        <fieldset class="agenda-form-section">
          <legend>Quando</legend>
          <div class="field">
            <label for="agenda-date">Data</label>
            <input id="agenda-date" name="date" type="date" required value="${escapeAttribute(occurrenceDate)}" />
          </div>
          <div class="form-grid agenda-appointment-time-fields" ${isBlock ? "hidden" : ""}>
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
          <div class="agenda-block-fields" ${!isBlock ? "hidden" : ""}>
            <label class="consent-option agenda-all-day">
              <input type="checkbox" name="allDay" value="true" ${event.allDay ? "checked" : ""} />
              <span>Bloquear o dia inteiro</span>
            </label>
            <div class="form-grid agenda-block-time-fields" ${event.allDay ? "hidden" : ""}>
              <div class="field">
                <label for="agenda-block-start">Horário inicial</label>
                <input id="agenda-block-start" name="blockStartTime" type="time" value="${escapeAttribute(event.startTime)}" />
              </div>
              <div class="field">
                <label for="agenda-end-time">Horário final</label>
                <input id="agenda-end-time" name="endTime" type="time" value="${escapeAttribute(endTime)}" />
              </div>
            </div>
          </div>
          <div class="field">
            <label for="agenda-recurrence">Repetição</label>
            <select id="agenda-recurrence" name="recurrenceFrequency">
              <option value="none" ${recurrence.frequency !== "weekly" ? "selected" : ""}>Não repetir</option>
              <option value="weekly" ${recurrence.frequency === "weekly" ? "selected" : ""}>Semanalmente</option>
            </select>
          </div>
          <div class="agenda-recurrence-fields" ${recurrence.frequency !== "weekly" ? "hidden" : ""}>
            <fieldset>
              <legend>Dias da semana</legend>
              <div class="agenda-weekday-picker">
                ${weekDays.map((day) => `
                  <label>
                    <input type="checkbox" name="recurrenceWeekDays" value="${day.index}" ${recurrenceDays.has(day.index) ? "checked" : ""} />
                    <span>${day.label.slice(0, 3)}</span>
                  </label>
                `).join("")}
              </div>
            </fieldset>
            <div class="field">
              <label for="agenda-recurrence-until">Repetir até</label>
              <input id="agenda-recurrence-until" name="recurrenceUntilDate" type="date"
                min="${escapeAttribute(occurrenceDate)}"
                value="${escapeAttribute(recurrence.untilDate || "")}" />
            </div>
          </div>
        </fieldset>

        <div class="agenda-appointment-fields" ${isBlock ? "hidden" : ""}>
          <fieldset class="agenda-form-section">
            <legend>Atendimento</legend>
            <div class="form-grid">
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
                <label for="agenda-location-choice">Local ou link</label>
                <select id="agenda-location-choice" name="locationChoice">
                  <option value="" ${!locationChoice ? "selected" : ""}>Não informado</option>
                  ${locations.map((location) =>
                    `<option value="${escapeAttribute(location.name)}" ${locationChoice === location.name ? "selected" : ""}>${escapeHtml(location.name)}</option>`
                  ).join("")}
                  <option value="__custom" ${locationChoice === "__custom" ? "selected" : ""}>Outro local ou link</option>
                </select>
              </div>
              <div class="field agenda-custom-location-field" ${locationChoice !== "__custom" ? "hidden" : ""}>
                <label for="agenda-location-custom">Informe o local ou link</label>
                <input id="agenda-location-custom" name="locationCustom" maxlength="160"
                  value="${escapeAttribute(locationChoice === "__custom" ? event.location : "")}" />
              </div>
            </div>
            ${patient?.phone ? `
              <p class="agenda-contact">
                Telefone compartilhado: <a href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>
              </p>
            ` : ""}
          </fieldset>

          <fieldset class="agenda-form-section">
            <legend>Organização da agenda</legend>
            ${isEdit ? `
              <div class="field agenda-status-field">
                <label for="agenda-status">Estado</label>
                ${event.status === "cancelled" ? `
                  <input type="hidden" name="status" value="cancelled" />
                  <p class="agenda-readonly-value">${renderStatusBadge("cancelled")}</p>
                ` : `
                  <select id="agenda-status" name="status">
                    ${Object.entries(statusLabels)
                      .filter(([value]) => !["blocked", "cancelled"].includes(value))
                      .map(([value, label]) =>
                        `<option value="${value}" ${event.status === value ? "selected" : ""}>${label}</option>`
                      ).join("")}
                  </select>
                `}
              </div>
            ` : `<input type="hidden" name="status" value="scheduled" />`}
            <fieldset class="agenda-booking-field">
              <legend>Ocupação do horário</legend>
              <div class="agenda-booking-switch">
                <label>
                  <input type="radio" name="bookingMode" value="exclusive" ${bookingMode === "exclusive" ? "checked" : ""} />
                  <span><strong>Exclusivo</strong><small>Bloqueia o período para os demais</small></span>
                </label>
                <label>
                  <input type="radio" name="bookingMode" value="group" ${bookingMode === "group" ? "checked" : ""} />
                  <span><strong>Coletivo</strong><small>Permite participantes até a capacidade</small></span>
                </label>
                <label>
                  <input type="radio" name="bookingMode" value="informational" ${bookingMode === "informational" ? "checked" : ""} />
                  <span><strong>Informativo</strong><small>Não bloqueia novos agendamentos</small></span>
                </label>
              </div>
            </fieldset>
            <div class="field agenda-capacity-field" ${bookingMode !== "group" ? "hidden" : ""}>
              <label for="agenda-capacity">Capacidade máxima</label>
              <input id="agenda-capacity" name="capacity" type="number" min="2" max="100" value="${escapeAttribute(event.capacity || 2)}" />
            </div>
          </fieldset>
        </div>

        <fieldset class="agenda-form-section">
          <legend>Detalhes</legend>
          <div class="field">
            <label for="agenda-title">Título</label>
            <input id="agenda-title" name="title" maxlength="80" required value="${escapeAttribute(event.title || "")}" />
          </div>
          <div class="field">
            <label for="agenda-private-notes">Observações privadas</label>
            <textarea id="agenda-private-notes" name="privateNotes" maxlength="1000">${escapeHtml(event.privateNotes || "")}</textarea>
            <span class="help-text">Visíveis somente para você nesta versão.</span>
          </div>
        </fieldset>

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

function detailValue(label, value, options = {}) {
  if (!value && !options.showEmpty) return "";
  return `
    <div class="${options.wide ? "wide" : ""}">
      <dt>${escapeHtml(label)}</dt>
      <dd>${options.html ? value : escapeHtml(value || "Não informado")}</dd>
    </div>
  `;
}

function renderEventDetails(event, patients) {
  if (!event) return "";
  const patient = selectedPatient(event, patients);
  const isBlock = event.type === "block";
  const person = agendaEventPerson(event);
  const timeLabel = event.allDay
    ? "Dia inteiro"
    : `${event.startTime} às ${event.endTime}`;
  const recurrenceLabel = event.recurrence?.frequency === "weekly"
    ? `Semanal até ${formatDate(event.recurrence.untilDate)}`
    : "Não se repete";
  const isRecurring = event.recurrence?.frequency === "weekly";
  return `
    <dialog class="agenda-dialog agenda-details-dialog" id="agenda-details-dialog">
      <article>
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">${isBlock ? "Indisponibilidade" : "Compromisso"}</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <button class="icon-button" id="close-agenda-details" type="button" aria-label="Fechar">×</button>
        </header>

        <div class="agenda-detail-heading">
          <strong>${escapeHtml(formatDate(event.date))} · ${escapeHtml(timeLabel)}</strong>
          ${isBlock || event.status === "cancelled" ? renderStatusBadge(event.status) : `
            <form class="agenda-quick-status" id="agenda-quick-status-form">
              <label class="sr-only" for="agenda-quick-status">Estado do compromisso</label>
              <select id="agenda-quick-status" name="status">
                ${Object.entries(statusLabels)
                  .filter(([value]) => !["blocked", "cancelled"].includes(value))
                  .map(([value, label]) =>
                    `<option value="${value}" ${event.status === value ? "selected" : ""}>${label}</option>`
                  ).join("")}
              </select>
              ${isRecurring ? `
                <select name="statusScope" aria-label="Aplicar estado">
                  <option value="occurrence">Somente esta ocorrência</option>
                  <option value="future">Esta e as próximas</option>
                  <option value="series">Toda a série</option>
                </select>
              ` : ""}
              <button class="button" type="submit">Atualizar estado</button>
            </form>
          `}
        </div>

        <dl class="agenda-detail-grid">
          ${isBlock ? "" : detailValue("Paciente", person, { showEmpty: true })}
          ${detailValue("Modalidade", isBlock ? "" : modalityLabels[event.modality])}
          ${detailValue("Local ou link", isBlock ? "" : event.location)}
          ${detailValue("Ocupação", isBlock ? "" : bookingModeLabels[event.bookingMode] || "Exclusivo")}
          ${event.bookingMode === "group" ? detailValue("Capacidade", `${event.capacity} participantes`) : ""}
          ${detailValue("Repetição", recurrenceLabel)}
          ${patient?.phone ? detailValue(
            "Telefone",
            `<a href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>`,
            { html: true }
          ) : ""}
          ${event.status === "cancelled"
            ? detailValue("Motivo do cancelamento", event.cancellationReason, { wide: true, showEmpty: true })
            : ""}
          ${detailValue("Observações privadas", event.privateNotes, { wide: true })}
        </dl>

        <footer class="agenda-dialog-actions">
          ${!isBlock && event.status === "cancelled"
            ? `<button class="button" id="open-reopen-agenda-event" type="button">Reabrir compromisso</button>`
            : !isBlock && event.status !== "completed"
              ? `<button class="button danger" id="open-cancel-agenda-event" type="button">Cancelar compromisso</button>`
              : "<span></span>"}
          <div class="button-row">
            <button class="button" id="close-agenda-details-secondary" type="button">Fechar</button>
            <button class="button primary" id="edit-agenda-event" type="button">${isRecurring ? "Editar ocorrência ou série" : "Editar"}</button>
          </div>
        </footer>
      </article>
    </dialog>
  `;
}

function renderCancellationDialog(event) {
  if (!event || event.type !== "appointment") return "";
  const isRecurring = event.recurrence?.frequency === "weekly";
  return `
    <dialog class="agenda-dialog agenda-cancel-dialog" id="agenda-cancel-dialog">
      <form class="form" id="agenda-cancel-form">
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">Cancelar compromisso</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <button class="icon-button" id="close-cancel-agenda" type="button" aria-label="Fechar">×</button>
        </header>
        <p class="muted">
          O compromisso continuará no histórico como cancelado.
        </p>
        <div class="field">
          <label for="agenda-cancellation-reason">Motivo do cancelamento <span class="muted">(opcional)</span></label>
          <textarea id="agenda-cancellation-reason" name="reason" maxlength="500"></textarea>
        </div>
        ${isRecurring ? `
          <div class="field">
            <label for="agenda-cancel-scope">Aplicar cancelamento</label>
            <select id="agenda-cancel-scope" name="cancelScope">
              <option value="occurrence">Somente esta ocorrência</option>
              <option value="future">Esta e as próximas</option>
              <option value="series">Toda a série</option>
            </select>
          </div>
        ` : ""}
        <fieldset class="agenda-cancel-options">
          <legend>Bloqueio da agenda</legend>
          <label>
            <input type="radio" name="blockMode" value="none" />
            <span><strong>Não bloquear</strong><small>Somente registra o cancelamento.</small></span>
          </label>
          <label>
            <input type="radio" name="blockMode" value="current" checked />
            <span>
              <strong>Bloquear o horário deste compromisso</strong>
              <small>${escapeHtml(formatDate(event.date))}, das ${escapeHtml(event.startTime)} às ${escapeHtml(event.endTime)}.</small>
            </span>
          </label>
          <label>
            <input type="radio" name="blockMode" value="custom" />
            <span><strong>Definir outro período</strong><small>Escolha uma data e uma faixa de horário diferente.</small></span>
          </label>
        </fieldset>
        <div class="agenda-custom-block-fields" hidden>
          <div class="form-grid">
            <div class="field">
              <label for="agenda-custom-block-date">Data do bloqueio</label>
              <input id="agenda-custom-block-date" name="blockDate" type="date" value="${escapeAttribute(event.date)}" />
            </div>
            <div class="field agenda-custom-time-field">
              <label for="agenda-custom-block-start">Horário inicial</label>
              <input id="agenda-custom-block-start" name="blockStartTime" type="time" value="${escapeAttribute(event.startTime)}" />
            </div>
            <div class="field agenda-custom-time-field">
              <label for="agenda-custom-block-end">Horário final</label>
              <input id="agenda-custom-block-end" name="blockEndTime" type="time" value="${escapeAttribute(event.endTime)}" />
            </div>
          </div>
          <label class="consent-option agenda-all-day">
            <input type="checkbox" name="blockAllDay" value="true" />
            <span>Bloquear o dia inteiro</span>
          </label>
        </div>
        <footer class="agenda-dialog-actions">
          <span></span>
          <div class="button-row">
            <button class="button" id="cancel-cancellation" type="button">Voltar</button>
            <button class="button danger" type="submit">Confirmar cancelamento</button>
          </div>
        </footer>
      </form>
    </dialog>
  `;
}

function renderReopenDialog(event, linkedBlock) {
  if (!event || event.type !== "appointment" || event.status !== "cancelled") return "";
  return `
    <dialog class="agenda-dialog agenda-reopen-dialog" id="agenda-reopen-dialog">
      <form class="form" id="agenda-reopen-form">
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">Reabrir compromisso</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <button class="icon-button" id="close-reopen-agenda" type="button" aria-label="Fechar">×</button>
        </header>
        <p class="muted">
          O cancelamento permanecerá registrado no histórico. O horário será verificado novamente antes da reabertura.
        </p>
        <div class="field">
          <label for="agenda-reopen-status">Novo estado</label>
          <select id="agenda-reopen-status" name="status">
            <option value="scheduled">Agendado</option>
            <option value="confirmed">Confirmado</option>
          </select>
        </div>
        ${linkedBlock ? `
          <label class="consent-option agenda-cancel-block-option">
            <input type="checkbox" name="removeLinkedBlock" value="true" checked />
            <span>
              <strong>Remover o bloqueio criado no cancelamento</strong>
              <small>${linkedBlock.allDay
                ? `${escapeHtml(formatDate(linkedBlock.date))}, dia inteiro.`
                : `${escapeHtml(formatDate(linkedBlock.date))}, das ${escapeHtml(linkedBlock.startTime)} às ${escapeHtml(linkedBlock.endTime)}.`}</small>
            </span>
          </label>
        ` : `<p class="agenda-inline-note">Nenhum bloqueio associado a este cancelamento.</p>`}
        <footer class="agenda-dialog-actions">
          <span></span>
          <div class="button-row">
            <button class="button" id="cancel-reopen-agenda" type="button">Voltar</button>
            <button class="button primary" type="submit">Reabrir</button>
          </div>
        </footer>
      </form>
    </dialog>
  `;
}

function blankAvailability() {
  return {
    slotIntervalMinutes: 30,
    weekly: Object.fromEntries(weekDays.map((day) => [day.key, []]))
  };
}

function renderAvailabilityEditor() {
  const availability = agendaUi.availabilityDraft || blankAvailability();
  return `
    <dialog class="agenda-dialog availability-dialog" id="availability-dialog">
      <form class="form" id="availability-form">
        <header class="agenda-dialog-header">
          <div>
            <p class="eyebrow">Agenda profissional</p>
            <h2>Horários de atendimento</h2>
          </div>
          <button class="icon-button" id="close-availability-dialog" type="button" aria-label="Fechar">×</button>
        </header>
        <p class="muted">Defina um ou mais períodos para cada dia. Compromissos fora desses horários continuam permitidos para você, mas não serão oferecidos em um agendamento futuro.</p>
        <div class="field availability-slot-field">
          <label for="availability-slot">Intervalo sugerido para futuros horários</label>
          <select id="availability-slot" name="slotIntervalMinutes">
            ${[15, 30, 45, 60].map((minutes) =>
              `<option value="${minutes}" ${Number(availability.slotIntervalMinutes) === minutes ? "selected" : ""}>${minutes} minutos</option>`
            ).join("")}
          </select>
        </div>
        <div class="availability-week">
          ${weekDays.map((day) => {
            const intervals = availability.weekly?.[day.key] || [];
            return `
              <section class="availability-day" data-availability-day="${day.key}">
                <header>
                  <label class="consent-option">
                    <input type="checkbox" data-toggle-availability="${day.key}" ${intervals.length ? "checked" : ""} />
                    <strong>${day.label}</strong>
                  </label>
                  <button class="button text-button" type="button" data-add-availability="${day.key}" ${intervals.length ? "" : "hidden"}>Adicionar período</button>
                </header>
                <div class="availability-intervals">
                  ${intervals.map((interval, index) => `
                    <div class="availability-interval">
                      <label><span class="sr-only">Início</span><input type="time" data-availability-start="${day.key}" data-index="${index}" value="${escapeAttribute(interval.startTime)}" /></label>
                      <span>até</span>
                      <label><span class="sr-only">Fim</span><input type="time" data-availability-end="${day.key}" data-index="${index}" value="${escapeAttribute(interval.endTime)}" /></label>
                      <button class="icon-button" type="button" data-remove-availability="${day.key}" data-index="${index}" aria-label="Remover período">×</button>
                    </div>
                  `).join("") || `<span class="availability-closed">Não atende</span>`}
                </div>
              </section>
            `;
          }).join("")}
        </div>
        <footer class="agenda-dialog-actions">
          <span></span>
          <div class="button-row">
            <button class="button" id="cancel-availability-dialog" type="button">Cancelar</button>
            <button class="button primary" type="submit">Salvar horários</button>
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
  const days = agendaViewDays(agendaUi.anchor, agendaUi.view);
  const expandedEvents = expandRecurringEvents(events, days);
  const filteredEvents = filterAgendaEvents(expandedEvents, agendaUi.filters);
  const visibleDates = new Set(days);
  const visibleEvents = filteredEvents.filter((event) => visibleDates.has(event.date));
  const groups = eventsByDate(visibleEvents);
  const appointmentCount = visibleEvents.filter((event) => event.type === "appointment").length;
  const blockCount = visibleEvents.filter((event) => event.type === "block").length;
  const detailSource = events.find((event) => event.id === agendaUi.detailEventId) || null;
  const detailEvent = detailSource && agendaUi.detailOccurrenceDate
    ? expandRecurringEvents([detailSource], [agendaUi.detailOccurrenceDate])[0] || detailSource
    : detailSource;
  const linkedCancellationBlock = detailEvent
    ? events.find((event) =>
      event.type === "block"
      && event.relatedEventId === detailEvent.id
    ) || null
    : null;
  const calendar = agendaUi.view === "day"
    ? renderDayView(days, groups, patients, authState.agendaAvailability)
    : agendaUi.view === "month"
      ? renderMonthView(days, groups, agendaUi.anchor)
      : renderWeekView(days, groups, authState.agendaAvailability);

  return `
    <div class="view-stack agenda-view">
      <section class="agenda-toolbar">
        <div class="agenda-toolbar-main">
          <div class="agenda-navigation">
            <button class="icon-button" id="agenda-previous" type="button" aria-label="Período anterior">‹</button>
            <button class="button" id="agenda-today" type="button">Hoje</button>
            <button class="icon-button" id="agenda-next" type="button" aria-label="Próximo período">›</button>
            <button class="icon-button agenda-refresh-button" id="refresh-agenda" type="button"
              aria-label="Atualizar agenda" title="Atualizar agenda">
              <span aria-hidden="true">⟳</span>
            </button>
            <button class="icon-button agenda-filter-toggle" id="toggle-agenda-filters" type="button"
              aria-label="Filtros" title="Filtros" aria-expanded="${agendaUi.filtersOpen}">
              <span class="filter-icon" aria-hidden="true"><i></i><i></i><i></i></span>
              ${activeFilterLabels(patients).length ? `<b>${activeFilterLabels(patients).length}</b>` : ""}
            </button>
            <button class="button agenda-availability-button" id="open-availability" type="button"
              aria-label="Horários de atendimento" title="Horários de atendimento">
              <span class="agenda-availability-label-full">Horários de atendimento</span>
              <span class="agenda-availability-label-mobile" aria-hidden="true">⋮</span>
            </button>
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
            <button class="button primary" data-new-agenda-event="appointment" type="button">Novo compromisso</button>
          </div>
        </div>
        ${renderFilters(events, patients)}
        ${renderActiveFilters(patients, visibleEvents.length)}
      </section>

      <section class="agenda-calendar" aria-busy="${authState.agendaEvents === null}">
        ${authState.agendaEvents === null
          ? `<div class="empty-state"><p>Carregando agenda...</p></div>`
          : calendar}
      </section>
    </div>
    ${agendaUi.detailOpen ? renderEventDetails(detailEvent, patients) : ""}
    ${agendaUi.cancelOpen ? renderCancellationDialog(detailEvent) : ""}
    ${agendaUi.reopenOpen ? renderReopenDialog(detailEvent, linkedCancellationBlock) : ""}
    ${agendaUi.editorOpen ? renderEditor(patients, authState.professionalProfile) : ""}
    ${agendaUi.availabilityOpen ? renderAvailabilityEditor() : ""}
  `;
}

async function refreshAgenda(context) {
  try {
    const [events, patients, availability] = await Promise.all([
      listAgendaEvents(context.authState.user.uid),
      listPatientsForProfessional(context.authState.user.uid),
      loadAgendaAvailability(context.authState.user.uid)
    ]);
    context.authState.agendaEvents = events;
    context.authState.patients = patients;
    context.authState.agendaAvailability = availability;
    context.render();
  } catch (error) {
    context.authState.agendaEvents = [];
    showToast(`Não foi possível carregar a agenda: ${error.message}`);
    context.render();
  }
}

function openEditor(context, event = null, type = "appointment", date = agendaUi.anchor, occurrenceDate = null) {
  agendaUi.draft = event
    ? { ...event, _occurrenceDate: occurrenceDate || event.date }
    : blankDraft(type, date);
  agendaUi.detailOpen = false;
  agendaUi.cancelOpen = false;
  agendaUi.reopenOpen = false;
  agendaUi.editorOpen = true;
  context.render();
}

function closeEditor() {
  agendaUi.editorOpen = false;
  agendaUi.draft = null;
  document.getElementById("agenda-dialog")?.close();
}

function openEventDetails(context, event, occurrenceDate = event.date) {
  agendaUi.detailEventId = event.id;
  agendaUi.detailOccurrenceDate = occurrenceDate;
  agendaUi.detailOpen = true;
  agendaUi.cancelOpen = false;
  agendaUi.reopenOpen = false;
  context.render();
}

function closeEventDetails() {
  agendaUi.detailOpen = false;
  agendaUi.cancelOpen = false;
  agendaUi.reopenOpen = false;
  agendaUi.detailEventId = null;
  agendaUi.detailOccurrenceDate = null;
  document.getElementById("agenda-details-dialog")?.close();
  document.getElementById("agenda-cancel-dialog")?.close();
  document.getElementById("agenda-reopen-dialog")?.close();
}

function returnToEventDetails(context) {
  agendaUi.cancelOpen = false;
  agendaUi.reopenOpen = false;
  agendaUi.detailOpen = true;
  context.render();
}

function openAvailabilityEditor(context) {
  agendaUi.availabilityDraft = context.authState.agendaAvailability
    ? cloneData(context.authState.agendaAvailability)
    : blankAvailability();
  agendaUi.availabilityOpen = true;
  context.render();
}

function closeAvailabilityEditor() {
  agendaUi.availabilityOpen = false;
  agendaUi.availabilityDraft = null;
  document.getElementById("availability-dialog")?.close();
}

function readAvailabilityDraft() {
  const form = document.getElementById("availability-form");
  const draft = cloneData(agendaUi.availabilityDraft || blankAvailability());
  if (!form) return draft;
  draft.slotIntervalMinutes = Number(form.elements.slotIntervalMinutes.value);
  weekDays.forEach((day) => {
    const starts = [...form.querySelectorAll(`[data-availability-start="${day.key}"]`)];
    draft.weekly[day.key] = starts.map((input) => ({
      startTime: input.value,
      endTime: form.querySelector(`[data-availability-end="${day.key}"][data-index="${input.dataset.index}"]`)?.value || ""
    }));
  });
  return draft;
}

function updateEditorVisibility() {
  const form = document.getElementById("agenda-form");
  if (!form) return;
  const isBlock = form.elements.type.value === "block";
  const guest = form.elements.patientId?.value === "__guest";
  const allDay = form.elements.allDay?.checked === true;
  const recurrence = form.elements.recurrenceFrequency?.value || "none";
  const bookingMode = form.elements.bookingMode?.value || "exclusive";
  const customLocation = form.elements.locationChoice?.value === "__custom";
  const heading = document.querySelector(".agenda-dialog-header h2");
  const title = form.elements.title;
  if (heading) heading.textContent = isBlock ? "Bloqueio de horário" : "Compromisso";
  if (title?.value === "Atendimento" && isBlock) title.value = "Indisponível";
  else if (title?.value === "Indisponível" && !isBlock) title.value = "Atendimento";
  document.querySelector(".agenda-appointment-time-fields")?.toggleAttribute("hidden", isBlock);
  document.querySelector(".agenda-appointment-fields")?.toggleAttribute("hidden", isBlock);
  document.querySelector(".agenda-block-fields")?.toggleAttribute("hidden", !isBlock);
  document.querySelector(".agenda-guest-field")?.toggleAttribute("hidden", isBlock || !guest);
  document.querySelector(".agenda-block-time-fields")?.toggleAttribute("hidden", allDay);
  document.querySelector(".agenda-recurrence-fields")?.toggleAttribute("hidden", recurrence !== "weekly");
  document.querySelector(".agenda-capacity-field")?.toggleAttribute("hidden", bookingMode !== "group");
  document.querySelector(".agenda-custom-location-field")?.toggleAttribute("hidden", !customLocation);
  document.querySelectorAll(".agenda-appointment-time-fields input")
    .forEach((control) => { control.disabled = isBlock; });
  document.querySelectorAll(".agenda-appointment-fields input, .agenda-appointment-fields select")
    .forEach((control) => { control.disabled = isBlock; });
  document.querySelectorAll(".agenda-block-fields input, .agenda-block-fields select")
    .forEach((control) => { control.disabled = !isBlock; });
  if (form.elements.blockStartTime) form.elements.blockStartTime.disabled = !isBlock || allDay;
  if (form.elements.endTime) form.elements.endTime.disabled = !isBlock || allDay;
  if (form.elements.guestName) form.elements.guestName.required = !isBlock && guest;
  if (form.elements.locationCustom) {
    form.elements.locationCustom.disabled = isBlock || !customLocation;
    form.elements.locationCustom.required = !isBlock && customLocation;
  }
  if (form.elements.capacity) {
    form.elements.capacity.required = !isBlock && bookingMode === "group";
    form.elements.capacity.disabled = isBlock || bookingMode !== "group";
  }
  if (form.elements.recurrenceUntilDate) {
    form.elements.recurrenceUntilDate.required = recurrence === "weekly";
    if (recurrence === "weekly" && !form.elements.recurrenceUntilDate.value) {
      form.elements.recurrenceUntilDate.value = addMonths(form.elements.date.value, 3);
    }
  }
  if (recurrence === "weekly") {
    const checkedDays = [...form.querySelectorAll('input[name="recurrenceWeekDays"]:checked')];
    if (!checkedDays.length && form.elements.date.value) {
      const dayIndex = parseLocalDate(form.elements.date.value).getDay();
      form.querySelector(`input[name="recurrenceWeekDays"][value="${dayIndex}"]`)?.click();
    }
  }
}

function updateCancellationVisibility() {
  const form = document.getElementById("agenda-cancel-form");
  if (!form) return;
  const mode = form.elements.blockMode.value;
  const custom = mode === "custom";
  const allDay = form.elements.blockAllDay.checked;
  const customFields = form.querySelector(".agenda-custom-block-fields");
  customFields?.toggleAttribute("hidden", !custom);
  if (form.elements.blockDate) {
    form.elements.blockDate.disabled = !custom;
    form.elements.blockDate.required = custom;
  }
  [form.elements.blockStartTime, form.elements.blockEndTime].forEach((control) => {
    if (!control) return;
    control.disabled = !custom || allDay;
    control.required = custom && !allDay;
  });
  form.querySelectorAll(".agenda-custom-time-field")
    .forEach((field) => field.toggleAttribute("hidden", custom && allDay));
}

function eventInputFromForm(form, patients) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  const type = data.type === "block" ? "block" : "appointment";
  const patient = patients.find((item) => patientId(item) === data.patientId);
  const allDay = type === "block" && formData.get("allDay") === "true";
  return {
    ...data,
    type,
    startTime: type === "block" ? (allDay ? "00:00" : data.blockStartTime) : data.startTime,
    endTime: type === "block" ? (allDay ? "00:00" : data.endTime) : undefined,
    allDay,
    patientId: patient ? patientId(patient) : "",
    patientName: patient?.name || patient?.email || "",
    guestName: data.patientId === "__guest" ? data.guestName : "",
    location: data.locationChoice === "__custom" ? data.locationCustom : data.locationChoice || "",
    bookingMode: type === "appointment" ? data.bookingMode || "exclusive" : "exclusive",
    recurrence: {
      frequency: data.recurrenceFrequency || "none",
      weekDays: formData.getAll("recurrenceWeekDays").map(Number),
      untilDate: data.recurrenceUntilDate || null,
      excludedDates: agendaUi.draft?.recurrence?.excludedDates || []
    }
  };
}

function occurrenceDates(event) {
  if (event.recurrence?.frequency !== "weekly") return [event.date];
  const dates = [];
  const current = parseLocalDate(event.date);
  const until = parseLocalDate(event.recurrence.untilDate || event.date);
  const days = new Set(event.recurrence.weekDays || []);
  for (let index = 0; current <= until && index < 370; index += 1) {
    if (days.has(current.getDay())) {
      dates.push([
        current.getFullYear(),
        String(current.getMonth() + 1).padStart(2, "0"),
        String(current.getDate()).padStart(2, "0")
      ].join("-"));
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
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
  document.getElementById("open-availability")?.addEventListener("click", () => openAvailabilityEditor(context));
  document.getElementById("toggle-agenda-filters")?.addEventListener("click", () => {
    agendaUi.filtersOpen = !agendaUi.filtersOpen;
    context.render();
  });
  document.querySelectorAll("[data-agenda-event]").forEach((button) => {
    button.addEventListener("click", () => {
      const event = (context.authState.agendaEvents || []).find((item) => item.id === button.dataset.agendaEvent);
      if (event) openEventDetails(context, event, button.dataset.occurrenceDate || event.date);
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
  document.querySelectorAll("[data-clear-agenda-filters]").forEach((button) => {
    button.addEventListener("click", () => {
      agendaUi.filters = { status: "", patient: "", location: "" };
      context.render();
    });
  });
  document.getElementById("refresh-agenda")?.addEventListener("click", () => refreshAgenda(context));

  const detailsDialog = document.getElementById("agenda-details-dialog");
  if (detailsDialog) {
    if (!detailsDialog.open) detailsDialog.showModal();
    detailsDialog.addEventListener("cancel", closeEventDetails);
  }
  document.getElementById("close-agenda-details")?.addEventListener("click", closeEventDetails);
  document.getElementById("close-agenda-details-secondary")?.addEventListener("click", closeEventDetails);
  document.getElementById("edit-agenda-event")?.addEventListener("click", () => {
    const event = (context.authState.agendaEvents || [])
      .find((item) => item.id === agendaUi.detailEventId);
    if (event) openEditor(context, event, event.type, event.date, agendaUi.detailOccurrenceDate);
  });
  document.getElementById("agenda-quick-status-form")?.addEventListener("submit", async (statusEvent) => {
    statusEvent.preventDefault();
    const form = statusEvent.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const source = (context.authState.agendaEvents || [])
      .find((item) => item.id === agendaUi.detailEventId);
    if (!source) return;
    if (source.status === form.elements.status.value) {
      showToast("O compromisso já está com este estado.");
      return;
    }
    submit.disabled = true;
    const statusScope = form.elements.statusScope?.value || "series";
    if (source.recurrence?.frequency === "weekly" && statusScope === "future") {
      try {
        const occurrenceDate = agendaUi.detailOccurrenceDate || source.date;
        const occurrence = expandRecurringEvents([source], [occurrenceDate])[0] || source;
        const result = await splitAgendaSeries(
          context.authState.user.uid,
          source,
          occurrenceDate,
          { ...occurrence, status: form.elements.status.value }
        );
        context.authState.agendaEvents = (context.authState.agendaEvents || [])
          .map((item) => item.id === source.id ? result.source : item)
          .concat(...(result.nextSeries ? [result.nextSeries] : []))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        agendaUi.detailOpen = false;
        agendaUi.detailEventId = null;
        agendaUi.detailOccurrenceDate = null;
        showToast("Estado atualizado nesta e nas próximas ocorrências.");
        context.render();
      } catch (error) {
        submit.disabled = false;
        showToast(`Não foi possível atualizar o estado: ${error.message}`);
      }
      return;
    }
    if (source.recurrence?.frequency === "weekly" && statusScope === "occurrence") {
      try {
        const occurrenceDate = agendaUi.detailOccurrenceDate || source.date;
        const occurrence = expandRecurringEvents([source], [occurrenceDate])[0] || source;
        const result = await saveAgendaOccurrence(
          context.authState.user.uid,
          source,
          occurrenceDate,
          { ...occurrence, status: form.elements.status.value }
        );
        context.authState.agendaEvents = (context.authState.agendaEvents || [])
          .map((item) => item.id === source.id ? result.source : item)
          .concat(result.occurrence)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        agendaUi.detailOpen = false;
        agendaUi.detailEventId = null;
        agendaUi.detailOccurrenceDate = null;
        showToast("Estado atualizado somente nesta ocorrência.");
        context.render();
      } catch (error) {
        submit.disabled = false;
        showToast(`Não foi possível atualizar o estado: ${error.message}`);
      }
      return;
    }
    const previousEvents = [...context.authState.agendaEvents];
    const previousOccurrenceDate = agendaUi.detailOccurrenceDate;
    const candidate = normalizeAgendaEvent(
      { ...source, status: form.elements.status.value },
      context.authState.user.uid,
      source
    );
    context.authState.agendaEvents = previousEvents
      .map((item) => item.id === source.id ? { id: source.id, ...candidate } : item);
    agendaUi.detailOpen = false;
    agendaUi.detailEventId = null;
    agendaUi.detailOccurrenceDate = null;
    context.render();
    try {
      const saved = await saveAgendaEvent(context.authState.user.uid, candidate, source);
      context.authState.agendaEvents = context.authState.agendaEvents
        .map((item) => item.id === source.id ? saved : item);
      showToast("Estado do compromisso atualizado.");
      context.render();
    } catch (error) {
      context.authState.agendaEvents = previousEvents;
      agendaUi.detailOpen = true;
      agendaUi.detailEventId = source.id;
      agendaUi.detailOccurrenceDate = previousOccurrenceDate;
      context.render();
      showToast(`Não foi possível atualizar o estado: ${error.message}`);
    }
  });
  document.getElementById("open-cancel-agenda-event")?.addEventListener("click", () => {
    agendaUi.detailOpen = false;
    agendaUi.cancelOpen = true;
    context.render();
  });
  document.getElementById("open-reopen-agenda-event")?.addEventListener("click", () => {
    agendaUi.detailOpen = false;
    agendaUi.reopenOpen = true;
    context.render();
  });

  const cancellationDialog = document.getElementById("agenda-cancel-dialog");
  if (cancellationDialog) {
    if (!cancellationDialog.open) cancellationDialog.showModal();
    cancellationDialog.addEventListener("cancel", () => returnToEventDetails(context));
  }
  document.getElementById("close-cancel-agenda")?.addEventListener("click", () => returnToEventDetails(context));
  document.getElementById("cancel-cancellation")?.addEventListener("click", () => returnToEventDetails(context));
  document.querySelectorAll('input[name="blockMode"], input[name="blockAllDay"]')
    .forEach((input) => input.addEventListener("change", updateCancellationVisibility));
  updateCancellationVisibility();
  document.getElementById("agenda-cancel-form")?.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const form = submitEvent.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const source = (context.authState.agendaEvents || [])
      .find((item) => item.id === agendaUi.detailEventId);
    if (!source) {
      showToast("Compromisso não encontrado.");
      closeEventDetails();
      context.render();
      return;
    }
    submit.disabled = true;
    try {
      const blockMode = form.elements.blockMode.value;
      const cancelScope = form.elements.cancelScope?.value || "series";
      const occurrenceDate = agendaUi.detailOccurrenceDate || source.date;
      const cancellationTarget = source.recurrence?.frequency === "weekly"
        && cancelScope !== "series"
        ? expandRecurringEvents([source], [occurrenceDate])[0] || source
        : source;
      const blockDetails = {
        date: form.elements.blockDate?.value,
        startTime: form.elements.blockStartTime?.value,
        endTime: form.elements.blockEndTime?.value,
        allDay: form.elements.blockAllDay?.checked === true
      };
      const blockInput = cancellationBlockInput(cancellationTarget, {
        blockMode,
        blockDetails,
        reason: form.elements.reason.value
      });
      if (blockInput) {
        const blockCandidate = {
          id: "cancellation-block",
          ...normalizeAgendaEvent(blockInput, context.authState.user.uid)
        };
        const conflicts = eventConflicts(
          blockCandidate,
          (context.authState.agendaEvents || []).filter((item) => item.id !== source.id)
        );
        if (conflicts.length && !await confirmAction(
          `O bloqueio se sobrepõe a ${conflicts.length} item(ns) da agenda. Cancelar e bloquear mesmo assim?`
        )) {
          submit.disabled = false;
          return;
        }
      }
      if (source.recurrence?.frequency === "weekly" && cancelScope === "future") {
        const result = await splitAgendaSeries(
          context.authState.user.uid,
          source,
          occurrenceDate,
          {
            ...cancellationTarget,
            status: "cancelled",
            cancellationReason: form.elements.reason.value
          }
        );
        let savedBlock = null;
        if (blockInput) {
          savedBlock = await saveAgendaEvent(
            context.authState.user.uid,
            { ...blockInput, relatedEventId: result.nextSeries?.id || result.source.id }
          );
        }
        context.authState.agendaEvents = (context.authState.agendaEvents || [])
          .map((item) => item.id === source.id ? result.source : item)
          .concat(
            ...(result.nextSeries ? [result.nextSeries] : []),
            ...(savedBlock ? [savedBlock] : [])
          )
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        agendaUi.detailOpen = false;
        agendaUi.cancelOpen = false;
        agendaUi.detailEventId = null;
        agendaUi.detailOccurrenceDate = null;
        showToast(savedBlock
          ? "Esta e as próximas ocorrências foram canceladas; o horário atual foi bloqueado."
          : "Esta e as próximas ocorrências foram canceladas.");
        context.render();
        return;
      }
      if (source.recurrence?.frequency === "weekly" && cancelScope === "occurrence") {
        const occurrenceResult = await saveAgendaOccurrence(
          context.authState.user.uid,
          source,
          occurrenceDate,
          {
            ...cancellationTarget,
            status: "cancelled",
            cancellationReason: form.elements.reason.value
          }
        );
        let savedBlock = null;
        if (blockInput) {
          savedBlock = await saveAgendaEvent(
            context.authState.user.uid,
            { ...blockInput, relatedEventId: occurrenceResult.occurrence.id }
          );
        }
        context.authState.agendaEvents = (context.authState.agendaEvents || [])
          .map((item) => item.id === source.id ? occurrenceResult.source : item)
          .concat(occurrenceResult.occurrence, ...(savedBlock ? [savedBlock] : []))
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        agendaUi.detailOpen = false;
        agendaUi.cancelOpen = false;
        agendaUi.detailEventId = null;
        agendaUi.detailOccurrenceDate = null;
        showToast(savedBlock
          ? "Ocorrência cancelada e horário bloqueado."
          : "Ocorrência cancelada.");
        context.render();
        return;
      }
      const result = await cancelAgendaAppointment(context.authState.user.uid, source, {
        reason: form.elements.reason.value,
        blockMode,
        blockDetails
      });
      context.authState.agendaEvents = (context.authState.agendaEvents || [])
        .map((item) => item.id === source.id ? result.appointment : item);
      if (result.block) context.authState.agendaEvents.push(result.block);
      context.authState.agendaEvents.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      agendaUi.detailOpen = false;
      agendaUi.cancelOpen = false;
      agendaUi.reopenOpen = false;
      agendaUi.detailEventId = null;
      showToast(result.block
        ? "Compromisso cancelado e horário bloqueado."
        : "Compromisso cancelado.");
      context.render();
    } catch (error) {
      submit.disabled = false;
      showToast(`Não foi possível cancelar: ${error.message}`);
    }
  });

  const reopenDialog = document.getElementById("agenda-reopen-dialog");
  if (reopenDialog) {
    if (!reopenDialog.open) reopenDialog.showModal();
    reopenDialog.addEventListener("cancel", () => returnToEventDetails(context));
  }
  document.getElementById("close-reopen-agenda")?.addEventListener("click", () => returnToEventDetails(context));
  document.getElementById("cancel-reopen-agenda")?.addEventListener("click", () => returnToEventDetails(context));
  document.getElementById("agenda-reopen-form")?.addEventListener("submit", async (reopenEvent) => {
    reopenEvent.preventDefault();
    const form = reopenEvent.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const source = (context.authState.agendaEvents || [])
      .find((item) => item.id === agendaUi.detailEventId);
    const linkedBlock = (context.authState.agendaEvents || []).find((item) =>
      item.type === "block"
      && item.relatedEventId === source?.id
    ) || null;
    if (!source) return;
    const removeLinkedBlock = linkedBlock && form.elements.removeLinkedBlock?.checked === true;
    const candidate = {
      id: source.id,
      ...normalizeAgendaEvent(
        { ...source, status: form.elements.status.value },
        context.authState.user.uid,
        source
      )
    };
    const conflictEvents = (context.authState.agendaEvents || [])
      .filter((item) => !removeLinkedBlock || item.id !== linkedBlock.id);
    const conflicts = eventConflicts(candidate, conflictEvents);
    if (conflicts.length && !await confirmAction(
      `Há ${conflicts.length} item(ns) ocupando este horário. Reabrir mesmo assim?`
    )) return;
    if (!eventIsWithinAvailability(candidate, context.authState.agendaAvailability)
      && !await confirmAction("Este compromisso está fora dos horários habituais. Reabrir mesmo assim?")) return;

    submit.disabled = true;
    try {
      const result = await reopenAgendaAppointment(context.authState.user.uid, source, {
        status: form.elements.status.value,
        linkedBlock: removeLinkedBlock ? linkedBlock : null
      });
      context.authState.agendaEvents = (context.authState.agendaEvents || [])
        .filter((item) => item.id !== result.removedBlockId)
        .map((item) => item.id === source.id ? result.appointment : item)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      agendaUi.detailOpen = true;
      agendaUi.cancelOpen = false;
      agendaUi.reopenOpen = false;
      showToast(result.removedBlockId
        ? "Compromisso reaberto e bloqueio associado removido."
        : "Compromisso reaberto.");
      context.render();
    } catch (error) {
      submit.disabled = false;
      showToast(`Não foi possível reabrir: ${error.message}`);
    }
  });

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
  document.querySelectorAll('input[name="bookingMode"]').forEach((input) => input.addEventListener("change", updateEditorVisibility));
  document.getElementById("agenda-patient")?.addEventListener("change", updateEditorVisibility);
  document.getElementById("agenda-location-choice")?.addEventListener("change", updateEditorVisibility);
  document.querySelector('input[name="allDay"]')?.addEventListener("change", updateEditorVisibility);
  document.getElementById("agenda-recurrence")?.addEventListener("change", updateEditorVisibility);
  updateEditorVisibility();

  const availabilityDialog = document.getElementById("availability-dialog");
  if (availabilityDialog) {
    if (!availabilityDialog.open) availabilityDialog.showModal();
    availabilityDialog.addEventListener("cancel", () => {
      agendaUi.availabilityOpen = false;
      agendaUi.availabilityDraft = null;
    });
  }
  document.getElementById("close-availability-dialog")?.addEventListener("click", closeAvailabilityEditor);
  document.getElementById("cancel-availability-dialog")?.addEventListener("click", closeAvailabilityEditor);

  document.querySelectorAll("[data-toggle-availability]").forEach((input) => {
    input.addEventListener("change", () => {
      const draft = readAvailabilityDraft();
      draft.weekly[input.dataset.toggleAvailability] = input.checked
        ? draft.weekly[input.dataset.toggleAvailability].length
          ? draft.weekly[input.dataset.toggleAvailability]
          : [{ startTime: "08:00", endTime: "17:00" }]
        : [];
      agendaUi.availabilityDraft = draft;
      context.render();
    });
  });
  document.querySelectorAll("[data-add-availability]").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = readAvailabilityDraft();
      const intervals = draft.weekly[button.dataset.addAvailability];
      const lastEnd = intervals.at(-1)?.endTime || "08:00";
      const [hours, minutes] = lastEnd.split(":").map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = Math.min(startMinutes + 120, 1439);
      intervals.push({
        startTime: startMinutes < 1439 ? lastEnd : "",
        endTime: startMinutes < 1439
          ? `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`
          : ""
      });
      agendaUi.availabilityDraft = draft;
      context.render();
    });
  });
  document.querySelectorAll("[data-remove-availability]").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = readAvailabilityDraft();
      draft.weekly[button.dataset.removeAvailability].splice(Number(button.dataset.index), 1);
      agendaUi.availabilityDraft = draft;
      context.render();
    });
  });
  document.getElementById("availability-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const availability = await saveAgendaAvailability(
        context.authState.user.uid,
        readAvailabilityDraft()
      );
      context.authState.agendaAvailability = availability;
      agendaUi.availabilityOpen = false;
      agendaUi.availabilityDraft = null;
      showToast("Horários de atendimento atualizados.");
      context.render();
    } catch (error) {
      submit.disabled = false;
      showToast(`Não foi possível salvar os horários: ${error.message}`);
    }
  });

  document.getElementById("agenda-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;

    try {
      const input = eventInputFromForm(form, context.authState.patients || []);
      const existing = (context.authState.agendaEvents || []).find((item) => item.id === input.eventId) || null;
      if (existing) input.type = existing.type;
      const recurringEdit = existing?.recurrence?.frequency === "weekly";
      const editScope = recurringEdit
        ? input.editScope || "occurrence"
        : "series";
      if (recurringEdit && editScope === "series") {
        input.date = input.sourceDate || existing.date;
      }
      const candidateInput = recurringEdit && editScope === "occurrence"
        ? {
            ...input,
            date: input.occurrenceDate,
            recurrence: { frequency: "none", weekDays: [], untilDate: null, excludedDates: [] }
          }
        : input;
      const candidate = normalizeAgendaEvent(
        { ...candidateInput, timeZone: existing?.timeZone },
        context.authState.user.uid,
        existing || {}
      );
      const dates = occurrenceDates(candidate);
      const existingOccurrences = expandRecurringEvents(context.authState.agendaEvents || [], dates);
      const candidateOccurrences = expandRecurringEvents(
        [{ id: existing?.id || "candidate", ...candidate }],
        dates
      );
      const conflictingDates = candidateOccurrences
        .filter((occurrence) => eventConflicts(occurrence, existingOccurrences).length)
        .map((occurrence) => occurrence.date);
      if (conflictingDates.length) {
        const recurringCandidate = candidate.recurrence?.frequency === "weekly";
        const proceed = await confirmAction({
          title: recurringCandidate ? "Ignorar datas conflitantes?" : "Conflito de horário",
          message: recurringCandidate
            ? `${conflictingDates.length} ocorrência(s) coincidem com itens existentes. Essas datas não serão criadas.`
            : "Já existe um item ocupando este período. Deseja salvar mesmo assim?",
          confirmLabel: recurringCandidate ? "Ignorar e salvar" : "Salvar mesmo assim",
          tone: "warning"
        });
        if (!proceed) {
          submit.disabled = false;
          return;
        }
        if (recurringCandidate) {
          candidate.recurrence.excludedDates = [...new Set([
            ...(candidate.recurrence.excludedDates || []),
            ...conflictingDates
          ])].sort();
          input.recurrence.excludedDates = candidate.recurrence.excludedDates;
        }
      }
      const outsideAvailability = candidateOccurrences.some((occurrence) =>
        !eventIsWithinAvailability(occurrence, context.authState.agendaAvailability)
      );
      if (outsideAvailability
        && !await confirmAction("Este compromisso está fora dos horários habituais de atendimento. Salvar mesmo assim?")) {
        submit.disabled = false;
        return;
      }

      const previousEvents = [...(context.authState.agendaEvents || [])];
      if (recurringEdit && editScope !== "series") {
        try {
          const result = editScope === "future"
            ? await splitAgendaSeries(
                context.authState.user.uid,
                existing,
                input.occurrenceDate,
                input
              )
            : await saveAgendaOccurrence(
                context.authState.user.uid,
                existing,
                input.occurrenceDate,
                input
              );
          context.authState.agendaEvents = previousEvents
            .map((item) => item.id === existing.id ? result.source : item);
          if (result.occurrence) context.authState.agendaEvents.push(result.occurrence);
          if (result.nextSeries) context.authState.agendaEvents.push(result.nextSeries);
          context.authState.agendaEvents.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          agendaUi.anchor = input.occurrenceDate;
          agendaUi.editorOpen = false;
          agendaUi.draft = null;
          showToast(editScope === "future"
            ? "Esta e as próximas ocorrências foram atualizadas."
            : "Ocorrência atualizada sem alterar a série.");
          context.render();
        } catch (error) {
          submit.disabled = false;
          showToast(`Não foi possível salvar: ${error.message}`);
        }
        return;
      }
      const temporaryId = existing?.id || `local-${Date.now()}`;
      const optimistic = { id: temporaryId, ...candidate };
      context.authState.agendaEvents = existing
        ? previousEvents.map((item) => item.id === existing.id ? optimistic : item)
        : [...previousEvents, optimistic];
      context.authState.agendaEvents.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      agendaUi.anchor = candidate.date;
      agendaUi.editorOpen = false;
      agendaUi.draft = null;
      context.render();

      try {
        const saved = await saveAgendaEvent(context.authState.user.uid, candidate, existing);
        context.authState.agendaEvents = context.authState.agendaEvents
          .map((item) => item.id === temporaryId ? saved : item)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
        const hiddenByFilters = filterAgendaEvents([saved], agendaUi.filters).length === 0;
        showToast(hiddenByFilters
          ? "Item salvo, mas oculto pelos filtros atuais."
          : existing ? "Compromisso atualizado." : "Item adicionado à agenda.");
        context.render();
      } catch (error) {
        context.authState.agendaEvents = previousEvents;
        agendaUi.editorOpen = true;
        agendaUi.draft = existing ? { ...existing } : { ...candidate };
        context.render();
        showToast(`Não foi possível salvar: ${error.message}`);
      }
    } catch (error) {
      submit.disabled = false;
      showToast(`Não foi possível salvar: ${error.message}`);
    }
  });

  document.getElementById("delete-agenda-event")?.addEventListener("click", async () => {
    const event = agendaUi.draft;
    const form = document.getElementById("agenda-form");
    const deleteScope = event?.recurrence?.frequency === "weekly"
      ? form?.elements.editScope?.value || "occurrence"
      : "series";
    const deleteMessage = deleteScope === "occurrence"
      ? "Somente esta ocorrência será removida da série."
      : deleteScope === "future"
        ? "Esta ocorrência e todas as seguintes serão removidas."
        : "Toda a série e suas ocorrências serão removidas permanentemente.";
    if (!event?.id || !await confirmAction({
      title: "Excluir item da agenda?",
      message: deleteMessage,
      confirmLabel: "Excluir",
      tone: "danger"
    })) return;
    const previousEvents = [...(context.authState.agendaEvents || [])];
    agendaUi.editorOpen = false;
    agendaUi.draft = null;
    try {
      if (deleteScope === "occurrence") {
        const updated = await excludeAgendaOccurrence(
          context.authState.user.uid,
          event,
          event._occurrenceDate || event.date
        );
        context.authState.agendaEvents = previousEvents
          .map((item) => item.id === event.id ? updated : item);
        showToast("Ocorrência removida da série.");
      } else if (deleteScope === "future") {
        const updated = await truncateAgendaSeries(
          context.authState.user.uid,
          event,
          event._occurrenceDate || event.date
        );
        context.authState.agendaEvents = updated
          ? previousEvents.map((item) => item.id === event.id ? updated : item)
          : previousEvents.filter((item) => item.id !== event.id);
        showToast("Esta e as próximas ocorrências foram removidas.");
      } else {
        await deleteAgendaEvent(context.authState.user.uid, event.id);
        context.authState.agendaEvents = previousEvents.filter((item) => item.id !== event.id);
        showToast(event.recurrence?.frequency === "weekly"
          ? "Série excluída da agenda."
          : "Item excluído da agenda.");
      }
      context.render();
    } catch (error) {
      context.authState.agendaEvents = previousEvents;
      agendaUi.editorOpen = true;
      agendaUi.draft = event;
      context.render();
      showToast(`Não foi possível excluir: ${error.message}`);
    }
  });

  if (context.authState.agendaEvents === null) refreshAgenda(context);
}
