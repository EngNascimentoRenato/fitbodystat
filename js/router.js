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

export function currentPath() {
  return location.hash.replace("#", "") || "/dashboard";
}

export function renderRoute(context) {
  const app = document.getElementById("app");
  const path = currentPath();
  const route = getRoute(path);
  const activeRoute = canAccessRoute(route, context.authState) ? route : getRoute("/dashboard");
  document.getElementById("route-title").textContent = activeRoute.title;
  document.getElementById("route-eyebrow").textContent = activeRoute.eyebrow;
  renderMenu(activeRoute.path, context.authState);

  const viewMap = {
    "/dashboard": () => renderDashboard(context.state),
    "/perfil": () => renderProfile(context.state),
    "/registro": () => renderEntry(context.state),
    "/historico": () => renderHistory(context.state),
    "/metas": () => renderGoals(context.state),
    "/pacientes": () => renderPatients(context.state, context.authState),
    "/admin": () => renderAdmin(context.state, context.authState),
    "/conta": () => renderAccount(context.state, context.authState),
    "/configuracoes": () => renderSettings(context.state, context.authState)
  };

  app.innerHTML = (viewMap[activeRoute.path] || viewMap["/dashboard"])();

  if (activeRoute.path === "/perfil") bindProfile(context.state, context.persist, context.render);
  if (activeRoute.path === "/registro") bindEntry(context.state, context.persist, context.render);
  if (activeRoute.path === "/historico") bindHistory(context.state, context.persist, context.render);
  if (activeRoute.path === "/pacientes") bindPatients(context);
  if (activeRoute.path === "/admin") bindAdmin(context);
  if (activeRoute.path === "/conta") bindAccount(context);
  if (activeRoute.path === "/configuracoes") bindSettings(context.state, context.persist, context.render, context.replaceState, context.authState);

  document.body.classList.remove("menu-open");
}
