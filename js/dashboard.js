let lineChart, barChart, range = "7d", lastFlow = 3.4, loadedAt = Date.now(), data = null;
const L = v => v.toLocaleString("pt-BR") + " L";
const RANGE_TXT = { hoje: "hoje, hora a hora", "7d": "nos últimos 7 dias", "30d": "nos últimos 30 dias" };

const isDark = () => document.documentElement.dataset.bsTheme === "dark";
const brandColor = () => isDark() ? "#8fc1e8" : "#0a3a64";

function draw(ch, canvas, type, points, color, bg) {
  ch?.destroy();
  Chart.defaults.color = isDark() ? "#c8d3dc" : "#495057";
  Chart.defaults.borderColor = isDark() ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.1)";
  return new Chart(canvas, {
    type,
    data: { labels: points.map(p => p.rotulo), datasets: [{ label: "Litros", data: points.map(p => p.litros), borderColor: color, backgroundColor: bg ?? (type === "bar" ? color : color + "33"), fill: type === "line", tension: .3, borderRadius: type === "bar" ? 4 : 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => L(c.parsed.y) } } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "Litros" } } }
    }
  });
}

/* Descrição textual do gráfico para leitores de tela */
function describe(canvas, nome, points, periodo) {
  const v = points.map(p => p.litros);
  canvas.setAttribute("aria-label", `${nome} ${periodo}. Mínimo: ${L(Math.min(...v))}. Máximo: ${L(Math.max(...v))}.`);
}

function renderSeries() {
  lineChart = draw(lineChart, $("#line"), "line", data.serie, brandColor());
  describe($("#line"), "Gráfico de linha do consumo de água", data.serie, RANGE_TXT[range]);
}

function renderBars() {
  const last = data.comparacao.length - 1;
  const bg = data.comparacao.map((_, i) => i === last ? brandColor() : "#6e9bbb");
  barChart = draw(barChart, $("#bar"), "bar", data.comparacao, "#6e9bbb", bg);
  describe($("#bar"), "Gráfico de barras do consumo diário", data.comparacao, "nos últimos 7 dias, com hoje em destaque");
}

async function load() {
  stateBox($("#state"), "loading");
  try {
    const d = await HydroAPI.getDashboardData(range);
    data = d;
    $("#state").innerHTML = ""; $("#content").hidden = false;
    $("#flow").textContent = d.cards.fluxo.toLocaleString("pt-BR");
    $("#var").innerHTML = `<span class="text-${d.cards.variacao <= 0 ? "success" : "danger"}"><i class="bi bi-arrow-${d.cards.variacao <= 0 ? "down" : "up"}" aria-hidden="true"></i> ${Math.abs(d.cards.variacao)}% vs. ontem</span>`;
    $("#hoje").textContent = L(d.cards.hoje); $("#mes").textContent = L(d.cards.mes); $("#eco").textContent = d.cards.economia + "%";
    renderSeries(); renderBars();
    $("#status").innerHTML = [["Internet", d.status.internet], ["Sensor", d.status.sensor], ["Dispositivo", d.status.dispositivo, d.status.dispositivoOk]]
      .map(([k, v, okk = true]) => `<li class="d-flex justify-content-between py-2 border-bottom">${k}<span class="badge text-bg-${okk ? "success" : "warning"}">${v}</span></li>`).join("")
      + `<li class="d-flex justify-content-between py-2">Última atualização<span id="upd" class="text-muted">agora</span></li>`;
    $("#alerts").innerHTML = d.alertas.map(a => `<li class="list-group-item px-0">${alertIcon(a.tipo)}${esc(a.texto)} <small class="text-muted">· ${a.quando}</small></li>`).join("");
  } catch (e) { console.error(e); stateBox($("#state"), "error", "Não foi possível carregar os dados.", load); }
}

/* Trocar de período atualiza só o gráfico de linha: sem spinner, sem reflow da página */
async function setRange(b) {
  const prev = range;
  range = b.dataset.r;
  document.querySelectorAll("[data-r]").forEach(x => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
  try {
    const d = await HydroAPI.getDashboardData(range);
    if (range !== b.dataset.r) return; // o usuário já escolheu outro período
    data.serie = d.serie; renderSeries();
  } catch (e) {
    console.error(e); range = prev;
    document.querySelectorAll("[data-r]").forEach(x => { const on = x.dataset.r === prev; x.classList.toggle("active", on); x.setAttribute("aria-pressed", on); });
    toast("Não foi possível atualizar o gráfico.", "danger");
  }
}

/* Trocar de tema só redesenha os gráficos com os dados já carregados */
document.addEventListener("themechange", () => { if (data) { renderSeries(); renderBars(); } });
document.querySelectorAll("[data-r]").forEach(b => { b.setAttribute("aria-pressed", b.classList.contains("active")); b.onclick = () => setRange(b); });

initShell("dashboard").then(u => {
  if (!u) return;
  load();
  // Simulação de leitura do sensor; troque por dados reais da API.
  HydroAPI.subscribeFlow(v => {
    loadedAt = Date.now();
    $("#flow").textContent = v.toLocaleString("pt-BR");
    const diff = v - lastFlow; lastFlow = v;
    $("#var").innerHTML = `<span class="text-${diff <= 0 ? "success" : "danger"}"><i class="bi bi-arrow-${diff <= 0 ? "down" : "up"}" aria-hidden="true"></i> ${Math.abs(diff).toFixed(1).replace(".", ",")} L/min vs. leitura anterior</span>`;
  });
  setInterval(() => { const el = $("#upd"); if (el) el.textContent = "há " + Math.round((Date.now() - loadedAt) / 1000) + " s"; }, 1000);
});
