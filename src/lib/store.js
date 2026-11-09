const KEY = "camcap-pagamentos-v1";

export function loadState(seed) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.processos) && parsed.processos.length) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { processos: seed };
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function money(n) {
  return Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function todayISO() {
  const d = new Date();
  const z = (v) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export function dueDateThisMonth(day, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  const last = daysInMonth(y, m);
  const d = Math.min(Number(day) || 30, last);
  const z = (v) => String(v).padStart(2, "0");
  return `${y}-${z(m)}-${z(d)}`;
}

export function isPaidThisMonth(proc, ref = new Date()) {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  return (proc.pagamentos || []).some((p) => {
    if (!p.data) return false;
    const [yy, mm] = p.data.split("-").map(Number);
    return yy === y && mm === m;
  });
}

export function remaining(proc) {
  const pago = Number(proc.valorPago || 0);
  const total = Number(proc.valorAcordado || 0);
  return Math.max(0, Math.round((total - pago) * 100) / 100);
}

export function progress(proc) {
  if (!proc.totalParcelas) return 0;
  return Math.min(100, (Number(proc.parcelasPagas || 0) / proc.totalParcelas) * 100);
}

export function statusOf(proc, ref = new Date()) {
  const saldo = remaining(proc);
  if (saldo <= 0.009 || proc.status === "quitado") return "quitado";
  if (isPaidThisMonth(proc, ref)) return "pago";
  const due = dueDateThisMonth(proc.diaVencimento, ref);
  const today = todayISO();
  if (today > due) return "atrasado";
  const d1 = new Date(today + "T12:00:00");
  const d2 = new Date(due + "T12:00:00");
  const diff = (d2 - d1) / 86400000;
  if (diff <= 5) return "vence-hoje";
  return "em-dia";
}

export function statusLabel(s) {
  return {
    quitado: "Quitado",
    pago: "Pago no mes",
    atrasado: "Atrasado",
    "vence-hoje": "Vence em breve",
    "em-dia": "Em dia",
  }[s] || s;
}

export function waLink(phone, text) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const full = digits.length <= 11 ? "55" + digits : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export function cobrancaTexto(proc) {
  const saldo = remaining(proc);
  return (
    `Ola ${proc.demandado}, ` +
    `lembrete CAMCAP do processo ${proc.numero}. ` +
    `Parcela de ${money(proc.valorParcela)} vence no dia ${String(proc.diaVencimento).padStart(2, "0")} deste mes. ` +
    `Saldo restante: ${money(saldo)}.`
  );
}

export function registrarPagamento(proc, payload) {
  const valor = Number(payload.valor);
  const pago = Number(proc.valorPago || 0) + valor;
  const parcelasPagas = Number(proc.parcelasPagas || 0) + 1;
  const saldo = Math.max(0, Math.round((Number(proc.valorAcordado) - pago) * 100) / 100);
  const quitado = saldo <= 0.009 || parcelasPagas >= Number(proc.totalParcelas || 0);
  return {
    ...proc,
    valorPago: Math.round(pago * 100) / 100,
    parcelasPagas,
    saldo,
    status: quitado ? "quitado" : "andamento",
    pagamentos: [
      ...(proc.pagamentos || []),
      {
        id: "pg-" + Date.now(),
        data: payload.data || todayISO(),
        valor,
        forma: payload.forma || "PIX",
        obs: payload.obs || "",
        parcelaNumero: parcelasPagas,
        reciboNumero: `${proc.numero || "PROC"}-${String(parcelasPagas).padStart(3, "0")}`,
      },
    ],
  };
}

export function aliquotaCamcap(valor) {
  const v = Number(valor) || 0;
  if (v <= 0) return 0;
  if (v <= 50000) return 0.2;
  if (v <= 500000) return 0.1;
  return 0.05;
}

export function calcularHonorariosCamcap(valor) {
  const v = Number(valor) || 0;
  return Math.round(v * aliquotaCamcap(v) * 100) / 100;
}

export function aliquotaCamcapLabel(valor) {
  const a = aliquotaCamcap(valor);
  if (!a) return "";
  return `${Math.round(a * 100)}%`;
}

export function novoProcesso(data) {
  const valorCausa = Number(data.valorCausa || data.valorAcordado || 0);
  const valor = Number(data.valorAcordado || 0);
  const parcela = Number(data.valorParcela || 0);
  const nparc = Number(data.totalParcelas || 0) || (parcela ? Math.ceil(valor / parcela) : 0);
  return {
    id: "p-" + Date.now(),
    numero: data.numero || "",
    demandante: data.demandante || "",
    contatoDemandante: data.contatoDemandante || "",
    demandado: data.demandado || "",
    contatoDemandado: data.contatoDemandado || "",
    valorCausa,
    valorAcordado: valor,
    honorariosCamcap: Number(
      data.honorariosCamcap || calcularHonorariosCamcap(valorCausa || valor)
    ),
    valorParcela: parcela,
    totalParcelas: nparc,
    parcelasPagas: 0,
    valorPago: 0,
    saldo: valor,
    diaVencimento: Number(data.diaVencimento || 30),
    obs: data.obs || "",
    status: "andamento",
    pagamentos: [],
  };
}
