import {
  listInvitationsForProfessional,
  listPatientsForProfessional
} from "../data/firestore-store.js";
import {
  cancelProfessionalInvitation,
  createProfessionalInvitation,
  endProfessionalCareEpisode,
  loadProfessionalAccessSummary
} from "../services/professional-access-service.js";
import { confirmAction } from "../components/modal.js";
import { requestCareEndDetails } from "../components/care-end-dialog.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatPhone } from "../utils/phone-utils.js";
import { ageFromBirthDate, formatDate } from "../utils/date-utils.js";
import { professionalAudienceTerms } from "../data/professional-catalog.js";
import { invitationIsPending } from "../utils/invitation-utils.js";

const invitationLabels = {
  pending: "Pendente",
  accepted: "Aceito",
  rejected: "Recusado",
  cancelled: "Cancelado"
};

const sexLabels = { male: "Masculino", female: "Feminino" };
const goalLabels = {
  "weight-loss": "Emagrecimento",
  "weight-gain": "Ganho de peso",
  "muscle-gain": "Ganho de massa muscular",
  maintenance: "Manutenção",
  recovery: "Recuperação de peso",
  other: "Outro"
};

function maskEmail(email = "") {
  const [name, domain] = String(email).split("@");
  if (!domain) return email || "-";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(6, name.length - visible.length)))}@${domain}`;
}

function initials(name = "") {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function firestoreDate(value) {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleDateString("pt-BR");
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return formatDate(value.slice(0, 10));
  return "-";
}

function projectStatus(patient) {
  return patient.activeCycle?.status === "active" ? "Projeto ativo" : "Sem projeto ativo";
}

function latestRecord(patient) {
  if (!patient.lastRecord) return `<span class="muted">Nenhum registro</span>`;
  const type = patient.lastRecord.type === "activity" ? "Atividade" : "Medidas";
  return `<strong>${type}</strong><small>${formatDate(patient.lastRecord.date)}</small>`;
}

function recordDate(patient, key) {
  return patient[key]?.date || "";
}

function daysWithoutRecord(dateISO) {
  if (!dateISO) return Number.POSITIVE_INFINITY;
  const date = new Date(`${String(dateISO).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - date) / 86400000));
}

function detailItem(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`;
}

function patientDialogs(patients, terms) {
  return patients.map((patient) => {
    const id = escapeAttribute(patient.uid || patient.id);
    const profile = patient.profile || {};
    const cycle = patient.activeCycle;
    const age = ageFromBirthDate(profile.birthDate);
    return `
      <dialog class="patient-dialog" id="patient-details-${id}">
        <div class="patient-dialog-content">
          <header class="patient-dialog-header">
            <div><span class="patient-avatar">${escapeHtml(initials(patient.name))}</span><h2>${escapeHtml(patient.name || "Sem nome")}</h2></div>
            <button class="icon-button" type="button" data-close-patient-dialog aria-label="Fechar">×</button>
          </header>
          <dl class="patient-detail-list">
            ${detailItem("E-mail", patient.email)}
            ${detailItem("Telefone compartilhado", patient.phone ? formatPhone(patient.phone) : "Não compartilhado")}
            ${detailItem("Sexo", sexLabels[profile.sex] || "Não informado")}
            ${detailItem("Idade", age !== null ? `${age} anos` : "Não informada")}
            ${detailItem("Altura", profile.heightCm ? `${profile.heightCm} cm` : "Não informada")}
            ${detailItem("Vínculo desde", firestoreDate(patient.link?.createdAt))}
          </dl>
          <footer class="patient-dialog-actions">
            <button class="button danger" type="button" data-end-patient-care="${id}"
              aria-label="Encerrar acompanhamento" title="Encerrar acompanhamento">Encerrar</button>
            <button class="button" type="button" data-close-patient-dialog>Fechar</button>
          </footer>
        </div>
      </dialog>
      <dialog class="patient-dialog" id="patient-project-${id}">
        <div class="patient-dialog-content">
          <header class="patient-dialog-header">
            <div><span class="eyebrow">Projeto atual</span><h2>${escapeHtml(cycle?.name || "Sem projeto ativo")}</h2></div>
            <button class="icon-button" type="button" data-close-patient-dialog aria-label="Fechar">×</button>
          </header>
          ${cycle ? `<dl class="patient-detail-list">
            ${detailItem("Status", cycle.status === "active" ? "Ativo" : cycle.status)}
            ${detailItem("Objetivo", goalLabels[cycle.goalType] || cycle.customGoalLabel || "Não definido")}
            ${detailItem("Início", firestoreDate(cycle.startedAt))}
            ${detailItem("Peso inicial", cycle.startWeightKg ? `${cycle.startWeightKg} kg` : "Não informado")}
            ${detailItem("Peso final desejado", cycle.goalWeightKg ? `${cycle.goalWeightKg} kg` : "Não definido")}
            ${detailItem("Prazo", cycle.goalDeadlineMonths ? `${cycle.goalDeadlineMonths} meses` : "Não definido")}
          </dl>` : `<p class="muted">Este ${terms.singular} ainda não iniciou um projeto de acompanhamento.</p>`}
          <footer class="patient-dialog-actions">
            <button class="button" type="button" data-close-patient-dialog>Fechar</button>
            <button class="button primary" type="button" data-open-patient="${id}">${cycle ? "Acompanhar projeto" : "Criar projeto"}</button>
          </footer>
        </div>
      </dialog>`;
  }).join("");
}

function invitationLink(invitationId) {
  const url = new URL("login.html", location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("invite", invitationId);
  return url.href;
}

export function renderPatients(state, authState) {
  if (authState.role !== "professional") {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é destinada a profissionais.</p></section>`;
  }

  const patients = authState.patients || [];
  const terms = professionalAudienceTerms(authState.professionalProfile?.professionType);
  const invitations = (authState.sentInvitations || []).filter(invitationIsPending);
  const access = authState.professionalAccessSummary || {
    seatLimit: 20,
    usedSeats: patients.length + invitations.length,
    availableSeats: Math.max(0, 20 - patients.length - invitations.length),
    invitationsEnabled: true
  };
  const canInvite = access.invitationsEnabled && access.availableSeats > 0;
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Meus ${terms.plural} <span class="badge">${patients.length}</span></h2>
            <p class="muted">Abra um acompanhamento para consultar dashboard, registros e planejamento.</p>
            <p class="professional-capacity" aria-label="${access.usedSeats} de ${access.seatLimit} vagas utilizadas">
              <strong>${access.usedSeats} de ${access.seatLimit}</strong> vagas utilizadas
              <span>${access.availableSeats} ${access.availableSeats === 1 ? "disponível" : "disponíveis"}</span>
            </p>
          </div>
          <div class="button-row">
            <button class="button primary" id="open-invite-patient" type="button" ${canInvite ? "" : "disabled"}>Convidar pessoa</button>
            <button class="button" id="refresh-patients" type="button">Atualizar</button>
          </div>
        </div>
        ${patients.length ? `<div class="patient-roster-tools">
          <div class="patient-search field"><label class="sr-only" for="patient-search">Buscar acompanhamento</label><input id="patient-search" type="search" placeholder="Buscar por nome ou e-mail" autocomplete="off" /></div>
          <button class="icon-button agenda-filter-toggle" id="toggle-patient-filters" type="button"
            aria-label="Filtros dos acompanhamentos" title="Filtros" aria-expanded="false">
            <span class="filter-icon" aria-hidden="true"><i></i><i></i><i></i></span>
            <b id="patient-filter-count" hidden>0</b>
          </button>
        </div>
        <div class="patient-filter-fields" id="patient-filter-fields" hidden>
          <div class="field"><label for="patient-project-filter">Projeto</label><select id="patient-project-filter"><option value="all">Todos</option><option value="active">Projeto ativo</option><option value="none">Sem projeto ativo</option></select></div>
          <div class="field"><label for="patient-record-filter">Situação dos registros</label><select id="patient-record-filter"><option value="all">Todos os registros</option><option value="none">Sem nenhum registro</option><option value="no-measurement">Sem registro de medidas</option><option value="no-activity">Sem registro de atividade</option><option value="30">Último registro há mais de 30 dias</option></select></div>
          <button class="button text-button patient-clear-filters" id="patient-clear-filters" type="button">Limpar filtros</button>
        </div>
        <div class="patient-filter-summary" aria-live="polite"><strong id="patient-visible-count">${patients.length}</strong> de ${patients.length} acompanhamentos</div>` : ""}
        <div class="patient-roster" role="table" aria-label="Acompanhamentos vinculados">
          <div class="patient-roster-header" role="row">
            <span><button class="patient-sort-button" type="button" data-patient-sort="name">${terms.singularTitle}<i aria-hidden="true">↕</i></button></span>
            <span>Projeto</span>
            <span><button class="patient-sort-button is-active" type="button" data-patient-sort="record">Último registro<i aria-hidden="true">↓</i></button></span>
            <span>Vínculo</span><span>Ação</span>
          </div>
          ${patients.map((patient) => {
            const id = escapeAttribute(patient.uid || patient.id);
            const lastDate = recordDate(patient, "lastRecord");
            return `<article class="patient-roster-row" role="row"
              data-patient-search="${escapeAttribute(`${patient.name || ""} ${patient.email || ""}`.toLocaleLowerCase("pt-BR"))}"
              data-patient-name="${escapeAttribute(patient.name || patient.email || "")}"
              data-project-status="${patient.activeCycle?.status === "active" ? "active" : "none"}"
              data-last-record="${escapeAttribute(lastDate)}"
              data-last-record-days="${daysWithoutRecord(lastDate)}"
              data-last-measurement="${escapeAttribute(recordDate(patient, "lastMeasurement"))}"
              data-last-activity="${escapeAttribute(recordDate(patient, "lastActivity"))}"
              data-link-date="${escapeAttribute(patient.link?.createdAt?.seconds || patient.link?.createdAt || "")}">
              <div class="patient-identity" role="cell">
                <span class="patient-avatar">${escapeHtml(initials(patient.name))}</span>
                <span><button class="patient-name-button" type="button" data-show-patient="${id}">${escapeHtml(patient.name || "Sem nome")}</button><small>${escapeHtml(maskEmail(patient.email))}</small></span>
              </div>
              <div role="cell" data-label="Projeto"><button class="patient-project-button" type="button" data-show-project="${id}">${escapeHtml(projectStatus(patient))}</button></div>
              <div class="patient-latest" role="cell" data-label="Último registro">${latestRecord(patient)}</div>
              <div role="cell" data-label="Vínculo"><span class="badge">Ativo</span></div>
              <div role="cell"><button class="button primary patient-follow-button" data-open-patient="${id}" type="button">Acompanhar</button></div>
            </article>`;
          }).join("") || `<div class="patient-roster-empty">Nenhum acompanhamento vinculado.</div>`}
          <div class="patient-roster-empty" id="patient-filter-empty" hidden>Nenhum acompanhamento corresponde aos filtros.</div>
        </div>
      </section>

      <dialog class="patient-dialog" id="invite-patient-dialog">
        <form class="patient-dialog-content form" id="invite-patient-form">
          <header class="patient-dialog-header">
            <div><span class="eyebrow">Novo vínculo</span><h2>Convidar pessoa</h2></div>
            <button class="icon-button" id="close-invite-patient" type="button" aria-label="Fechar">×</button>
          </header>
          <p class="muted">Informe o e-mail usado ou que será usado pela pessoa no FitBodyStat.</p>
          <div class="field"><label for="patient-email">E-mail</label><input id="patient-email" name="email" type="email" autocomplete="email" required /></div>
          <footer class="patient-dialog-actions"><button class="button" id="cancel-invite-patient" type="button">Cancelar</button><button class="button primary" type="submit">Criar convite</button></footer>
        </form>
      </dialog>

      <details class="card pending-invitations" ${invitations.length ? "open" : ""}>
        <summary><span>Convites aguardando resposta</span><span class="badge">${invitations.length}</span></summary>
        <div class="pending-invitation-list">
          ${invitations.map((invitation) => `<div class="pending-invitation-item">
            <div><strong>${escapeHtml(invitation.patientEmailLower)}</strong><small>${invitationLabels[invitation.status] || invitation.status}</small></div>
            <div class="button-row"><button class="button primary" data-share-invitation="${invitation.id}" type="button">Compartilhar link</button><button class="button" data-cancel-invitation="${invitation.id}" type="button">Cancelar</button></div>
          </div>`).join("") || `<p class="muted">Nenhum convite pendente.</p>`}
        </div>
      </details>
      ${patientDialogs(patients, terms)}
    </div>
  `;
}

export function bindPatients(context) {
  const terms = professionalAudienceTerms(context.authState.professionalProfile?.professionType);
  const refresh = async () => {
    try {
      const [patients, invitations, accessSummary] = await Promise.all([
        listPatientsForProfessional(context.authState.user.uid),
        listInvitationsForProfessional(context.authState.user.uid),
        loadProfessionalAccessSummary()
      ]);
      context.authState.patients = patients;
      context.authState.sentInvitations = invitations;
      context.authState.professionalAccessSummary = accessSummary;
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar os acompanhamentos: ${error.message}`);
    }
  };

  document.getElementById("refresh-patients")?.addEventListener("click", refresh);

  const search = document.getElementById("patient-search");
  const projectFilter = document.getElementById("patient-project-filter");
  const recordFilter = document.getElementById("patient-record-filter");
  const filterToggle = document.getElementById("toggle-patient-filters");
  const filterFields = document.getElementById("patient-filter-fields");
  const roster = document.querySelector(".patient-roster");
  const rows = [...document.querySelectorAll("[data-patient-search]")];
  let sortKey = "record";
  let sortDirection = "desc";

  const applyPatientFilters = () => {
    const term = search?.value.trim().toLocaleLowerCase("pt-BR") || "";
    const project = projectFilter?.value || "all";
    const record = recordFilter?.value || "all";
    let visible = 0;
    rows.forEach((row) => {
      const matchesSearch = !term || row.dataset.patientSearch.includes(term);
      const matchesProject = project === "all" || row.dataset.projectStatus === project;
      let matchesRecord = true;
      if (record === "none") matchesRecord = !row.dataset.lastRecord;
      else if (record === "no-measurement") matchesRecord = !row.dataset.lastMeasurement;
      else if (record === "no-activity") matchesRecord = !row.dataset.lastActivity;
      else if (/^\d+$/.test(record)) matchesRecord = Number(row.dataset.lastRecordDays) > Number(record);
      row.hidden = !(matchesSearch && matchesProject && matchesRecord);
      if (!row.hidden) visible += 1;
    });

    const sorted = [...rows].sort((a, b) => {
      const comparison = sortKey === "name"
        ? a.dataset.patientName.localeCompare(b.dataset.patientName, "pt-BR")
        : String(a.dataset.lastRecord).localeCompare(String(b.dataset.lastRecord));
      return sortDirection === "asc" ? comparison : -comparison;
    });
    const empty = document.getElementById("patient-filter-empty");
    sorted.forEach((row) => roster?.insertBefore(row, empty));

    const activeFilters = Number(project !== "all") + Number(record !== "all");
    const filterCount = document.getElementById("patient-filter-count");
    if (filterCount) {
      filterCount.textContent = activeFilters;
      filterCount.hidden = activeFilters === 0;
    }
    const visibleCount = document.getElementById("patient-visible-count");
    if (visibleCount) visibleCount.textContent = visible;
    if (empty) empty.hidden = visible !== 0;
  };

  [search, projectFilter, recordFilter].forEach((control) => {
    control?.addEventListener(control === search ? "input" : "change", applyPatientFilters);
  });
  filterToggle?.addEventListener("click", () => {
    const willOpen = filterFields?.hidden !== false;
    if (filterFields) filterFields.hidden = !willOpen;
    filterToggle.setAttribute("aria-expanded", String(willOpen));
  });
  document.addEventListener("click", (event) => {
    if (!filterFields || filterFields.hidden) return;
    if (filterFields.contains(event.target) || filterToggle?.contains(event.target)) return;
    filterFields.hidden = true;
    filterToggle?.setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll("[data-patient-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.patientSort;
      if (sortKey === nextKey) sortDirection = sortDirection === "asc" ? "desc" : "asc";
      else {
        sortKey = nextKey;
        sortDirection = nextKey === "name" ? "asc" : "desc";
      }
      document.querySelectorAll("[data-patient-sort]").forEach((item) => {
        const active = item.dataset.patientSort === sortKey;
        item.classList.toggle("is-active", active);
        const indicator = item.querySelector("i");
        if (indicator) indicator.textContent = active ? (sortDirection === "asc" ? "↑" : "↓") : "↕";
      });
      applyPatientFilters();
    });
  });
  document.getElementById("patient-clear-filters")?.addEventListener("click", () => {
    if (projectFilter) projectFilter.value = "all";
    if (recordFilter) recordFilter.value = "all";
    applyPatientFilters();
    if (filterFields) filterFields.hidden = true;
    filterToggle?.setAttribute("aria-expanded", "false");
  });
  applyPatientFilters();

  const inviteDialog = document.getElementById("invite-patient-dialog");
  document.getElementById("open-invite-patient")?.addEventListener("click", () => inviteDialog?.showModal());
  document.getElementById("close-invite-patient")?.addEventListener("click", () => inviteDialog?.close());
  document.getElementById("cancel-invite-patient")?.addEventListener("click", () => inviteDialog?.close());
  inviteDialog?.addEventListener("click", (event) => {
    if (event.target === inviteDialog) inviteDialog.close();
  });

  document.getElementById("invite-patient-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (String(email).trim().toLowerCase() === context.authState.user.email?.toLowerCase()) {
      showToast("Use o e-mail de outra conta para enviar o convite.");
      return;
    }
    try {
      const result = await createProfessionalInvitation(email);
      context.authState.professionalAccessSummary = result.summary;
      const url = invitationLink(result.invitationId);
      const shouldShare = await confirmAction({
        title: "Convite criado",
        message: "Se a pessoa já possui uma conta, verá o convite no aplicativo. Caso ainda não possua, compartilhe o link para que ela possa se cadastrar. Nenhum e-mail foi enviado automaticamente.",
        confirmLabel: "Compartilhar link",
        cancelLabel: "Fechar"
      });
      if (shouldShare) {
        const text = `${context.authState.professionalProfile?.name || "Um profissional"} convidou você para o FitBodyStat.`;
        try {
          if (navigator.share) {
            await navigator.share({ title: "Convite FitBodyStat", text, url });
          } else {
            await navigator.clipboard.writeText(url);
            showToast("Link do convite copiado.");
          }
        } catch (shareError) {
          if (shareError.name !== "AbortError") showToast("Convite criado, mas não foi possível compartilhar o link.");
        }
      }
      await refresh();
    } catch (error) {
      showToast(`Não foi possível enviar o convite: ${error.message}`);
    }
  });

  document.querySelectorAll("[data-show-patient]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(`patient-details-${button.dataset.showPatient}`)?.showModal());
  });

  document.querySelectorAll("[data-show-project]").forEach((button) => {
    button.addEventListener("click", () => document.getElementById(`patient-project-${button.dataset.showProject}`)?.showModal());
  });

  document.querySelectorAll("[data-close-patient-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });

  document.querySelectorAll(".patient-dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  document.querySelectorAll("[data-open-patient]").forEach((button) => {
    button.addEventListener("click", async () => {
      const patient = (context.authState.patients || []).find((item) => (item.uid || item.id) === button.dataset.openPatient);
      if (!patient) return;
      try {
        await context.openPatient(patient);
      } catch (error) {
        showToast(`Não foi possível abrir o ${terms.singular}: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-end-patient-care]").forEach((button) => {
    button.addEventListener("click", async () => {
      const patient = (context.authState.patients || [])
        .find((item) => (item.uid || item.id) === button.dataset.endPatientCare);
      if (!patient) return;
      const decision = await requestCareEndDetails(patient.name || `O ${terms.singular}`);
      if (!decision) return;
      button.disabled = true;
      try {
        await endProfessionalCareEpisode(patient.link.id, decision.reasonCode, decision.reasonDetails);
        button.closest("dialog")?.close();
        showToast("Acompanhamento encerrado. A vaga foi liberada e o histórico preservado.");
        await refresh();
      } catch (error) {
        button.disabled = false;
        showToast(`Não foi possível encerrar o acompanhamento: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-cancel-invitation]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await cancelProfessionalInvitation(button.dataset.cancelInvitation);
        showToast("Convite cancelado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível cancelar o convite: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-share-invitation]").forEach((button) => {
    button.addEventListener("click", async () => {
      const invitation = (context.authState.sentInvitations || [])
        .find((item) => item.id === button.dataset.shareInvitation);
      if (!invitation) return;
      const url = invitationLink(invitation.id);
      const text = `${context.personalState.profile?.name || "Um profissional"} convidou você para o FitBodyStat.`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "Convite FitBodyStat", text, url });
        } else {
          await navigator.clipboard.writeText(url);
          showToast("Link do convite copiado.");
        }
      } catch (error) {
        if (error.name !== "AbortError") showToast("Não foi possível compartilhar o link.");
      }
    });
  });

  if (!context.authState.patients || !context.authState.sentInvitations) refresh();
}
