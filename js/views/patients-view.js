import {
  createCareLink,
  findUserByEmail,
  listPatientsForProfessional,
  listUsers
} from "../data/firestore-store.js";
import { showToast } from "../components/toast.js";

export function renderPatients(state, authState) {
  if (!authState?.user) {
    return `<section class="card empty-state"><h2>Login necessário</h2><p class="muted">Entre para acessar pacientes.</p></section>`;
  }

  if (!["professional", "admin"].includes(authState.role)) {
    return `<section class="card empty-state"><h2>Acesso restrito</h2><p class="muted">Esta área é voltada para profissionais e administradores.</p></section>`;
  }

  const patients = authState.patients || [];
  const isAdmin = authState.role === "admin";
  return `
    <div class="view-stack">
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>${isAdmin ? "Usuários acompanháveis" : "Pacientes"}</h2>
            <p class="muted">${isAdmin ? "Admin visualiza o diretório de usuários." : "Vincule pacientes pelo e-mail cadastrado no FitBodyStat."}</p>
          </div>
          <button class="button" id="refresh-patients" type="button">Atualizar</button>
        </div>
        ${!isAdmin ? `
          <form class="form" id="add-patient-form">
            <div class="form-grid">
              <div class="field">
                <label for="patient-email">E-mail do paciente</label>
                <input id="patient-email" name="email" type="email" required />
              </div>
            </div>
            <div class="button-row">
              <button class="button primary" type="submit">Vincular paciente</button>
            </div>
          </form>
        ` : ""}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              ${patients.map((patient) => `
                <tr>
                  <td>${patient.name || "-"}</td>
                  <td>${patient.email || "-"}</td>
                  <td>${patient.role || "user"}</td>
                </tr>
              `).join("") || `<tr><td colspan="3">Nenhum registro encontrado.</td></tr>`}
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
      context.authState.patients = context.authState.role === "admin"
        ? await listUsers()
        : await listPatientsForProfessional(context.authState.user.uid);
      context.render();
    } catch (error) {
      showToast(`Não foi possível carregar pacientes: ${error.message}`);
    }
  };

  document.getElementById("refresh-patients")?.addEventListener("click", refresh);

  document.getElementById("add-patient-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      const patient = await findUserByEmail(data.get("email"));
      if (!patient) {
        showToast("Paciente não encontrado. Ele precisa criar login antes.");
        return;
      }
      await createCareLink(context.authState.user.uid, patient.uid || patient.id);
      showToast("Paciente vinculado.");
      await refresh();
    } catch (error) {
      showToast(`Não foi possível vincular: ${error.message}`);
    }
  });

  if (!context.authState.patients) refresh();
}
