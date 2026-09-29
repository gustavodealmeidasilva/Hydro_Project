let devices = [], editing = null, removing = null, dm, xm;

async function load() {
  stateBox($("#state"), "loading"); $("#list").innerHTML = "";
  try {
    devices = await HydroAPI.getDevices(); $("#state").innerHTML = "";
    if (!devices.length) {
      $("#state").innerHTML = `<div class="text-center p-5"><p class="text-muted">Nenhum dispositivo cadastrado.</p><button class="btn btn-hydro" id="empty">Adicionar dispositivo</button></div>`;
      $("#empty").onclick = () => openForm(); return;
    }
    $("#list").innerHTML = devices.map(d => `<div class="col-md-6 col-xl-4"><div class="card p-3 h-100">
      <div class="d-flex justify-content-between"><h2 class="h5 mb-0">${esc(d.nome)}</h2><span class="badge text-bg-${d.status === "online" ? "success" : "secondary"}">${d.status === "online" ? "Online" : "Offline"}</span></div>
      <div class="text-muted small mb-2">ID: ${esc(d.id)}</div>
      <div><i class="bi bi-geo-alt"></i> ${esc(d.local)}</div><div><i class="bi bi-clock"></i> Última conexão: ${esc(d.ultimaConexao)}</div>
      <div class="mb-3"><i class="bi bi-droplet" aria-hidden="true"></i> Consumo atual: ${d.status === "online" ? d.consumoAtual.toLocaleString("pt-BR") + " L/min" : "sem leitura"}</div>
      <div class="mt-auto d-flex gap-2"><button class="btn btn-sm btn-outline-primary" data-edit="${esc(d.id)}"><i class="bi bi-pencil"></i> Editar</button><button class="btn btn-sm btn-outline-danger" data-del="${esc(d.id)}"><i class="bi bi-trash"></i> Excluir</button></div></div></div>`).join("");
    document.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openForm(devices.find(d => d.id === b.dataset.edit)));
    document.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
      removing = devices.find(d => d.id === b.dataset.del);
      $("#xb").textContent = `Excluir "${removing.nome}" (${removing.id})? Esta ação não pode ser desfeita.`; xm.show();
    });
  } catch { stateBox($("#state"), "error", "Não foi possível carregar os dispositivos.", load); }
}

function openForm(d = null) {
  editing = d; $("#dmt").textContent = d ? "Editar dispositivo" : "Adicionar dispositivo";
  $("#dn").value = d?.nome ?? ""; $("#dl").value = d?.local ?? "";
  ["#dn", "#dl"].forEach(s => $(s).classList.remove("is-invalid")); dm.show();
}

initShell("dispositivos").then(u => {
  if (!u) return;
  dm = new bootstrap.Modal("#dm"); xm = new bootstrap.Modal("#xm");
  $("#add").onclick = () => openForm();
  $("#df").onsubmit = async e => {
    e.preventDefault();
    const n = $("#dn"), l = $("#dl");
    n.classList.toggle("is-invalid", !n.value.trim()); l.classList.toggle("is-invalid", !l.value.trim());
    if (!n.value.trim() || !l.value.trim()) return;
    const data = { nome: n.value.trim(), local: l.value.trim() };
    try {
      editing ? await HydroAPI.updateDevice(editing.id, data) : await HydroAPI.createDevice(data);
      dm.hide(); toast(editing ? "Dispositivo atualizado." : "Dispositivo adicionado."); load();
    } catch (err) { toast(err.message, "danger"); }
  };
  $("#xok").onclick = async () => {
    try { await HydroAPI.deleteDevice(removing.id); xm.hide(); toast("Dispositivo excluído."); load(); }
    catch (err) { toast(err.message, "danger"); }
  };
  load();
});
