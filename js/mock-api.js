/* Camada de serviços do HydroStats. Para usar o backend real, reimplemente cada função com fetch("/api/...")
   mantendo os mesmos nomes e formatos de retorno; as telas não precisam mudar. */
const HydroAPI = (() => {
  const P = "hs_", ls = localStorage;
  const read = (k, d) => { try { const v = ls.getItem(P + k); return v === null ? d : JSON.parse(v); } catch { return d; } };
  const write = (k, v) => ls.setItem(P + k, JSON.stringify(v));
  const wait = v => new Promise(r => setTimeout(() => r(structuredClone(v)), 200));
  const fail = m => new Promise((_, j) => setTimeout(() => j(new Error(m)), 200));
  const pub = ({ senha, ...u }) => u;
  const sess = () => { try { return JSON.parse(sessionStorage.getItem(P + "session") || ls.getItem(P + "session") || "null"); } catch { return null; } };

  if (!read("users")) write("users", [{ id: 1, nome: "Usuário Demo", email: "demo@hydrostats.com", senha: "123456", criadoEm: "2026-01-10" }]);
  if (!read("devices")) write("devices", [
    { id: "HYDRO-001", nome: "HydroStats Casa", local: "Cozinha", status: "online", ultimaConexao: "agora", consumoAtual: 3.4 },
    { id: "HYDRO-002", nome: "HydroStats Jardim", local: "Área externa", status: "offline", ultimaConexao: "há 2 horas", consumoAtual: 0 }]);
  if (!read("settings")) write("settings", { tema: "claro", unidade: "L", intervalo: 5 });

  const daily = n => Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (n - 1 - i));
    const k = Math.floor(d / 864e5);
    return { data: d.toISOString().slice(0, 10), litros: Math.round(160 + 40 * Math.sin(k * 1.3) + 25 * Math.cos(k * 2.9)) };
  });
  const hourly = () => {
    const w = [1, 1, 1, 1, 1, 2, 8, 14, 9, 5, 4, 6, 12, 10, 5, 4, 5, 9, 14, 15, 10, 6, 3, 2];
    return w.slice(0, Math.max(new Date().getHours(), 18) + 1) /* demo: nunca menos que o dia quase completo */.map((v, i) => ({ rotulo: i + "h", litros: v + (i % 3) }));
  };
  const fmt = p => ({ rotulo: p.data.slice(8) + "/" + p.data.slice(5, 7), litros: p.litros });
  const sum = a => a.reduce((s, p) => s + p.litros, 0);
  const alertas = [
    { tipo: "danger", texto: "Consumo acima do esperado às 07h", quando: "há 2 h" },
    { tipo: "success", texto: "Sensor funcionando normalmente", quando: "há 3 h" },
    { tipo: "warning", texto: "Dispositivo reconectado", quando: "ontem" }];

  return {
    async login(email, senha, lembrar) {
      const u = read("users", []).find(x => x.email.toLowerCase() === email.toLowerCase() && x.senha === senha);
      if (!u) return fail("E-mail ou senha incorretos.");
      (lembrar ? ls : sessionStorage).setItem(P + "session", JSON.stringify(pub(u)));
      return wait(pub(u));
    },
    async logout() { ls.removeItem(P + "session"); sessionStorage.removeItem(P + "session"); return wait(true); },
    async register({ nome, email, senha }) {
      const users = read("users", []);
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return fail("Este e-mail já está cadastrado.");
      const u = { id: Date.now(), nome, email, senha, criadoEm: new Date().toISOString().slice(0, 10) };
      write("users", [...users, u]); return wait(pub(u));
    },
    async requestPasswordReset() { return wait(true); },
    async getCurrentUser() { return wait(sess()); },
    async getSettings() { return wait(read("settings")); },
    async updateSettings(patch) { const s = { ...read("settings"), ...patch }; write("settings", s); return wait(s); },
    async getAlerts() { return wait(alertas); },
    async getDashboardData(range = "7d") {
      const h = hourly(), d30 = daily(30), devs = read("devices", []), on = devs.filter(d => d.status === "online").length;
      const serie = range === "hoje" ? h : daily(range === "30d" ? 30 : 7).map(fmt);
      const dias = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      return wait({
        cards: { fluxo: 3.4, variacao: -4, hoje: sum(h), mes: sum(d30), economia: 12 },
        serie,
        comparacao: daily(7).map(p => ({ rotulo: dias[new Date(p.data + "T12:00").getDay()], litros: p.litros })),
        status: { internet: "Online", sensor: "Funcionando", dispositivo: on === devs.length && devs.length ? "Online" : on + " de " + devs.length + " online", dispositivoOk: on === devs.length && devs.length > 0 }, alertas
      });
    },
    async getConsumption(dias = 30) { return wait(daily(dias)); },
    async getDevices() { return wait(read("devices", [])); },
    async getDeviceById(id) { const d = read("devices", []).find(x => x.id === id); return d ? wait(d) : fail("Dispositivo não encontrado."); },
    async createDevice({ nome, local }) {
      const ds = read("devices", []);
      const n = ds.reduce((m, d) => Math.max(m, parseInt(d.id.split("-")[1], 10) || 0), 0) + 1;
      const d = { id: "HYDRO-" + String(n).padStart(3, "0"), nome, local, status: "online", ultimaConexao: "agora", consumoAtual: 0 };
      write("devices", [...ds, d]); return wait(d);
    },
    async updateDevice(id, patch) {
      const ds = read("devices", []).map(d => d.id === id ? { ...d, ...patch, id } : d);
      write("devices", ds); return wait(ds.find(d => d.id === id));
    },
    async deleteDevice(id) { write("devices", read("devices", []).filter(d => d.id !== id)); return wait(true); },
    async updateProfile(patch) {
      const cur = sess(); const users = read("users", []).map(u => u.id === cur.id ? { ...u, ...patch } : u);
      write("users", users); const nu = pub(users.find(u => u.id === cur.id));
      (sessionStorage.getItem(P + "session") ? sessionStorage : ls).setItem(P + "session", JSON.stringify(nu));
      return wait(nu);
    },
    /* Simulação do ESP8266: remova quando a leitura real (polling/WebSocket) existir. Retorna a função de cancelamento. */
    subscribeFlow(cb, ms = 3000) {
      const t = setInterval(() => cb(+(2.5 + Math.random() * 1.5).toFixed(1)), ms);
      return () => clearInterval(t);
    }
  };
})();
