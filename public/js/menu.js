import { escapeHtml } from "./utils/html-utils.js";
import { icon as renderIcon } from "./components/icon.js";

export const routes = [
  { path: "/primeiro-acesso", title: "Primeiro acesso", eyebrow: "Configuração inicial", label: "Concluir cadastro", icon: "check" },
  { path: "/atividades", title: "Atividades", eyebrow: "Frequência de atividades", label: "Atividades", icon: "dumbbell" },
  { path: "/me/atividades", title: "Minhas atividades", eyebrow: "Meu espaço", label: "Minhas atividades", icon: "dumbbell", roles: ["professional", "admin"] },
  { path: "/dashboard", title: "Dashboard", eyebrow: "Acompanhamento pessoal", label: "Dashboard", icon: "layout-dashboard" },
  { path: "/perfil", title: "Perfil", eyebrow: "Dados corporais", label: "Perfil", icon: "user-round" },
  { path: "/registro", title: "Novo registro", eyebrow: "Medidas ou atividade", label: "Novo registro", icon: "plus" },
  { path: "/historico", title: "Histórico", eyebrow: "Evolução registrada", label: "Histórico", icon: "history" },
  { path: "/metas", title: "Metas", eyebrow: "Planejamento", label: "Metas", icon: "target" },
  { path: "/vinculos", title: "Meus profissionais", eyebrow: "Convites e vínculos", label: "Meus profissionais", icon: "link" },
  { path: "/me/dashboard", title: "Meu dashboard", eyebrow: "Meu espaço", label: "Meu dashboard", icon: "▦", roles: ["professional", "admin"] },
  { path: "/me/registro", title: "Meu novo registro", eyebrow: "Medidas ou atividade", label: "Meu novo registro", icon: "+", roles: ["professional", "admin"] },
  { path: "/me/historico", title: "Meu histórico", eyebrow: "Meu espaço", label: "Meu histórico", icon: "◷", roles: ["professional", "admin"] },
  { path: "/me/metas", title: "Minhas metas", eyebrow: "Meu espaço", label: "Minhas metas", icon: "◎", roles: ["professional", "admin"] },
  { path: "/me/perfil", title: "Meu perfil", eyebrow: "Meu espaço", label: "Meu perfil", icon: "♙", roles: ["professional", "admin"] },
  { path: "/me/vinculos", title: "Meus profissionais", eyebrow: "Meu espaço", label: "Meus profissionais", icon: "↔", roles: ["professional", "admin"] },
  { path: "/pacientes", title: "Pacientes", eyebrow: "Acompanhamento profissional", label: "Pacientes", icon: "♙", roles: ["professional"] },
  { path: "/agenda", title: "Agenda", eyebrow: "Organização profissional", label: "Agenda", icon: "□", roles: ["professional"] },
  { path: "/admin", title: "Visão geral", eyebrow: "Administração", label: "Visão geral", icon: "▦", roles: ["admin"] },
  { path: "/admin/usuarios", title: "Usuários", eyebrow: "Administração", label: "Usuários", icon: "♙", roles: ["admin"] },
  { path: "/admin/profissionais", title: "Profissionais", eyebrow: "Administração", label: "Profissionais", icon: "◇", roles: ["admin"] },
  { path: "/admin/vinculos", title: "Vínculos", eyebrow: "Administração", label: "Vínculos", icon: "↔", roles: ["admin"] },
  { path: "/admin/convites", title: "Convites pendentes", eyebrow: "Administração", label: "Convites pendentes", icon: "✉", roles: ["admin"] },
  { path: "/conta", title: "Conta", eyebrow: "Identidade e acesso", label: "Conta", icon: "○" },
  { path: "/configuracoes", title: "Configurações", eyebrow: "Dados e privacidade", label: "Configurações", icon: "⚙" },
  { path: "/metodos", title: "Métodos e cálculos", eyebrow: "Critérios e referências", label: "Métodos e cálculos", icon: "i" }
];

const personalPaths = ["/me/dashboard", "/me/registro", "/me/historico", "/me/atividades", "/me/metas", "/me/perfil", "/me/vinculos"];

function routeIsAllowed(route, authState) {
  if ((authState?.needsOnboarding || authState?.needsPersonalOnboarding)
    && !["/primeiro-acesso", "/conta"].includes(route.path)) return false;
  if (authState?.needsName && !["/perfil", "/conta"].includes(route.path)) return false;
  if (authState?.role === "professional") {
    const common = ["/conta", "/configuracoes", "/metodos", "/primeiro-acesso"];
    const personal = ["/dashboard", "/atividades", "/registro", "/historico", "/metas", "/perfil", "/vinculos"];
    const professional = ["/agenda", "/pacientes"];
    if (common.includes(route.path)) return true;
    if (authState.activeWorkspace === "personal") return personal.includes(route.path);
    if (professional.includes(route.path)) return true;
    return Boolean(authState.activePatient)
      && ["/dashboard", "/atividades", "/registro", "/historico", "/metas", "/perfil"].includes(route.path);
  }
  if (!route.roles) return true;
  return route.roles.includes(authState?.role || "user");
}

function navLink(path, label, icon, currentPath) {
  return `
    <a class="nav-link" href="#${path}" title="${escapeHtml(label)}" ${path === currentPath ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${renderIcon(icon)}</span>
      <span>${label}</span>
    </a>
  `;
}

function navSection(label, links) {
  return `<div class="nav-section"><p class="nav-section-label">${label}</p>${links}</div>`;
}

function personalLinks(currentPath) {
  return [
    navLink("/me/dashboard", "Meu dashboard", "layout-dashboard", currentPath),
    navLink("/me/metas", "Minhas metas", "target", currentPath),
    navLink("/me/atividades", "Minhas atividades", "dumbbell", currentPath),
    navLink("/me/historico", "Meu histórico", "history", currentPath),
    navLink("/me/perfil", "Meu perfil", "user-round", currentPath),
    navLink("/me/vinculos", "Meus profissionais", "link", currentPath)
  ].join("");
}

function personalSubmenu(currentPath, activePatient) {
  const open = !activePatient && personalPaths.includes(currentPath) ? "open" : "";
  return `
    <details class="nav-submenu" ${open}>
      <summary title="Meu espaço"><span class="nav-icon">${renderIcon("house")}</span><span>Meu espaço</span></summary>
      <div class="nav-submenu-content">${personalLinks(currentPath)}</div>
    </details>
  `;
}

function standardPersonalMenu(currentPath, accountLinks, prefix = "", hasActiveProject = true, showRelationships = true) {
  const evolutionLinks = hasActiveProject
    ? [
      navLink(`${prefix}/dashboard`, "Dashboard", "layout-dashboard", currentPath),
      navLink(`${prefix}/metas`, "Metas", "target", currentPath),
      navLink(`${prefix}/atividades`, "Atividades", "dumbbell", currentPath),
      navLink(`${prefix}/historico`, "Histórico", "history", currentPath),
      navLink(`${prefix}/perfil`, "Perfil", "user-round", currentPath)
    ].join("")
    : [
      navLink(`${prefix}/dashboard`, "Começar", "layout-dashboard", currentPath),
      navLink(`${prefix}/perfil`, "Perfil", "user-round", currentPath)
    ].join("");
  return [
    navSection(hasActiveProject ? "Minha evolução" : "Primeiros passos", evolutionLinks),
    showRelationships
      ? navSection("Relacionamentos", navLink(`${prefix}/vinculos`, "Meus profissionais", "link", currentPath))
      : "",
    navSection("Conta", accountLinks)
  ].join("");
}

export function renderMenu(currentPath, authState, theme = "light", hasActiveProject = true) {
  const menu = document.getElementById("main-menu");
  if (authState?.needsOnboarding || authState?.needsPersonalOnboarding) {
    menu.innerHTML = navSection("Primeiro acesso", [
      navLink("/primeiro-acesso", "Concluir cadastro", "check", currentPath),
      navLink("/conta", "Conta", "circle-user-round", currentPath)
    ].join(""));
    return;
  }
  if (authState?.needsName) {
    const profilePath = authState.role === "professional" && authState.activeWorkspace === "professional"
      ? "/conta"
      : "/perfil";
    menu.innerHTML = navSection("Complete seu cadastro", [
      navLink(profilePath, "Preencher perfil", "user-round", currentPath),
      navLink("/conta", "Conta", "circle-user-round", currentPath)
    ].join(""));
    return;
  }

  const accountLinks = [
    navLink("/conta", "Conta", "circle-user-round", currentPath),
    navLink("/configuracoes", "Configurações", "settings", currentPath),
    `<button class="nav-link nav-action" id="sidebar-theme-toggle" type="button" title="${theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}">
      <span class="nav-icon" aria-hidden="true">${renderIcon(theme === "dark" ? "sun" : "moon")}</span>
      <span>${theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
    </button>`,
    navLink("/metodos", "Métodos e cálculos", "calculator", currentPath)
  ].join("");

  if (authState.role === "user") {
    const showRelationships = Boolean(
      (authState.invitations || []).some((item) => item.status === "pending")
      || (authState.professionals || []).length
    );
    menu.innerHTML = standardPersonalMenu(currentPath, accountLinks, "", hasActiveProject, showRelationships);
    return;
  }

  if (authState.role === "professional") {
    if (authState.activeWorkspace === "personal") {
      const showRelationships = Boolean(
        (authState.invitations || []).some((item) => item.status === "pending")
        || (authState.professionals || []).length
      );
      menu.innerHTML = standardPersonalMenu(currentPath, accountLinks, "/me", hasActiveProject, showRelationships);
      return;
    }
    const patient = authState.activePatient;
    const patientLabel = authState.presentationMode === "off" ? patient?.name : "Paciente de demonstração";
    const patientLinks = patient ? navSection(`Paciente: ${escapeHtml(patientLabel)}`, (hasActiveProject ? [
      navLink("/dashboard", "Dashboard do paciente", "layout-dashboard", currentPath),
      navLink("/metas", "Metas e planejamento", "target", currentPath),
      navLink("/atividades", "Atividades do paciente", "dumbbell", currentPath),
      navLink("/historico", "Histórico do paciente", "history", currentPath),
      navLink("/perfil", "Perfil corporal", "user-round", currentPath)
    ] : [
      navLink("/dashboard", "Iniciar acompanhamento", "layout-dashboard", currentPath),
      navLink("/perfil", "Perfil corporal", "user-round", currentPath)
    ]).join("")) : "";
    menu.innerHTML = [
      patientLinks,
      navSection("Área profissional", [
        navLink("/agenda", "Agenda", "calendar-days", currentPath),
        navLink("/pacientes", patient ? "Voltar aos pacientes" : "Pacientes", "users-round", currentPath)
      ].join("")),
      navSection("Conta", accountLinks)
    ].join("");
    return;
  }

  const adminLinks = [
    navLink("/admin", "Visão geral", "layout-dashboard", currentPath),
    navLink("/admin/usuarios", "Usuários", "users-round", currentPath),
    navLink("/admin/profissionais", "Profissionais", "user-round", currentPath),
    navLink("/admin/vinculos", "Vínculos", "link", currentPath),
    navLink("/admin/convites", "Convites pendentes", "mail", currentPath)
  ].join("");
  menu.innerHTML = [
    navSection("Administração", adminLinks),
    personalSubmenu(currentPath, false),
    navSection("Conta", accountLinks)
  ].join("");
}

export function getRoute(path) {
  return routes.find((route) => route.path === path)
    || routes.find((route) => route.path === "/dashboard");
}

export function canAccessRoute(route, authState) {
  return routeIsAllowed(route, authState);
}
