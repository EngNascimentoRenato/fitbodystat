import { canAccessRoute, getRoute, renderMenu } from "./menu.js";
import { renderDashboard } from "./views/dashboard-view.js";
import { renderProfile, bindProfile, resetProfileMode } from "./views/profile-view.js";
import { renderEntry, bindEntry, resetEntryMode } from "./views/entry-view.js";
import { renderHistory, bindHistory } from "./views/history-view.js";
import { renderGoals } from "./views/goals-view.js";
import { renderSettings, bindSettings } from "./views/settings-view.js";
import { renderAccount, bindAccount } from "./views/account-view.js";
import { renderAdmin, bindAdmin } from "./views/admin-view.js";
import { renderPatients, bindPatients } from "./views/patients-view.js";
import { renderConnections, bindConnections } from "./views/connections-view.js";
import { renderActivities, bindActivities } from "./views/activities-view.js";
import { renderOnboarding, bindOnboarding } from "./views/onboarding-view.js";
import { renderMethods } from "./views/methods-view.js";
import { renderAgenda, bindAgenda } from "./views/agenda-view.js";
import { bindMeasurementHelp } from "./components/measurement-guide.js";
import { bindObjectiveHelp } from "./components/objective-guide.js";
import { showToast } from "./components/toast.js";
import { showAlert } from "./components/modal.js";
import { professionalAudienceTerms } from "./data/professional-catalog.js";
import {
  dismissInstallSuggestion,
  getPwaInstallState,
  requestPwaInstall,
  shouldShowInstallSuggestion
} from "./services/pwa-service.js";

const patientDataPaths = ["/dashboard", "/perfil", "/registro", "/historico", "/atividades", "/metas"];
const personalDataPaths = ["/me/dashboard", "/me/perfil", "/me/registro", "/me/historico", "/me/atividades", "/me/metas"];
const dataPaths = [...patientDataPaths, ...personalDataPaths];
const projectRequiredPaths = [
  "/registro", "/historico", "/atividades", "/metas",
  "/me/registro", "/me/historico", "/me/atividades", "/me/metas"
];

export function currentPath() {
  return location.hash.replace("#", "") || "/dashboard";
}

function fallbackPath(authState) {
  if (authState.needsOnboarding || authState.needsPersonalOnboarding) return "/primeiro-acesso";
  if (authState.needsName) {
    return authState.role === "professional" && authState.activeWorkspace === "professional"
      ? "/conta"
      : "/perfil";
  }
  if (authState.role === "professional") {
    return authState.activeWorkspace === "personal" ? "/me/dashboard" : "/agenda";
  }
  if (authState.role === "admin") return "/admin";
  return "/dashboard";
}

function stateForRoute(path, context) {
  return path.startsWith("/me/") ? context.personalState : context.state;
}

function configureTopbar(activeRoute, authState, context) {
  const terms = professionalAudienceTerms(authState.professionalProfile?.professionType);
  const action = document.getElementById("topbar-action");
  const isDataView = dataPaths.includes(activeRoute.path);
  const hasActiveProject = Boolean(stateForRoute(activeRoute.path, context)?.activeCycleId);
  action.hidden = !isDataView || !hasActiveProject;
  action.href = activeRoute.path.startsWith("/me/") ? "#/me/registro" : "#/registro";
  const actionLabel = authState.activePatient
    ? `Novo registro do ${terms.singular}`
    : authState.role === "user" || authState.activeWorkspace === "personal"
      ? "Novo registro"
      : "Meu novo registro";
  action.setAttribute("aria-label", actionLabel);
  action.title = actionLabel;

  if (!authState.activePatient || !patientDataPaths.includes(activeRoute.path)) return;
  const patientTitles = {
    "/dashboard": [`Dashboard do ${terms.singular}`, "Acompanhamento profissional"],
    "/perfil": ["Perfil corporal", `${terms.singularTitle} selecionado`],
    "/registro": [`Novo registro do ${terms.singular}`, `${terms.singularTitle} selecionado`],
    "/historico": [`Histórico do ${terms.singular}`, `${terms.singularTitle} selecionado`],
    "/metas": ["Metas e planejamento", `${terms.singularTitle} selecionado`]
  };
  patientTitles["/atividades"] = [`Atividades do ${terms.singular}`, "Frequência de atividades"];
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
  let activeRoute = canAccessRoute(requestedRoute, context.authState)
    ? requestedRoute
    : getRoute(fallbackPath(context.authState));
  const requestedState = stateForRoute(activeRoute.path, context);
  const projectRouteBlocked = projectRequiredPaths.includes(activeRoute.path)
    && !requestedState?.activeCycleId;
  if (projectRouteBlocked) {
    activeRoute = getRoute(activeRoute.path.startsWith("/me/") ? "/me/dashboard" : "/dashboard");
    queueMicrotask(() => showToast("Crie um projeto para liberar registros, metas, atividades e histórico."));
  }
  if (requestedPath !== activeRoute.path) {
    history.replaceState(null, "", `#${activeRoute.path}`);
  }
  if (!["/registro", "/me/registro"].includes(activeRoute.path)) resetEntryMode();
  if (!["/perfil", "/me/perfil"].includes(activeRoute.path)) resetProfileMode();

  document.getElementById("route-title").textContent = activeRoute.title;
  document.getElementById("route-eyebrow").textContent = activeRoute.eyebrow;
  configureTopbar(activeRoute, context.authState, context);
  renderMenu(
    activeRoute.path,
    context.authState,
    context.personalState.settings?.theme || "light",
    Boolean(stateForRoute(activeRoute.path, context)?.activeCycleId),
    getPwaInstallState().available
  );
  document.getElementById("sidebar-theme-toggle")?.addEventListener("click", () => {
    context.personalState.settings = context.personalState.settings || {};
    context.personalState.settings.theme = context.personalState.settings.theme === "dark" ? "light" : "dark";
    context.persistPersonal({ type: "settings" });
    context.render();
  });
  const installApp = async () => {
    const result = await requestPwaInstall();
    if (result.outcome === "manual-ios") {
      await showAlert({
        title: "Instalar no iPhone",
        message: "Abra esta pagina no Safari, toque em Compartilhar e depois em Adicionar a Tela de Inicio.",
        confirmLabel: "Entendi"
      });
      return;
    }
    if (result.outcome === "unavailable") {
      showToast("A instalacao nao esta disponivel neste navegador.", "info");
    }
  };
  document.getElementById("sidebar-install-app")?.addEventListener("click", installApp);

  const viewMap = {
    "/dashboard": () => renderDashboard(context.state, "", {
      presentationMode: context.authState.presentationMode,
      pendingInvitations: (context.authState.invitations || []).filter((item) => item.status === "pending").length,
      professionalCount: (context.authState.professionals || []).length,
      patientContext: Boolean(context.authState.activePatient),
      audienceTerms: professionalAudienceTerms(context.authState.professionalProfile?.professionType),
      showInstallSuggestion: !context.authState.activePatient && shouldShowInstallSuggestion()
    }),
    "/primeiro-acesso": () => renderOnboarding(context.personalState, context.authState),
    "/perfil": () => renderProfile(context.state, {
      canEditContact: !context.authState.activePatient,
      canEditIdentity: !context.authState.activePatient,
      forceEdit: context.authState.needsName,
      presentationMode: context.authState.presentationMode
    }),
    "/registro": () => renderEntry(context.state),
    "/historico": () => renderHistory(context.state),
    "/atividades": () => renderActivities(context.state),
    "/metas": () => renderGoals(context.state),
    "/vinculos": () => renderConnections(context.authState, context.personalState),
    "/me/dashboard": () => renderDashboard(context.personalState, "/me", {
      presentationMode: context.authState.presentationMode,
      pendingInvitations: (context.authState.invitations || []).filter((item) => item.status === "pending").length,
      professionalCount: (context.authState.professionals || []).length,
      patientContext: false,
      showInstallSuggestion: shouldShowInstallSuggestion()
    }),
    "/me/perfil": () => renderProfile(context.personalState, {
      canEditContact: true,
      canEditIdentity: true,
      forceEdit: context.authState.needsName,
      presentationMode: context.authState.presentationMode
    }),
    "/me/registro": () => renderEntry(context.personalState),
    "/me/historico": () => renderHistory(context.personalState),
    "/me/atividades": () => renderActivities(context.personalState),
    "/me/metas": () => renderGoals(context.personalState, "/me"),
    "/me/vinculos": () => renderConnections(context.authState, context.personalState),
    "/pacientes": () => renderPatients(context.state, context.authState),
    "/agenda": () => renderAgenda(context.authState),
    "/admin": () => renderAdmin(context.state, context.authState, "overview"),
    "/admin/usuarios": () => renderAdmin(context.state, context.authState, "users"),
    "/admin/profissionais": () => renderAdmin(context.state, context.authState, "professionals"),
    "/admin/solicitacoes": () => renderAdmin(context.state, context.authState, "access-requests"),
    "/admin/vinculos": () => renderAdmin(context.state, context.authState, "links"),
    "/admin/convites": () => renderAdmin(context.state, context.authState, "invitations"),
    "/conta": () => renderAccount(context.personalState, context.authState),
    "/configuracoes": () => renderSettings(context.personalState, context.authState),
    "/metodos": () => renderMethods()
  };

  app.innerHTML = (viewMap[activeRoute.path] || viewMap[fallbackPath(context.authState)])();

  document.getElementById("dashboard-install-app")?.addEventListener("click", installApp);
  document.getElementById("dismiss-install-suggestion")?.addEventListener("click", () => {
    dismissInstallSuggestion();
  });

  if (activeRoute.path === "/primeiro-acesso") bindOnboarding(context);
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
  if (activeRoute.path === "/agenda") bindAgenda(context);
  if (activeRoute.path.startsWith("/admin")) bindAdmin(context);
  if (activeRoute.path === "/conta") bindAccount(context);
  if (activeRoute.path === "/configuracoes") {
    bindSettings(
      context.personalState,
      context.persistPersonal,
      context.render,
      context.replacePersonalState,
      context.authState,
      context.setPresentationMode
    );
  }

  bindMeasurementHelp();
  bindObjectiveHelp();
  document.body.classList.remove("menu-open");
}
