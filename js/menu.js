export const routes = [
  { path: "/dashboard", title: "Dashboard", eyebrow: "Acompanhamento pessoal", label: "Dashboard", icon: "◷" },
  { path: "/perfil", title: "Perfil", eyebrow: "Dados corporais", label: "Perfil", icon: "◎" },
  { path: "/registro", title: "Novo registro", eyebrow: "Registro semanal", label: "Novo registro", icon: "+" },
  { path: "/historico", title: "Histórico", eyebrow: "Evolução registrada", label: "Histórico", icon: "≡" },
  { path: "/metas", title: "Metas", eyebrow: "Planejamento", label: "Metas", icon: "◇" },
  { path: "/configuracoes", title: "Configurações", eyebrow: "Dados e PWA", label: "Configurações", icon: "⚙" }
];

export function renderMenu(currentPath) {
  const menu = document.getElementById("main-menu");
  menu.innerHTML = routes.map((route) => `
    <a class="nav-link" href="#${route.path}" ${route.path === currentPath ? 'aria-current="page"' : ""}>
      <span class="nav-icon" aria-hidden="true">${route.icon}</span>
      <span>${route.label}</span>
    </a>
  `).join("");
}

export function getRoute(path) {
  return routes.find((route) => route.path === path) || routes[0];
}
