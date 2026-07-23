import {
  cancelCareInvitation,
  listAllCareLinks,
  listAllCareInvitations,
  listUsers,
  revokeCareLink,
  updateUserRole
} from "../data/firestore-store.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

const roleOptions = ["user", "professional", "admin"];

function userName(users, userId) {
  const user = users.find((item) => (item.uid || item.id) === userId);
  return user?.name || user?.email || userId;
}

export function renderAdmin(state, authState) {
  if (authState.role !== "admin") {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é exclusiva para administradores.</p></section>`;
  }

  const users = authState.adminUsers || [];
  const links = (authState.adminLinks || []).filter((item) => item.status === "active");
  const invitations = (authState.adminInvitations || []).filter((item) => item.status === "pending");
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Usuários</h2>
            <p class="muted">Gerencie os tipos de conta e abra o acompanhamento de um usuário.</p>
          </div>
          <button class="button" id="refresh-users" type="button">Atualizar</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th></th></tr></thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td>${escapeHtml(user.name || "-")}</td>
                  <td>${escapeHtml(user.email || "-")}</td>
                  <td>
                    <select class="table-input" data-role-user="${escapeAttribute(user.uid || user.id)}">
                      ${roleOptions.map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    <div class="button-row">
                      <button class="button" data-save-role="${escapeAttribute(user.uid || user.id)}" type="button">Salvar tipo</button>
                      <button class="button primary" data-open-user="${escapeAttribute(user.uid || user.id)}" type="button">Abrir acompanhamento</button>
                    </div>
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum usuário encontrado.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Vínculos ativos</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Profissional</th><th>Paciente</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${links.map((link) => `
                <tr>
                  <td>${escapeHtml(userName(users, link.professionalId))}</td>
                  <td>${escapeHtml(userName(users, link.patientId))}</td>
                  <td><span class="badge">Ativo</span></td>
                  <td><button class="button danger" data-admin-revoke="${link.id}" type="button">Encerrar vínculo</button></td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum vínculo ativo.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2>Convites pendentes</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Profissional</th><th>Paciente</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${invitations.map((invitation) => `
                <tr>
                  <td>${escapeHtml(userName(users, invitation.professionalId))}</td>
                  <td>${escapeHtml(invitation.patientEmailLower)}</td>
                  <td><span class="badge warning">Pendente</span></td>
                  <td><button class="button" data-admin-cancel-invitation="${invitation.id}" type="button">Cancelar</button></td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum convite pendente.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

export function bindAdmin(context) {
  const refresh = async () => {
    try {
      const [users, links, invitations] = await Promise.all([
        listUsers(),
        listAllCareLinks(),
        listAllCareInvitations()
      ]);
      context.authState.adminUsers = users;
      context.authState.adminLinks = links;
      context.authState.adminInvitations = invitations;
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar a administração: ${error.message}`);
    }
  };

  document.getElementById("refresh-users")?.addEventListener("click", refresh);

  document.querySelectorAll("[data-save-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveRole;
      const role = document.querySelector(`[data-role-user="${userId}"]`)?.value;
      try {
        await updateUserRole(userId, role);
        showToast("Tipo de usuário atualizado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível atualizar: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-open-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const user = (context.authState.adminUsers || []).find((item) => (item.uid || item.id) === button.dataset.openUser);
      if (!user) return;
      try {
        await context.openPatient(user);
      } catch (error) {
        showToast(`Não foi possível abrir o acompanhamento: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-admin-revoke]").forEach((button) => {
    button.addEventListener("click", async () => {
      const link = (context.authState.adminLinks || []).find((item) => item.id === button.dataset.adminRevoke);
      if (!link || !confirmAction("Encerrar este vínculo?")) return;
      try {
        await revokeCareLink(link, context.authState.user.uid);
        showToast("Vínculo encerrado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível encerrar o vínculo: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-admin-cancel-invitation]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await cancelCareInvitation(button.dataset.adminCancelInvitation);
        showToast("Convite cancelado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível cancelar o convite: ${error.message}`);
      }
    });
  });

  if (!context.authState.adminUsers || !context.authState.adminLinks || !context.authState.adminInvitations) refresh();
}
