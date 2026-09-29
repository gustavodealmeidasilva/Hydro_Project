const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NAV = [["dashboard", "Dashboard", "bi-speedometer2"], ["dispositivos", "Dispositivos", "bi-cpu"]];

function toast(msg, type = "success") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.className = "toast-container position-fixed bottom-0 end-0 p-3"; document.body.append(box); }
  const el = document.createElement("div");
  el.className = `toast align-items-center text-bg-${type} border-0`; el.setAttribute("role", "alert");
  el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button></div>`;
  box.append(el); new bootstrap.Toast(el, { delay: 3500 }).show();
  el.addEventListener("hidden.bs.toast", () => el.remove());
}

const ALERT = { danger: ["bi-exclamation-octagon", "Alerta"], warning: ["bi-exclamation-triangle", "Aviso"], success: ["bi-check-circle", "Normal"] };
const alertIcon = t => `<i class="bi ${ALERT[t][0]} text-${t} me-1" aria-hidden="true"></i><span class="visually-hidden">${ALERT[t][1]}: </span>`;
const setTheme = t => { document.documentElement.dataset.bsTheme = t === "escuro" ? "dark" : "light"; };

/* Páginas protegidas: valida sessão, aplica tema e monta cabeçalho + menu lateral. */
async function initShell(active) {
  const [user, cfg] = await Promise.all([HydroAPI.getCurrentUser(), HydroAPI.getSettings()]);
  if (!user) { location.replace("login.html"); return null; }
  setTheme(cfg.tema);
  const alerts = await HydroAPI.getAlerts();
  $("#shell").innerHTML = `
  <header class="topbar navbar bg-body border-bottom px-3">
    <button class="btn d-lg-none" id="menuBtn" aria-label="Abrir menu" aria-controls="sidebar" aria-expanded="false"><i class="bi bi-list fs-3"></i></button>
    <a class="navbar-brand d-flex align-items-center gap-2 fw-bold text-hydro" href="dashboard.html" aria-label="HydroStats, início"><img src="assets/logo/logo_sem_texto.png" alt="" class="shell-logo"><span class="d-none d-sm-inline">HydroStats</span></a>
    <div class="ms-auto d-flex align-items-center gap-1">
      <button class="btn" id="themeBtn" aria-label="Alternar tema"><i class="bi ${cfg.tema === "escuro" ? "bi-sun" : "bi-moon"}" aria-hidden="true"></i></button>
      <div class="dropdown"><button class="btn position-relative" data-bs-toggle="dropdown" aria-label="Notificações, ${alerts.length} recentes"><i class="bi bi-bell" aria-hidden="true"></i><span class="badge rounded-pill bg-danger notif" aria-hidden="true">${alerts.length}</span></button>
        <ul class="dropdown-menu dropdown-menu-end p-2" style="min-width:290px">${alerts.map(a => `<li class="small py-1">${alertIcon(a.tipo)}${esc(a.texto)} <span class="text-muted">· ${a.quando}</span></li>`).join("")}</ul></div>
      <div class="dropdown"><button class="btn" data-bs-toggle="dropdown" aria-label="Conta de ${esc(user.nome)}"><i class="bi bi-person-circle me-1" aria-hidden="true"></i><span class="d-none d-sm-inline">${esc(user.nome)}</span></button>
        <ul class="dropdown-menu dropdown-menu-end"><li><span class="dropdown-item-text small text-muted">${esc(user.email)}</span></li><li><button class="dropdown-item" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Sair</button></li></ul></div>
    </div>
  </header>
  <nav class="sidebar bg-body border-end" id="sidebar" aria-label="Menu principal">${NAV.map(([p, t, i]) => `<a class="side-link ${p === active ? "active" : ""}" href="${p}.html"${p === active ? ' aria-current="page"' : ""}><i class="bi ${i}" aria-hidden="true"></i>${t}</a>`).join("")}</nav>`;
  const side = $("#sidebar"), menuBtn = $("#menuBtn");
  const setMenu = open => { side.classList.toggle("open", open); menuBtn.setAttribute("aria-expanded", open); };
  $(".main").addEventListener("click", () => setMenu(false));
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
  menuBtn.onclick = () => setMenu(!side.classList.contains("open"));
  $("#logoutBtn").onclick = async () => { await HydroAPI.logout(); location.href = "login.html"; };
  $("#themeBtn").onclick = async () => {
    const t = document.documentElement.dataset.bsTheme === "dark" ? "claro" : "escuro";
    await HydroAPI.updateSettings({ tema: t }); setTheme(t);
    document.dispatchEvent(new Event("themechange"));
    $("#themeBtn i").className = "bi " + (t === "escuro" ? "bi-sun" : "bi-moon");
  };
  return user;
}

const stateBox = (el, kind, msg, retry) => {
  el.innerHTML = kind === "loading" ? `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 text-muted">Carregando...</div></div>`
    : `<div class="alert alert-${kind === "error" ? "danger" : "info"} d-flex justify-content-between align-items-center">${esc(msg)}${retry ? `<button class="btn btn-sm btn-outline-danger" id="retryBtn">Tentar novamente</button>` : ""}</div>`;
  if (retry) $("#retryBtn").onclick = retry;
};
