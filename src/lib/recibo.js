import { money } from "./store.js";
import { dataBr, valorExtenso } from "./extenso.js";

export const INSTITUICAO = {
  nome: "CAMARA DE ARBITRAGEM, MEDIACAO E CONCILIACAO DO AMAPA - CAMCAP",
  nomeCurto: "CAMCAP",
  cnpj: "24.584.883/0001-92",
  endereco: "Rua Odilardo Silva, n. 304/B - Bairro Jesus de Nazare, Macapa/AP - CEP 68.908-153",
  fone: "(96) 3242-4830",
};

const FORMAS = ["Dinheiro", "Cheque", "Cartao", "Transferencia Bancaria", "PIX"];

function check(forma, nome) {
  const a = String(forma || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const b = nome.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const ok = a.includes(b.slice(0, 6)) || b.includes(a.slice(0, 6));
  return ok ? "(x)" : "(  )";
}

function viaHtml(proc, pagamento, viaLabel) {
  const nParcela = pagamento.parcelaNumero || proc.parcelasPagas;
  const total = proc.totalParcelas || 0;
  const logo = `${location.origin}/logo-camcap.webp`;
  const formas = FORMAS.map((f) => `${check(pagamento.forma, f)} ${f}`).join("&nbsp;&nbsp;");
  return `
    <section class="via">
      <header class="head">
        <img src="${logo}" alt="CAMCAP" />
        <div>
          <strong>CAMCAP - CAMARA DE ARBITRAGEM, MEDIACAO E CONCILIACAO DO AMAPA</strong>
          <div>CNPJ - ${INSTITUICAO.cnpj}</div>
          <div>Matriz: ${INSTITUICAO.endereco}</div>
          <div>Fone - ${INSTITUICAO.fone}</div>
        </div>
      </header>
      <h1>RECIBO DE VALORES DE ACORDO</h1>
      <div class="meta">
        <span>Data: ${dataBr(pagamento.data)}</span>
        <span>Recibo de Pagamento n.o: ${pagamento.reciboNumero}</span>
        <span class="via-tag">${viaLabel}</span>
      </div>
      <p class="body">
        EU, <strong>${proc.demandante || "________________"}</strong>,
        contato ${proc.contatoDemandante || "______________"},
        <strong>RECEBEU</strong> de <strong>${proc.demandado || "________________"}</strong>,
        contato ${proc.contatoDemandado || "______________"}.
        O valor de <strong>${money(pagamento.valor)}</strong>
        (${valorExtenso(pagamento.valor)}),
        referente a parcela ${nParcela}${total ? " de " + total : ""}
        de pagamento acordado entre as partes mediante Clausula 13 do TERMO DE ACORDO
        com Sentenca Arbitral do processo N.o <strong>${proc.numero}</strong>.
      </p>
      <p>Forma de pagamento: ${formas}</p>
      <div class="sign">
        <div>______________________________________________</div>
        <div><strong>${proc.demandante || ""}</strong></div>
        <div>Demandante</div>
      </div>
    </section>
  `;
}

export function abrirRecibo(proc, pagamento) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo ${pagamento.reciboNumero}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", Times, serif; color: #111; }
    .sheet { padding: 0; }
    .via { border: 1.5px solid #1b5e20; padding: 14px 16px 18px; min-height: 128mm; }
    .via + .cut { margin: 8px 0 10px; border-top: 1px dashed #888; text-align: center; font-size: 10px; color: #666; letter-spacing: .2em; }
    .head { display: flex; gap: 12px; align-items: center; border-bottom: 2px solid #c62828; padding-bottom: 8px; }
    .head img { width: 78px; height: 78px; object-fit: contain; }
    .head div { font-size: 12px; line-height: 1.35; }
    .head strong { display: block; font-size: 13px; color: #1b5e20; margin-bottom: 2px; }
    h1 { text-align: center; font-size: 16px; margin: 12px 0 8px; letter-spacing: .06em; color: #c62828; }
    .meta { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 10px; gap: 8px; }
    .via-tag { font-weight: 700; color: #1b5e20; }
    .body { font-size: 13px; text-align: justify; line-height: 1.45; }
    .sign { margin-top: 28px; text-align: center; font-size: 12px; }
    .toolbar { display: flex; justify-content: flex-end; gap: 8px; margin: 8px 12px 12px; }
    .toolbar button { font-family: Arial, sans-serif; padding: 8px 14px; cursor: pointer; }
    @media print { .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Imprimir duas vias</button>
  </div>
  <div class="sheet">
    ${viaHtml(proc, pagamento, "1.a VIA - DEMANDANTE")}
    <div class="cut">recorte</div>
    ${viaHtml(proc, pagamento, "2.a VIA - CAMCAP")}
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 350); });</script>
</body>
</html>`;
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) {
    alert("Permita pop-ups para imprimir o recibo.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
