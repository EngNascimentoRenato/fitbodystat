import { listUsers, updateUserRole } from "../data/firestore-store.js";
import { showToast } from "../components/toast.js";

const roleOptions = ["user", "professional", "admin"];

export function renderAdmin(state, authState) {
  if (!authState?.user) {
    return `<section class="card empty-state"><h2>Login necessário</h2><p class="muted">Entre para acessar a área admin.</p></section>`;
  }

  if (authState.role !== "admin") {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é exclusiva para administradores.</p></section>`;
  }

  const users = authState.adminUsers || [];
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Usuários</h2>
            <p class="muted">Gerencie os papéis principais do sistema.</p>
          </div>
          <button class="button" id="refresh-users" type="button">Atualizar</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Tipo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td>${user.name || "-"}</td>
                  <td>${user.email || "-"}</td>
                  <td>
                    <select class="table-input" data-role-user="${user.uid || user.id}">
                      ${roleOptions.map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${role}</option>`).join("")}
                    </select>
                  </td>
                  <td><button class="button" data-save-role="${user.uid || user.id}" type="button">Salvar</button></td>
                </tr>
              `).join("")}
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
      context.authState.adminUsers = await listUsers();
      context.render();
    } catch (error) {
      showToast(`Não foi possível listar usuários: ${error.message}`);
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

  if (!context.authState.adminUsers) refresh();
}
