export const routes = [
  { path: "/dashboard", title: "Dashboard", eyebrow: "Acompanhamento pessoal", label: "Dashboard", icon: "D" },
  { path: "/perfil", title: "Perfil", eyebrow: "Dados corporais", label: "Perfil", icon: "P" },
  { path: "/registro", title: "Novo registro", eyebrow: "Registro semanal", label: "Novo registro", icon: "+" },
  { path: "/historico", title: "Histórico", eyebrow: "Evolução registrada", label: "Histórico", icon: "H" },
  { path: "/metas", title: "Metas", eyebrow: "Planejamento", label: "Metas", icon: "M" },
  { path: "/vinculos", title: "Meus profissionais", eyebrow: "Convites e vínculos", label: "Meus profissionais", icon: "V" },
  { path: "/pacientes", title: "Pacientes", eyebrow: "Acompanhamento profissional", label: "Pacientes", icon: "P", roles: ["professional"] },
  { path: "/admin", title: "Admin", eyebrow: "Gestão do sistema", label: "Admin", icon: "A", roles: ["admin"] },
  { path: "/conta", title: "Conta", eyebrow: "Login e sincronização", label: "Conta", icon: "C" },
  { path: "/configuracoes", title: "Configurações", eyebrow: "Dados e PWA", label: "Configurações", icon: "S" }
];

function routeIsAllowed(route, authState) {
  if (!route.roles) return true;
  return route.roles.includes(authState?.role || "user");
}

export function renderMenu(currentPath, authState) {
  const menu = document.getElementById("main-menu");
  menu.innerHTML = routes.filter((route) => routeIsAllowed(route, authState)).map((route) => `
    <a class="nav-link" href="#${route.path}" ${route.path === currentPath ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${route.icon}</span>
      <span>${route.label}</span>
    </a>
  `).join("");
}

export function getRoute(path) {
  return routes.find((route) => route.path === path) || routes[0];
}

export function canAccessRoute(route, authState) {
  return routeIsAllowed(route, authState);
}
