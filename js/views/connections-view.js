import {
  listInvitationsForUser,
  listProfessionalsForUser,
  respondToCareInvitation,
  revokeCareLink
} from "../data/firestore-store.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeHtml } from "../utils/html-utils.js";

export function renderConnections(authState) {
  const pending = (authState.invitations || []).filter((item) => item.status === "pending");
  const professionals = authState.professionals || [];

  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Convites pendentes</h2>
            <p class="muted">O acesso aos seus dados só começa depois da sua confirmação.</p>
          </div>
          <button class="button" id="refresh-connections" type="button">Atualizar</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Profissional</th><th>E-mail</th><th>Permissões</th><th></th></tr></thead>
            <tbody>
              ${pending.map((invitation) => `
                <tr>
                  <td>${escapeHtml(invitation.professionalName || "Profissional")}</td>
                  <td>${escapeHtml(invitation.professionalEmail || "-")}</td>
                  <td>Visualizar e atualizar acompanhamento</td>
                  <td>
                    <div class="button-row">
                      <button class="button primary" data-accept-invitation="${invitation.id}" type="button">Aceitar</button>
                      <button class="button" data-reject-invitation="${invitation.id}" type="button">Recusar</button>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum convite pendente.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Profissionais vinculados</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${professionals.map((professional) => `
                <tr>
                  <td>${escapeHtml(professional.name || "Profissional")}</td>
                  <td>${escapeHtml(professional.email || "-")}</td>
                  <td><span class="badge">Ativo</span></td>
                  <td><button class="button danger" data-revoke-link="${professional.link.id}" type="button">Remover vínculo</button></td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum profissional vinculado.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function bindConnections(context) {
  const refresh = async () => {
    try {
      const [invitations, professionals] = await Promise.all([
        listInvitationsForUser(context.authState.user.email),
        listProfessionalsForUser(context.authState.user.uid)
      ]);
      context.authState.invitations = invitations;
      context.authState.professionals = professionals;
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar os vínculos: ${error.message}`);
    }
  };

  document.getElementById("refresh-connections")?.addEventListener("click", refresh);

  const respond = async (invitationId, response) => {
    const invitation = (context.authState.invitations || []).find((item) => item.id === invitationId);
    if (!invitation) return;
    try {
      await respondToCareInvitation(invitation, context.authState.user, response);
      showToast(response === "accepted" ? "Vínculo confirmado." : "Convite recusado.");
      await refresh();
    } catch (error) {
      showToast(`Não foi possível responder ao convite: ${error.message}`);
    }
  };

  document.querySelectorAll("[data-accept-invitation]").forEach((button) => {
    button.addEventListener("click", () => respond(button.dataset.acceptInvitation, "accepted"));
  });
  document.querySelectorAll("[data-reject-invitation]").forEach((button) => {
    button.addEventListener("click", () => respond(button.dataset.rejectInvitation, "rejected"));
  });
  document.querySelectorAll("[data-revoke-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      const professional = (context.authState.professionals || []).find((item) => item.link.id === button.dataset.revokeLink);
      if (!professional || !confirmAction("Remover o acesso deste profissional aos seus dados?")) return;
      try {
        await revokeCareLink(professional.link, context.authState.user.uid);
        showToast("Vínculo removido.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível remover o vínculo: ${error.message}`);
      }
    });
  });

  if (!context.authState.invitations || !context.authState.professionals) refresh();
}
