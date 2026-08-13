import {
  cancelCareInvitation,
  createCareInvitation,
  listInvitationsForProfessional,
  listPatientsForProfessional
} from "../data/firestore-store.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatPhone } from "../utils/phone-utils.js";
import { ageFromBirthDate, formatDate } from "../utils/date-utils.js";

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

function detailItem(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`;
}

function patientDialogs(patients) {
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
          <footer class="patient-dialog-actions"><button class="button" type="button" data-close-patient-dialog>Fechar</button></footer>
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
          </dl>` : `<p class="muted">Este paciente ainda não iniciou um projeto de acompanhamento.</p>`}
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
  const invitations = (authState.sentInvitations || []).filter((item) => item.status === "pending");
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Meus pacientes <span class="badge">${patients.length}</span></h2>
            <p class="muted">Abra um paciente para acompanhar seu dashboard, registros e planejamento.</p>
          </div>
          <div class="button-row">
            <button class="button primary" id="open-invite-patient" type="button">Convidar paciente</button>
            <button class="button" id="refresh-patients" type="button">Atualizar</button>
          </div>
        </div>
        ${patients.length ? `<div class="patient-search field"><label class="sr-only" for="patient-search">Buscar paciente</label><input id="patient-search" type="search" placeholder="Buscar por nome ou e-mail" autocomplete="off" /></div>` : ""}
        <div class="patient-roster" role="table" aria-label="Pacientes vinculados">
          <div class="patient-roster-header" role="row">
            <span>Paciente</span><span>Projeto</span><span>Último registro</span><span>Vínculo</span><span>Ação</span>
          </div>
          ${patients.map((patient) => {
            const id = escapeAttribute(patient.uid || patient.id);
            return `<article class="patient-roster-row" role="row" data-patient-search="${escapeAttribute(`${patient.name || ""} ${patient.email || ""}`.toLocaleLowerCase("pt-BR"))}">
              <div class="patient-identity" role="cell">
                <span class="patient-avatar">${escapeHtml(initials(patient.name))}</span>
                <span><button class="patient-name-button" type="button" data-show-patient="${id}">${escapeHtml(patient.name || "Sem nome")}</button><small>${escapeHtml(maskEmail(patient.email))}</small></span>
              </div>
              <div role="cell" data-label="Projeto"><button class="patient-project-button" type="button" data-show-project="${id}">${escapeHtml(projectStatus(patient))}</button></div>
              <div class="patient-latest" role="cell" data-label="Último registro">${latestRecord(patient)}</div>
              <div role="cell" data-label="Vínculo"><span class="badge">Ativo</span></div>
              <div role="cell"><button class="button primary patient-follow-button" data-open-patient="${id}" type="button">Acompanhar</button></div>
            </article>`;
          }).join("") || `<div class="patient-roster-empty">Nenhum paciente vinculado.</div>`}
        </div>
      </section>

      <dialog class="patient-dialog" id="invite-patient-dialog">
        <form class="patient-dialog-content form" id="invite-patient-form">
          <header class="patient-dialog-header">
            <div><span class="eyebrow">Novo vínculo</span><h2>Convidar paciente</h2></div>
            <button class="icon-button" id="close-invite-patient" type="button" aria-label="Fechar">×</button>
          </header>
          <p class="muted">Informe o e-mail usado ou que será usado pelo paciente no FitBodyStat.</p>
          <div class="field"><label for="patient-email">E-mail do paciente</label><input id="patient-email" name="email" type="email" autocomplete="email" required /></div>
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
      ${patientDialogs(patients)}
    </div>
  `;
}

export function bindPatients(context) {
  const refresh = async () => {
    try {
      const [patients, invitations] = await Promise.all([
        listPatientsForProfessional(context.authState.user.uid),
        listInvitationsForProfessional(context.authState.user.uid)
      ]);
      context.authState.patients = patients;
      context.authState.sentInvitations = invitations;
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar pacientes: ${error.message}`);
    }
  };

  document.getElementById("refresh-patients")?.addEventListener("click", refresh);

  document.getElementById("patient-search")?.addEventListener("input", (event) => {
    const term = event.currentTarget.value.trim().toLocaleLowerCase("pt-BR");
    document.querySelectorAll("[data-patient-search]").forEach((row) => {
      row.hidden = term && !row.dataset.patientSearch.includes(term);
    });
  });

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
      const invitationRef = await createCareInvitation({
        uid: context.authState.user.uid,
        email: context.authState.user.email,
        displayName: context.authState.professionalProfile?.name
          || context.personalState.profile?.name
          || context.authState.user.displayName,
        professionType: context.authState.professionalProfile?.professionType || ""
      }, email);
      const url = invitationLink(invitationRef.id);
      const shouldShare = await confirmAction({
        title: "Convite criado",
        message: "Se o paciente já possui uma conta, verá o convite no aplicativo. Caso ainda não possua, compartilhe o link para que ele possa se cadastrar. Nenhum e-mail foi enviado automaticamente.",
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
        showToast(`Não foi possível abrir o paciente: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-cancel-invitation]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await cancelCareInvitation(button.dataset.cancelInvitation);
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
