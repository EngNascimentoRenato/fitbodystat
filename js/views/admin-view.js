import {
  cancelCareInvitation,
  listAllCareInvitations,
  listAllCareLinks,
  listUsers,
  revokeCareLink,
  updateUserRole,
  updateUserStatus
} from "../data/firestore-store.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

const roleOptions = ["user", "professional", "admin"];
const roleLabels = { user: "Usuário", professional: "Profissional", admin: "Administrador" };

function userName(users, userId) {
  const user = users.find((item) => (item.uid || item.id) === userId);
  return user?.name || user?.email || userId;
}

function statusBadge(status = "active") {
  return status === "suspended"
    ? `<span class="badge warning">Suspenso</span>`
    : `<span class="badge">Ativo</span>`;
}

function overview(users, links, invitations) {
  const activeLinks = links.filter((item) => item.status === "active");
  const pendingInvitations = invitations.filter((item) => item.status === "pending");
  return `
    <div class="view-stack">
      <section class="grid four">
        <article class="stat-card card"><span class="stat-label">Usuários</span><strong class="stat-value">${users.length}</strong><small class="stat-detail">Contas cadastradas</small></article>
        <article class="stat-card card"><span class="stat-label">Profissionais</span><strong class="stat-value">${users.filter((item) => item.role === "professional").length}</strong><small class="stat-detail">Acesso profissional</small></article>
        <article class="stat-card card"><span class="stat-label">Vínculos ativos</span><strong class="stat-value">${activeLinks.length}</strong><small class="stat-detail">Acompanhamentos confirmados</small></article>
        <article class="stat-card card"><span class="stat-label">Convites pendentes</span><strong class="stat-value">${pendingInvitations.length}</strong><small class="stat-detail">Aguardando resposta</small></article>
      </section>
      <section class="card">
        <h2>Operação do sistema</h2>
        <p class="muted">A administração controla cadastros, níveis de acesso, vínculos e convites. Dados corporais e históricos permanecem privados entre usuário e profissional vinculado.</p>
        <button class="button" id="refresh-admin" type="button">Atualizar indicadores</button>
      </section>
    </div>
  `;
}

function usersTable(users, currentUserId, onlyProfessionals = false) {
  const rows = onlyProfessionals ? users.filter((item) => item.role === "professional") : users;
  return `
    <section class="card">
      <div class="chart-header">
        <div>
          <h2>${onlyProfessionals ? "Profissionais" : "Usuários"}</h2>
          <p class="muted">Gerencie cadastro, nível de acesso e situação da conta.</p>
        </div>
        <button class="button" id="refresh-admin" type="button">Atualizar</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Nível</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map((user) => {
              const userId = user.uid || user.id;
              const isCurrentAdmin = userId === currentUserId;
              return `
                <tr>
                  <td>${escapeHtml(user.name || "Nome pendente")}</td>
                  <td>${escapeHtml(user.email || "-")}</td>
                  <td>
                    <select class="table-input" data-role-user="${escapeAttribute(userId)}" ${isCurrentAdmin ? "disabled" : ""}>
                      ${roleOptions.map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${roleLabels[role]}</option>`).join("")}
                    </select>
                  </td>
                  <td>${statusBadge(user.status)}</td>
                  <td>
                    <div class="button-row">
                      <button class="button" data-save-role="${escapeAttribute(userId)}" type="button" ${isCurrentAdmin ? "disabled" : ""}>Salvar nível</button>
                      <button class="button ${user.status === "suspended" ? "" : "danger"}" data-toggle-status="${escapeAttribute(userId)}" type="button" ${isCurrentAdmin ? "disabled" : ""}>
                        ${user.status === "suspended" ? "Reativar" : "Suspender"}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("") || `<tr><td colspan="5">Nenhum cadastro encontrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function linksTable(users, links) {
  const activeLinks = links.filter((item) => item.status === "active");
  return `
    <section class="card">
      <div class="chart-header"><h2>Vínculos ativos</h2><button class="button" id="refresh-admin" type="button">Atualizar</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profissional</th><th>Paciente</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${activeLinks.map((link) => `
              <tr>
                <td>${escapeHtml(userName(users, link.professionalId))}</td>
                <td>${escapeHtml(userName(users, link.patientId))}</td>
                <td><span class="badge">Ativo</span></td>
                <td><button class="button danger" data-admin-revoke="${escapeAttribute(link.id)}" type="button">Encerrar vínculo</button></td>
              </tr>
            `).join("") || `<tr><td colspan="4">Nenhum vínculo ativo.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function invitationsTable(users, invitations) {
  const pending = invitations.filter((item) => item.status === "pending");
  return `
    <section class="card">
      <div class="chart-header"><h2>Convites pendentes</h2><button class="button" id="refresh-admin" type="button">Atualizar</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profissional</th><th>Paciente</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${pending.map((invitation) => `
              <tr>
                <td>${escapeHtml(userName(users, invitation.professionalId))}</td>
                <td>${escapeHtml(invitation.patientEmailLower)}</td>
                <td><span class="badge warning">Pendente</span></td>
                <td><button class="button" data-admin-cancel-invitation="${escapeAttribute(invitation.id)}" type="button">Cancelar</button></td>
              </tr>
            `).join("") || `<tr><td colspan="4">Nenhum convite pendente.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function renderAdmin(state, authState, section = "overview") {
  if (authState.role !== "admin") {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é exclusiva para administradores.</p></section>`;
  }
  const users = authState.adminUsers || [];
  const links = authState.adminLinks || [];
  const invitations = authState.adminInvitations || [];
  if (section === "users") return usersTable(users, authState.user.uid);
  if (section === "professionals") return usersTable(users, authState.user.uid, true);
  if (section === "links") return linksTable(users, links);
  if (section === "invitations") return invitationsTable(users, invitations);
  return overview(users, links, invitations);
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

  document.getElementById("refresh-admin")?.addEventListener("click", refresh);

  document.querySelectorAll("[data-save-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveRole;
      const role = document.querySelector(`[data-role-user="${userId}"]`)?.value;
      try {
        await updateUserRole(userId, role);
        showToast("Nível de acesso atualizado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível atualizar: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-toggle-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.toggleStatus;
      const user = (context.authState.adminUsers || []).find((item) => (item.uid || item.id) === userId);
      if (!user) return;
      const nextStatus = user.status === "suspended" ? "active" : "suspended";
      if (nextStatus === "suspended" && !confirmAction("Suspender o acesso desta conta?")) return;
      try {
        await updateUserStatus(userId, nextStatus);
        showToast(nextStatus === "active" ? "Conta reativada." : "Conta suspensa.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível alterar a conta: ${error.message}`);
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
