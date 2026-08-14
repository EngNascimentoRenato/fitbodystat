import {
  listAllCareInvitations,
  listAllCareLinks,
  listPersonalAccessGrants,
  listPersonalAccessRequests,
  listProfessionalAccessRequests,
  listProfessionalRegistrations,
  listUsers,
  updateUserStatus
} from "../data/firestore-store.js";
import {
  cancelProfessionalInvitation,
  decidePersonalAlphaAccess,
  decideProfessionalAlphaAccess,
  endProfessionalCareEpisode,
  grantPersonalAlphaAccess,
  revokePersonalAlphaAccess
} from "../services/professional-access-service.js";
import {
  cancelProfessionalRegistration,
  registerProfessional,
  setUserRole
} from "../services/role-service.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { buildAdminMetrics, formatAdminDate, percentage } from "../services/admin-metrics-service.js";
import { professionalTypeLabel } from "../data/professional-catalog.js";

const roleOptions = ["user", "professional", "admin"];
const roleLabels = { user: "Usuário", professional: "Profissional", admin: "Administrador" };
const registrationStatusLabels = {
  awaiting_registration: "Aguardando cadastro",
  awaiting_validation: "Aguardando validação",
  active: "Ativo",
  cancelled: "Cancelado",
  revoked: "Revogado"
};

function userName(users, userId) {
  const user = users.find((item) => (item.uid || item.id) === userId);
  return user?.name || user?.email || userId;
}

function statusBadge(status = "active") {
  return status === "suspended"
    ? `<span class="badge warning">Suspenso</span>`
    : `<span class="badge">Ativo</span>`;
}

function adminStat(label, value, detail) {
  return `<article class="stat-card card"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><small class="stat-detail">${detail}</small></article>`;
}

function funnelStep(label, value, total) {
  const rate = percentage(value, total);
  return `
    <div class="admin-funnel-step">
      <div><span>${label}</span><strong>${value} <small>${rate}%</small></strong></div>
      <div class="admin-funnel-bar" aria-label="${rate}%"><span style="width:${rate}%"></span></div>
    </div>
  `;
}

function overview(users, links, invitations) {
  const metrics = buildAdminMetrics(users, links, invitations);
  return `
    <div class="view-stack admin-overview">
      <section class="grid four">
        ${adminStat("Usuários", metrics.total, `${metrics.new7} novos em 7 dias`)}
        ${adminStat("Ativos em 7 dias", metrics.active7, `${metrics.active30} ativos em 30 dias`)}
        ${adminStat("Projetos ativos", metrics.activeProjects, `${percentage(metrics.activeProjects, metrics.total)}% das contas`)}
        ${adminStat("Primeiro registro", metrics.firstRecords, `${percentage(metrics.firstRecords, metrics.total)}% das contas`)}
      </section>

      <section class="grid four admin-secondary-stats">
        ${adminStat("Profissionais", metrics.professionals, "Acessos profissionais")}
        ${adminStat("Vínculos ativos", metrics.activeLinks, "Acompanhamentos confirmados")}
        ${adminStat("Convites pendentes", metrics.pendingInvitations, `${metrics.acceptedInvitations} aceitos no total`)}
        ${adminStat("Sem retorno há 30 dias", metrics.stale30, "Contas com telemetria conhecida")}
      </section>

      <div class="grid two admin-insight-grid">
        <section class="card">
          <div class="chart-header"><div><h2>Funil de ativação</h2><p class="muted">Acompanha etapas operacionais, sem acessar dados corporais.</p></div></div>
          <div class="admin-funnel">
            ${funnelStep("Conta criada", metrics.total, metrics.total)}
            ${funnelStep("Perfil concluído", metrics.profileCompleted, metrics.total)}
            ${funnelStep("Projeto ativo", metrics.activeProjects, metrics.total)}
            ${funnelStep("Primeiro registro", metrics.firstRecords, metrics.total)}
            ${funnelStep("Ativo nos últimos 30 dias", metrics.active30, metrics.total)}
          </div>
        </section>

        <section class="card">
          <div class="chart-header"><div><h2>Distribuição técnica</h2><p class="muted">Versões e dispositivos vistos no último acesso.</p></div></div>
          <div class="admin-distribution">
            <div><h3>Versões</h3>${metrics.versions.map(([label, count]) => `<p><span>${escapeHtml(label)}</span><strong>${count}</strong></p>`).join("") || `<p class="muted">Aguardando acessos na nova versão.</p>`}</div>
            <div><h3>Dispositivos</h3>${metrics.devices.map(([label, count]) => `<p><span>${label === "mobile" ? "Celular" : "Desktop"}</span><strong>${count}</strong></p>`).join("") || `<p class="muted">Sem dados de dispositivo.</p>`}</div>
          </div>
          <p class="admin-coverage muted">Cobertura atual: ${metrics.telemetryCoverage} de ${metrics.total} contas. Perfis antigos serão reconhecidos após novo acesso.</p>
        </section>
      </div>

      <section class="card">
        <div class="chart-header">
          <div><h2>Atividade operacional recente</h2><p class="muted">Datas de uso e gravação, sem valores de saúde ou conteúdo pessoal.</p></div>
          <button class="button" id="refresh-admin" type="button">Atualizar</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Conta</th><th>Nível</th><th>Último acesso</th><th>Último registro</th><th>Versão</th></tr></thead>
            <tbody>
              ${metrics.recentUsers.map((user) => `<tr>
                <td>${escapeHtml(user.name || user.email || "Conta sem nome")}</td>
                <td>${escapeHtml(roleLabels[user.role] || user.role || "Usuário")}</td>
                <td>${formatAdminDate(user.lastAccessAt)}</td>
                <td>${formatAdminDate(user.latestRecord)}</td>
                <td>${escapeHtml(user.appVersion || "Sem dados")}</td>
              </tr>`).join("") || `<tr><td colspan="5">Aguardando os primeiros acessos com telemetria operacional.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      <p class="admin-privacy-note">Este painel utiliza somente metadados operacionais. Peso, medidas, percentual de gordura, objetivos e observações não são disponibilizados à administração.</p>
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

function personalAccessView(grants) {
  const active = grants.filter((item) => item.status === "active");
  return `
    <section class="card">
      <div class="chart-header">
        <div><h2>Liberar acesso pessoal</h2><p class="muted">Autorize um e-mail a criar conta sem convite profissional durante a fase alfa.</p></div>
      </div>
      <form class="form" id="personal-access-form">
        <div class="form-grid">
          <div class="field"><label for="personal-access-email">E-mail</label><input id="personal-access-email" name="email" type="email" autocomplete="email" required /></div>
        </div>
        <div class="button-row"><button class="button primary" type="submit">Liberar acesso</button></div>
      </form>
      <div class="table-wrap">
        <table>
          <thead><tr><th>E-mail autorizado</th><th>Situação</th><th></th></tr></thead>
          <tbody>${active.map((grant) => `<tr>
            <td>${escapeHtml(grant.emailLower || grant.id)}</td>
            <td><span class="badge">Liberado</span></td>
            <td><button class="button" type="button" data-revoke-personal-access="${escapeAttribute(grant.emailLower || grant.id)}">Revogar liberação</button></td>
          </tr>`).join("") || `<tr><td colspan="3">Nenhuma liberação pessoal ativa.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function accessRequestsView(personalRequests, professionalRequests) {
  const requests = [
    ...personalRequests.map((item) => ({ ...item, accessType: "personal" })),
    ...professionalRequests.map((item) => ({ ...item, accessType: "professional" }))
  ].filter((item) => item.status === "pending")
    .sort((first, second) => (second.createdAt?.seconds || 0) - (first.createdAt?.seconds || 0));
  return `
    <section class="card">
      <div class="chart-header"><div><h2>Solicitações de acesso</h2><p class="muted">Analise pedidos antes de liberar a criação da conta na fase alfa.</p></div><span class="badge warning">${requests.length}</span></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Área</th><th>Ações</th></tr></thead>
          <tbody>${requests.map((item) => `<tr>
            <td>${escapeHtml(item.name || "Nome pendente")}</td>
            <td>${escapeHtml(item.emailLower || "-")}</td>
            <td>${item.accessType === "professional" ? "Profissional" : "Uso pessoal"}</td>
            <td>${item.accessType === "professional" ? escapeHtml(professionalTypeLabel(item.professionType) || "-") : "-"}</td>
            <td><div class="button-row"><button class="button primary" type="button" data-decide-access-request="approved" data-access-type="${item.accessType}" data-request-id="${escapeAttribute(item.id)}">Aprovar</button><button class="button danger" type="button" data-decide-access-request="rejected" data-access-type="${item.accessType}" data-request-id="${escapeAttribute(item.id)}">Recusar</button></div></td>
          </tr>`).join("") || `<tr><td colspan="5">Nenhuma solicitação aguardando análise.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  `;
}

function professionalsView(users, registrations, currentUserId) {
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Pré-cadastrar profissional</h2>
            <p class="muted">Autorize um e-mail. A ativação ocorrerá automaticamente após o primeiro acesso com o endereço verificado.</p>
          </div>
          <button class="button" id="refresh-admin" type="button">Atualizar</button>
        </div>
        <form class="form" id="professional-registration-form">
          <div class="form-grid">
            <div class="field">
              <label for="professional-name">Nome</label>
              <input id="professional-name" name="name" autocomplete="name" minlength="2" required />
            </div>
            <div class="field">
              <label for="professional-email">E-mail autorizado</label>
              <input id="professional-email" name="email" type="email" autocomplete="email" required />
            </div>
          </div>
          <div class="button-row">
            <button class="button primary" type="submit">Adicionar profissional</button>
          </div>
        </form>
      </section>

      <section class="card">
        <h2>Pré-cadastros</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              ${registrations.map((registration) => `
                <tr>
                  <td>${escapeHtml(registration.name || "Nome pendente")}</td>
                  <td>${escapeHtml(registration.emailLower || "-")}</td>
                  <td><span class="badge ${registration.status === "active" ? "" : "warning"}">${registrationStatusLabels[registration.status] || escapeHtml(registration.status)}</span></td>
                  <td>
                    ${!["active", "cancelled", "revoked"].includes(registration.status)
                      ? `<button class="button" data-cancel-professional-registration="${escapeAttribute(registration.id)}" type="button">Cancelar</button>`
                      : ""}
                  </td>
                </tr>
              `).join("") || `<tr><td colspan="4">Nenhum profissional pré-cadastrado.</td></tr>`}
            </tbody>
          </table>
        </div>
      </section>

      ${usersTable(users, currentUserId, true)}
    </div>
  `;
}

function linksTable(users, links) {
  const activeLinks = links.filter((item) => item.status === "active");
  return `
    <section class="card">
      <div class="chart-header"><h2>Vínculos ativos</h2><button class="button" id="refresh-admin" type="button">Atualizar</button></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Profissional</th><th>Usuário</th><th>Status</th><th></th></tr></thead>
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
          <thead><tr><th>Profissional</th><th>Usuário</th><th>Status</th><th></th></tr></thead>
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
  const registrations = authState.adminProfessionalRegistrations || [];
  const accessRequests = authState.adminProfessionalAccessRequests || [];
  const personalAccessRequests = authState.adminPersonalAccessRequests || [];
  const personalGrants = authState.adminPersonalAccessGrants || [];
  if (section === "users") return `<div class="view-stack">${personalAccessView(personalGrants)}${usersTable(users, authState.user.uid)}</div>`;
  if (section === "professionals") return professionalsView(users, registrations, authState.user.uid);
  if (section === "access-requests") return accessRequestsView(personalAccessRequests, accessRequests);
  if (section === "links") return linksTable(users, links);
  if (section === "invitations") return invitationsTable(users, invitations);
  return overview(users, links, invitations);
}

export function bindAdmin(context) {
  const refresh = async () => {
    try {
      const [users, links, invitations, registrations, accessRequests, personalAccessRequests, personalGrants] = await Promise.all([
        listUsers(),
        listAllCareLinks(),
        listAllCareInvitations(),
        listProfessionalRegistrations(),
        listProfessionalAccessRequests(),
        listPersonalAccessRequests(),
        listPersonalAccessGrants()
      ]);
      context.authState.adminUsers = users;
      context.authState.adminLinks = links;
      context.authState.adminInvitations = invitations;
      context.authState.adminProfessionalRegistrations = registrations;
      context.authState.adminProfessionalAccessRequests = accessRequests;
      context.authState.adminPersonalAccessRequests = personalAccessRequests;
      context.authState.adminPersonalAccessGrants = personalGrants;
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar a administração: ${error.message}`);
    }
  };

  document.getElementById("refresh-admin")?.addEventListener("click", refresh);

  document.getElementById("personal-access-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await grantPersonalAlphaAccess(new FormData(event.currentTarget).get("email"));
      event.currentTarget.reset();
      showToast("Acesso pessoal liberado.");
      await refresh();
    } catch (error) {
      showToast(`Não foi possível liberar o acesso: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-revoke-personal-access]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!await confirmAction({
        title: "Revogar liberação?",
        message: "Esta ação impede apenas a criação futura da conta. Uma conta já criada não será excluída.",
        confirmLabel: "Revogar",
        tone: "warning"
      })) return;
      try {
        await revokePersonalAlphaAccess(button.dataset.revokePersonalAccess);
        showToast("Liberação revogada.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível revogar: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-decide-access-request]").forEach((button) => {
    button.addEventListener("click", async () => {
      const approved = button.dataset.decideAccessRequest === "approved";
      if (!await confirmAction({
        title: approved ? "Aprovar solicitação?" : "Recusar solicitação?",
        message: approved
          ? `O e-mail poderá criar uma conta de ${button.dataset.accessType === "professional" ? "profissional" : "uso pessoal"}. A autorização pessoal expira em sete dias.`
          : "O pedido será encerrado sem liberar a criação da conta.",
        confirmLabel: approved ? "Aprovar" : "Recusar",
        tone: approved ? "default" : "danger"
      })) return;
      try {
        const decide = button.dataset.accessType === "professional"
          ? decideProfessionalAlphaAccess
          : decidePersonalAlphaAccess;
        const result = await decide(button.dataset.requestId, button.dataset.decideAccessRequest);
        const decisionMessage = approved ? "Solicitação aprovada." : "Solicitação recusada.";
        showToast(result.notification === "sent"
          ? `${decisionMessage} E-mail enviado.`
          : `${decisionMessage} O e-mail não pôde ser enviado.`);
        await refresh();
      } catch (error) {
        showToast(`Não foi possível concluir a análise: ${error.message}`);
      }
    });
  });

  document.getElementById("professional-registration-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const result = await registerProfessional({
        name: data.get("name"),
        email: data.get("email")
      });
      const messages = {
        awaiting_registration: "Pré-cadastro criado. O acesso será ativado no primeiro login.",
        awaiting_validation: "Conta localizada. A ativação aguarda a verificação do e-mail.",
        active: "Profissional localizado e ativado."
      };
      showToast(messages[result.status] || "Pré-cadastro atualizado.");
      event.currentTarget.reset();
      await refresh();
    } catch (error) {
      showToast(`Não foi possível pré-cadastrar: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-cancel-professional-registration]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!await confirmAction({
        title: "Cancelar pré-cadastro?",
        message: "O acesso profissional pendente será removido.",
        confirmLabel: "Cancelar pré-cadastro",
        tone: "danger"
      })) return;
      try {
        await cancelProfessionalRegistration(button.dataset.cancelProfessionalRegistration);
        showToast("Pré-cadastro cancelado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível cancelar: ${error.message}`);
      }
    });
  });

  document.querySelectorAll("[data-save-role]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.saveRole;
      const role = document.querySelector(`[data-role-user="${userId}"]`)?.value;
      try {
        await setUserRole(userId, role);
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
      if (nextStatus === "suspended" && !await confirmAction({
        title: "Suspender conta?",
        message: "O usuário perderá o acesso até que a conta seja reativada.",
        confirmLabel: "Suspender",
        tone: "warning"
      })) return;
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
      if (!link || !await confirmAction({
        title: "Encerrar vínculo?",
        message: "O acesso compartilhado entre usuário e profissional será encerrado.",
        confirmLabel: "Encerrar",
        tone: "danger"
      })) return;
      try {
        await endProfessionalCareEpisode(link.id, "not-specified");
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
        await cancelProfessionalInvitation(button.dataset.adminCancelInvitation);
        showToast("Convite cancelado.");
        await refresh();
      } catch (error) {
        showToast(`Não foi possível cancelar o convite: ${error.message}`);
      }
    });
  });

  if (!context.authState.adminUsers
    || !context.authState.adminLinks
    || !context.authState.adminInvitations
    || !context.authState.adminProfessionalRegistrations
    || !context.authState.adminProfessionalAccessRequests
    || !context.authState.adminPersonalAccessRequests
    || !context.authState.adminPersonalAccessGrants) refresh();
}
