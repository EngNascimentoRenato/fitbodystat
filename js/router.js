import { getRoute, renderMenu } from "./menu.js";
import { renderDashboard } from "./views/dashboard-view.js";
import { renderProfile, bindProfile } from "./views/profile-view.js";
import { renderEntry, bindEntry } from "./views/entry-view.js";
import { renderHistory, bindHistory } from "./views/history-view.js";
import { renderGoals } from "./views/goals-view.js";
import { renderSettings, bindSettings } from "./views/settings-view.js";

export function currentPath() {
  return location.hash.replace("#", "") || "/dashboard";
}

export function renderRoute(context) {
  const app = document.getElementById("app");
  const path = currentPath();
  const route = getRoute(path);
  document.getElementById("route-title").textContent = route.title;
  document.getElementById("route-eyebrow").textContent = route.eyebrow;
  renderMenu(route.path);

  const viewMap = {
    "/dashboard": () => renderDashboard(context.state),
    "/perfil": () => renderProfile(context.state),
    "/registro": () => renderEntry(context.state),
    "/historico": () => renderHistory(context.state),
    "/metas": () => renderGoals(context.state),
    "/configuracoes": () => renderSettings(context.state)
  };

  app.innerHTML = (viewMap[route.path] || viewMap["/dashboard"])();

  if (route.path === "/perfil") bindProfile(context.state, context.persist, context.render);
  if (route.path === "/registro") bindEntry(context.state, context.persist, context.render);
  if (route.path === "/historico") bindHistory(context.state, context.persist, context.render);
  if (route.path === "/configuracoes") bindSettings(context.state, context.persist, context.render, context.replaceState);

  document.body.classList.remove("menu-open");
}
