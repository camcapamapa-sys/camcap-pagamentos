const UNIDADES = [
  "", "um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function grupo(n) {
  n = Math.floor(n);
  if (n === 0) return "";
  if (n === 100) return "cem";
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return DEZENAS[d] + (u ? " e " + UNIDADES[u] : "");
  }
  const c = Math.floor(n / 100);
  const r = n % 100;
  return CENTENAS[c] + (r ? " e " + grupo(r) : "");
}

function classe(n, singular, plural) {
  if (!n) return "";
  const txt = grupo(n);
  return n === 1 ? `${txt} ${singular}` : `${txt} ${plural}`;
}

export function valorExtenso(valor) {
  const n = Math.round(Number(valor || 0) * 100) / 100;
  if (n === 0) return "zero reais";
  const inteiro = Math.floor(n);
  const cents = Math.round((n - inteiro) * 100);
  const milhoes = Math.floor(inteiro / 1_000_000);
  const milhares = Math.floor((inteiro % 1_000_000) / 1000);
  const resto = inteiro % 1000;
  const partes = [];
  if (milhoes) partes.push(classe(milhoes, "milhao", "milhoes"));
  if (milhares) partes.push(milhares === 1 ? "mil" : grupo(milhares) + " mil");
  if (resto) partes.push(grupo(resto));
  let reais = partes.join(" e ");
  if (!reais) reais = "";
  const realTxt = inteiro === 1 ? "real" : "reais";
  let out = inteiro ? `${reais} ${realTxt}` : "";
  if (cents) {
    const centTxt = cents === 1 ? "centavo" : "centavos";
    out += (out ? " e " : "") + `${grupo(cents)} ${centTxt}`;
  }
  return out;
}

export function dataBr(iso) {
  if (!iso) return "__/__/____";
  const [y, m, d] = String(iso).split("-");
  if (!d) return iso;
  return `${d}/${m}/${y}`;
}
