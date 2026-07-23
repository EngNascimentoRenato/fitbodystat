import { canAccessRoute, getRoute, renderMenu } from "./menu.js";
import { renderDashboard } from "./views/dashboard-view.js";
import { renderProfile, bindProfile } from "./views/profile-view.js";
import { renderEntry, bindEntry } from "./views/entry-view.js";
import { renderHistory, bindHistory } from "./views/history-view.js";
import { renderGoals } from "./views/goals-view.js";
import { renderSettings, bindSettings } from "./views/settings-view.js";
import { renderAccount, bindAccount } from "./views/account-view.js";
import { renderAdmin, bindAdmin } from "./views/admin-view.js";
import { renderPatients, bindPatients } from "./views/patients-view.js";
import { renderConnections, bindConnections } from "./views/connections-view.js";
import { renderActivities, bindActivities } from "./views/activities-view.js";

const patientDataPaths = ["/dashboard", "/perfil", "/registro", "/historico", "/atividades", "/metas"];
const personalDataPaths = ["/me/dashboard", "/me/perfil", "/me/registro", "/me/historico", "/me/atividades", "/me/metas"];
const dataPaths = [...patientDataPaths, ...personalDataPaths];

export function currentPath() {
  return location.hash.replace("#", "") || "/dashboard";
}

function fallbackPath(authState) {
  if (authState.needsName) return "/perfil";
  if (authState.role === "professional") return "/pacientes";
  if (authState.role === "admin") return "/admin";
  return "/dashboard";
}

function configureTopbar(activeRoute, authState) {
  const action = document.getElementById("topbar-action");
  const isDataView = dataPaths.includes(activeRoute.path);
  action.hidden = !isDataView;
  action.href = activeRoute.path.startsWith("/me/") ? "#/me/registro" : "#/registro";
  action.textContent = authState.activePatient
    ? "Novo registro do paciente"
    : authState.role === "user" ? "Novo registro" : "Meu novo registro";

  if (!authState.activePatient || !patientDataPaths.includes(activeRoute.path)) return;
  const patientTitles = {
    "/dashboard": ["Dashboard do paciente", "Acompanhamento profissional"],
    "/perfil": ["Perfil corporal", "Paciente selecionado"],
    "/registro": ["Novo registro do paciente", "Paciente selecionado"],
    "/historico": ["Histórico do paciente", "Paciente selecionado"],
    "/metas": ["Metas e planejamento", "Paciente selecionado"]
  };
  patientTitles["/atividades"] = ["Atividades do paciente", "Frequência de atividades"];
  const [title, eyebrow] = patientTitles[activeRoute.path];
  document.getElementById("route-title").textContent = title;
  document.getElementById("route-eyebrow").textContent = eyebrow;
}

export function renderRoute(context) {
  const app = document.getElementById("app");
  const requestedPath = currentPath();

  if (context.authState.activePatient && !patientDataPaths.includes(requestedPath)) {
    context.leavePatientContext();
  }

  const requestedRoute = getRoute(requestedPath);
  const activeRoute = canAccessRoute(requestedRoute, context.authState)
    ? requestedRoute
    : getRoute(fallbackPath(context.authState));

  document.getElementById("route-title").textContent = activeRoute.title;
  document.getElementById("route-eyebrow").textContent = activeRoute.eyebrow;
  configureTopbar(activeRoute, context.authState);
  renderMenu(activeRoute.path, context.authState);

  const viewMap = {
    "/dashboard": () => renderDashboard(context.state),
    "/perfil": () => renderProfile(context.state),
    "/registro": () => renderEntry(context.state),
    "/historico": () => renderHistory(context.state),
    "/atividades": () => renderActivities(context.state),
    "/metas": () => renderGoals(context.state),
    "/vinculos": () => renderConnections(context.authState),
    "/me/dashboard": () => renderDashboard(context.personalState, "/me"),
    "/me/perfil": () => renderProfile(context.personalState),
    "/me/registro": () => renderEntry(context.personalState),
    "/me/historico": () => renderHistory(context.personalState),
    "/me/atividades": () => renderActivities(context.personalState),
    "/me/metas": () => renderGoals(context.personalState),
    "/me/vinculos": () => renderConnections(context.authState),
    "/pacientes": () => renderPatients(context.state, context.authState),
    "/admin": () => renderAdmin(context.state, context.authState, "overview"),
    "/admin/usuarios": () => renderAdmin(context.state, context.authState, "users"),
    "/admin/profissionais": () => renderAdmin(context.state, context.authState, "professionals"),
    "/admin/vinculos": () => renderAdmin(context.state, context.authState, "links"),
    "/admin/convites": () => renderAdmin(context.state, context.authState, "invitations"),
    "/conta": () => renderAccount(context.personalState, context.authState),
    "/configuracoes": () => renderSettings(context.personalState, context.authState)
  };

  app.innerHTML = (viewMap[activeRoute.path] || viewMap[fallbackPath(context.authState)])();

  if (activeRoute.path === "/perfil") bindProfile(context.state, context.persist, context.render);
  if (activeRoute.path === "/registro") bindEntry(context.state, context.persist, context.render);
  if (activeRoute.path === "/historico") bindHistory(context.state, context.persist, context.render);
  if (activeRoute.path === "/atividades") bindActivities(context.state, context.persist, context.render);
  if (activeRoute.path === "/vinculos") bindConnections(context);
  if (activeRoute.path === "/me/perfil") bindProfile(context.personalState, context.persistPersonal, context.render);
  if (activeRoute.path === "/me/registro") bindEntry(context.personalState, context.persistPersonal, context.render);
  if (activeRoute.path === "/me/historico") bindHistory(context.personalState, context.persistPersonal, context.render);
  if (activeRoute.path === "/me/atividades") bindActivities(context.personalState, context.persistPersonal, context.render);
  if (activeRoute.path === "/me/vinculos") bindConnections(context);
  if (activeRoute.path === "/pacientes") bindPatients(context);
  if (activeRoute.path.startsWith("/admin")) bindAdmin(context);
  if (activeRoute.path === "/conta") bindAccount(context);
  if (activeRoute.path === "/configuracoes") bindSettings(context.personalState, context.persistPersonal, context.render, context.replacePersonalState, context.authState);

  document.body.classList.remove("menu-open");
}
