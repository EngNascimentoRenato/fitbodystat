import {
  cancelCareInvitation,
  createCareInvitation,
  listInvitationsForProfessional,
  listPatientsForProfessional,
  revokeCareLink
} from "../data/firestore-store.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatPhone } from "../utils/phone-utils.js";

const invitationLabels = {
  pending: "Pendente",
  accepted: "Aceito",
  rejected: "Recusado",
  cancelled: "Cancelado"
};

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
            <h2>Meus pacientes</h2>
            <p class="muted">Abra um paciente para acompanhar seu dashboard, registros e planejamento.</p>
          </div>
          <button class="button" id="refresh-patients" type="button">Atualizar</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone compartilhado</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${patients.map((patient) => `
                <tr>
                  <td>${escapeHtml(patient.name || "Sem nome")}</td>
                  <td>${escapeHtml(patient.email || "-")}</td>
                  <td>${patient.phone
                    ? `<a href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>`
                    : "-"}</td>
                  <td><span class="badge">Ativo</span></td>
                  <td>
                    <div class="button-row">
                      <button class="button primary" data-open-patient="${escapeAttribute(patient.uid || patient.id)}" type="button">Abrir dashboard</button>
                      <button class="button danger" data-revoke-patient="${escapeAttribute(patient.uid || patient.id)}" type="button">Remover</button>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="5">Nenhum paciente vinculado.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Convidar paciente</h2>
        <p class="muted">O paciente receberá o convite dentro da própria conta e precisará confirmar o vínculo.</p>
        <form class="form" id="invite-patient-form">
          <div class="form-grid">
            <div class="field">
              <label for="patient-email">E-mail cadastrado pelo paciente</label>
              <input id="patient-email" name="email" type="email" required />
            </div>
          </div>
          <div class="button-row"><button class="button primary" type="submit">Enviar convite</button></div>
        </form>
      </section>

      <section class="card">
        <h2>Convites aguardando resposta</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>E-mail</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${invitations.map((invitation) => `
                <tr>
                  <td>${escapeHtml(invitation.patientEmailLower)}</td>
                  <td>${invitationLabels[invitation.status] || invitation.status}</td>
                  <td><button class="button" data-cancel-invitation="${invitation.id}" type="button">Cancelar</button></td>
                </tr>
              `).join("") || `<tr><td colspan="3">Nenhum convite pendente.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
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

  document.getElementById("invite-patient-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    if (String(email).trim().toLowerCase() === context.authState.user.email?.toLowerCase()) {
      showToast("Use o e-mail de outra conta para enviar o convite.");
      return;
    }
    try {
      await createCareInvitation({
        uid: context.authState.user.uid,
        email: context.authState.user.email,
        displayName: context.personalState.profile?.name || context.authState.user.displayName
      }, email);
      showToast("Convite enviado. O paciente precisa aceitá-lo na própria conta.");
      await refresh();
    } catch (error) {
      showToast(`Não foi possível enviar o convite: ${error.message}`);
    }
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

  document.querySelectorAll("[data-revoke-patient]").forEach((button) => {
    button.addEventListener("click", async () => {
      const patient = (context.authState.patients || []).find((item) => (item.uid || item.id) === button.dataset.revokePatient);
      if (!patient || !confirmAction("Encerrar o vínculo com este paciente?")) return;
      try {
        await revokeCareLink(patient.link, context.authState.user.uid);
        showToast("Vínculo encerrado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível encerrar o vínculo: ${error.message}`);
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

  if (!context.authState.patients || !context.authState.sentInvitations) refresh();
}
