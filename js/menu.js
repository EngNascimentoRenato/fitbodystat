import { escapeHtml } from "./utils/html-utils.js";

export const routes = [
  { path: "/dashboard", title: "Dashboard", eyebrow: "Acompanhamento pessoal", label: "Dashboard", icon: "D" },
  { path: "/perfil", title: "Perfil", eyebrow: "Dados corporais", label: "Perfil", icon: "P" },
  { path: "/registro", title: "Novo registro", eyebrow: "Registro semanal", label: "Novo registro", icon: "+" },
  { path: "/historico", title: "Histórico", eyebrow: "Evolução registrada", label: "Histórico", icon: "H" },
  { path: "/metas", title: "Metas", eyebrow: "Planejamento", label: "Metas", icon: "M" },
  { path: "/vinculos", title: "Meus profissionais", eyebrow: "Convites e vínculos", label: "Meus profissionais", icon: "V" },
  { path: "/me/dashboard", title: "Meu dashboard", eyebrow: "Meu espaço", label: "Meu dashboard", icon: "D", roles: ["professional", "admin"] },
  { path: "/me/registro", title: "Meu novo registro", eyebrow: "Meu espaço", label: "Meu novo registro", icon: "+", roles: ["professional", "admin"] },
  { path: "/me/historico", title: "Meu histórico", eyebrow: "Meu espaço", label: "Meu histórico", icon: "H", roles: ["professional", "admin"] },
  { path: "/me/metas", title: "Minhas metas", eyebrow: "Meu espaço", label: "Minhas metas", icon: "M", roles: ["professional", "admin"] },
  { path: "/me/perfil", title: "Meu perfil", eyebrow: "Meu espaço", label: "Meu perfil", icon: "P", roles: ["professional", "admin"] },
  { path: "/me/vinculos", title: "Meus profissionais", eyebrow: "Meu espaço", label: "Meus profissionais", icon: "V", roles: ["professional", "admin"] },
  { path: "/pacientes", title: "Pacientes", eyebrow: "Acompanhamento profissional", label: "Pacientes", icon: "P", roles: ["professional"] },
  { path: "/admin", title: "Visão geral", eyebrow: "Administração", label: "Visão geral", icon: "A", roles: ["admin"] },
  { path: "/admin/usuarios", title: "Usuários", eyebrow: "Administração", label: "Usuários", icon: "U", roles: ["admin"] },
  { path: "/admin/profissionais", title: "Profissionais", eyebrow: "Administração", label: "Profissionais", icon: "P", roles: ["admin"] },
  { path: "/admin/vinculos", title: "Vínculos", eyebrow: "Administração", label: "Vínculos", icon: "V", roles: ["admin"] },
  { path: "/admin/convites", title: "Convites pendentes", eyebrow: "Administração", label: "Convites pendentes", icon: "C", roles: ["admin"] },
  { path: "/conta", title: "Conta", eyebrow: "Identidade e acesso", label: "Conta", icon: "C" },
  { path: "/configuracoes", title: "Configurações", eyebrow: "Dados e PWA", label: "Configurações", icon: "S" }
];

const personalPaths = ["/me/dashboard", "/me/registro", "/me/historico", "/me/metas", "/me/perfil", "/me/vinculos"];

function routeIsAllowed(route, authState) {
  if (authState?.needsName && !["/perfil", "/conta"].includes(route.path)) return false;
  if (!route.roles) return true;
  return route.roles.includes(authState?.role || "user");
}

function navLink(path, label, icon, currentPath) {
  return `
    <a class="nav-link" href="#${path}" ${path === currentPath ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${icon}</span>
      <span>${label}</span>
    </a>
  `;
}

function navSection(label, links) {
  return `<div class="nav-section"><p class="nav-section-label">${label}</p>${links}</div>`;
}

function personalLinks(currentPath) {
  return [
    navLink("/me/dashboard", "Meu dashboard", "D", currentPath),
    navLink("/me/registro", "Meu novo registro", "+", currentPath),
    navLink("/me/historico", "Meu histórico", "H", currentPath),
    navLink("/me/metas", "Minhas metas", "M", currentPath),
    navLink("/me/perfil", "Meu perfil", "P", currentPath),
    navLink("/me/vinculos", "Meus profissionais", "V", currentPath)
  ].join("");
}

function personalSubmenu(currentPath, activePatient) {
  const open = !activePatient && personalPaths.includes(currentPath) ? "open" : "";
  return `
    <details class="nav-submenu" ${open}>
      <summary><span class="nav-icon">E</span><span>Meu espaço</span></summary>
      <div class="nav-submenu-content">${personalLinks(currentPath)}</div>
    </details>
  `;
}

export function renderMenu(currentPath, authState) {
  const menu = document.getElementById("main-menu");
  if (authState?.needsName) {
    menu.innerHTML = navSection("Complete seu cadastro", [
      navLink("/perfil", "Preencher perfil", "P", currentPath),
      navLink("/conta", "Conta", "C", currentPath)
    ].join(""));
    return;
  }

  const accountLinks = [
    navLink("/conta", "Conta", "C", currentPath),
    navLink("/configuracoes", "Configurações", "S", currentPath)
  ].join("");

  if (authState.role === "user") {
    menu.innerHTML = [
      navSection("Minha evolução", [
        navLink("/dashboard", "Dashboard", "D", currentPath),
        navLink("/registro", "Novo registro", "+", currentPath),
        navLink("/historico", "Histórico", "H", currentPath),
        navLink("/metas", "Metas", "M", currentPath),
        navLink("/perfil", "Perfil", "P", currentPath)
      ].join("")),
      navSection("Relacionamentos", navLink("/vinculos", "Meus profissionais", "V", currentPath)),
      navSection("Conta", accountLinks)
    ].join("");
    return;
  }

  if (authState.role === "professional") {
    const patient = authState.activePatient;
    const patientLinks = patient ? navSection(`Paciente: ${escapeHtml(patient.name)}`, [
      navLink("/dashboard", "Dashboard do paciente", "D", currentPath),
      navLink("/registro", "Novo registro do paciente", "+", currentPath),
      navLink("/historico", "Histórico do paciente", "H", currentPath),
      navLink("/metas", "Metas e planejamento", "M", currentPath),
      navLink("/perfil", "Perfil corporal", "P", currentPath)
    ].join("")) : "";
    menu.innerHTML = [
      patientLinks,
      navSection("Área profissional", navLink("/pacientes", patient ? "Voltar aos pacientes" : "Pacientes", "P", currentPath)),
      personalSubmenu(currentPath, patient),
      navSection("Conta", accountLinks)
    ].join("");
    return;
  }

  const adminLinks = [
    navLink("/admin", "Visão geral", "A", currentPath),
    navLink("/admin/usuarios", "Usuários", "U", currentPath),
    navLink("/admin/profissionais", "Profissionais", "P", currentPath),
    navLink("/admin/vinculos", "Vínculos", "V", currentPath),
    navLink("/admin/convites", "Convites pendentes", "C", currentPath)
  ].join("");
  menu.innerHTML = [
    navSection("Administração", adminLinks),
    personalSubmenu(currentPath, false),
    navSection("Conta", accountLinks)
  ].join("");
}

export function getRoute(path) {
  return routes.find((route) => route.path === path) || routes[0];
}

export function canAccessRoute(route, authState) {
  return routeIsAllowed(route, authState);
}
