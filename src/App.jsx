import { useEffect, useMemo, useState } from "react";
import seed from "./data/seed.json";
import {
  cobrancaTexto,
  dueDateThisMonth,
  isPaidThisMonth,
  loadState,
  money,
  novoProcesso,
  progress,
  registrarPagamento,
  remaining,
  saveState,
  statusLabel,
  statusOf,
  todayISO,
  waLink,
} from "./lib/store.js";

const FILTERS = [
  { id: "todos", label: "Todos" },
  { id: "atrasado", label: "Atrasados" },
  { id: "vence-hoje", label: "Vencem em breve" },
  { id: "pago", label: "Pagos no mes" },
  { id: "em-dia", label: "Em dia" },
  { id: "quitado", label: "Quitados" },
];

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(() => loadState(seed));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const processos = state.processos;

  const kpis = useMemo(() => {
    const ativos = processos.filter((p) => remaining(p) > 0.009);
    const aReceber = ativos.reduce((s, p) => s + remaining(p), 0);
    const pagoMes = processos.reduce((s, p) => {
      return (
        s +
        (p.pagamentos || [])
          .filter((x) => x.data && x.data.slice(0, 7) === todayISO().slice(0, 7))
          .reduce((a, x) => a + Number(x.valor || 0), 0)
      );
    }, 0);
    const atrasados = ativos.filter((p) => statusOf(p) === "atrasado").length;
    const vencem = ativos.filter((p) => {
      if (isPaidThisMonth(p)) return false;
      const due = dueDateThisMonth(p.diaVencimento);
      return due.slice(0, 7) === todayISO().slice(0, 7);
    }).length;
    return {
      processos: ativos.length,
      aReceber,
      pagoMes,
      atrasados,
      vencem,
    };
  }, [processos]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return processos
      .map((p) => ({ ...p, _status: statusOf(p), _saldo: remaining(p) }))
      .filter((p) => (filter === "todos" ? true : p._status === filter))
      .filter((p) => {
        if (!term) return true;
        return [
          p.numero,
          p.demandante,
          p.demandado,
          p.contatoDemandante,
          p.contatoDemandado,
        ]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => {
        const order = { atrasado: 0, "vence-hoje": 1, "em-dia": 2, pago: 3, quitado: 4 };
        const d = (order[a._status] ?? 9) - (order[b._status] ?? 9);
        if (d) return d;
        return a.diaVencimento - b.diaVencimento;
      });
  }, [processos, q, filter]);

  function updateProc(id, next) {
    setState((s) => ({
      processos: s.processos.map((p) => (p.id === id ? next : p)),
    }));
  }

  function addProc(data) {
    const p = novoProcesso(data);
    setState((s) => ({ processos: [p, ...s.processos] }));
    setCreating(false);
  }

  function pay(id, payload) {
    const p = processos.find((x) => x.id === id);
    if (!p) return;
    const next = registrarPagamento(p, payload);
    updateProc(id, next);
    setPaying(null);
    setSelected(next);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "camcap-pagamentos.json";
    a.click();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1 className="brand">CAMCAP Matriz</h1>
          <p className="sub">Controle de pagamentos mensais dos processos em andamento</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportJson}>Exportar backup</button>
          <button className="btn primary" onClick={() => setCreating(true)}>Novo processo</button>
        </div>
      </header>

      <section className="kpis">
        <div className="kpi">
          <span>Processos ativos</span>
          <strong>{kpis.processos}</strong>
        </div>
        <div className="kpi">
          <span>Saldo a receber</span>
          <strong>{money(kpis.aReceber)}</strong>
        </div>
        <div className="kpi">
          <span>Recebido neste mes</span>
          <strong>{money(kpis.pagoMes)}</strong>
        </div>
        <div className="kpi">
          <span>Atrasados / vencem no mes</span>
          <strong>{kpis.atrasados} / {kpis.vencem}</strong>
        </div>
      </section>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar processo, demandante ou demandado"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={"chip" + (filter === f.id ? " on" : "")}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        {list.length === 0 ? (
          <div className="empty">Nenhum processo encontrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Processo</th>
                <th>Partes</th>
                <th>Parcela / venc.</th>
                <th>Pago / saldo</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const pct = progress(p);
                const wa = waLink(p.contatoDemandado, cobrancaTexto(p));
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="names">{p.numero}</div>
                      <small className="muted">CAMCAP {money(p.honorariosCamcap)}</small>
                    </td>
                    <td>
                      <div className="names">
                        {p.demandante}
                        <small>vs {p.demandado}</small>
                      </div>
                    </td>
                    <td className="num">
                      {money(p.valorParcela)}
                      <small className="muted" style={{ display: "block" }}>
                        dia {String(p.diaVencimento).padStart(2, "0")} · {p.parcelasPagas}/{p.totalParcelas}
                      </small>
                      <div className="bar"><i style={{ width: pct + "%" }} /></div>
                    </td>
                    <td className="num">
                      {money(p.valorPago)}
                      <small className="muted" style={{ display: "block" }}>{money(p._saldo)} resta</small>
                    </td>
                    <td>
                      <span className={"badge " + p._status}>{statusLabel(p._status)}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn" onClick={() => setSelected(p)}>Abrir</button>
                        {p._status !== "quitado" && (
                          <button className="btn primary" onClick={() => setPaying(p)}>Baixar</button>
                        )}
                        {wa && p._status !== "quitado" && (
                          <a className="btn" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <Detail
          proc={processos.find((x) => x.id === selected.id) || selected}
          onClose={() => setSelected(null)}
          onPay={() => setPaying(processos.find((x) => x.id === selected.id) || selected)}
          onSave={(next) => {
            updateProc(selected.id, next);
            setSelected(next);
          }}
        />
      )}

      {paying && (
        <PayModal
          proc={processos.find((x) => x.id === paying.id) || paying}
          onClose={() => setPaying(null)}
          onConfirm={(payload) => pay(paying.id, payload)}
        />
      )}

      {creating && (
        <CreateModal onClose={() => setCreating(false)} onCreate={addProc} />
      )}
    </div>
  );
}

function Detail({ proc, onClose, onPay, onSave }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(proc);
  const st = statusOf(proc);
  const wa = waLink(proc.contatoDemandado, cobrancaTexto(proc));

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{proc.numero}</h2>
        <p className="sub">
          {proc.demandante} vs {proc.demandado} · <span className={"badge " + st}>{statusLabel(st)}</span>
        </p>

        {!edit ? (
          <>
            <div className="grid">
              <Field label="Demandante">{proc.demandante}<div className="muted">{proc.contatoDemandante}</div></Field>
              <Field label="Demandado">{proc.demandado}<div className="muted">{proc.contatoDemandado}</div></Field>
              <Field label="Valor acordado">{money(proc.valorAcordado)}</Field>
              <Field label="Honorarios CAMCAP">{money(proc.honorariosCamcap)}</Field>
              <Field label="Parcela">{money(proc.valorParcela)} · dia {proc.diaVencimento}</Field>
              <Field label="Parcelas">{proc.parcelasPagas} de {proc.totalParcelas}</Field>
              <Field label="Pago">{money(proc.valorPago)}</Field>
              <Field label="Saldo">{money(remaining(proc))}</Field>
              {proc.obs ? <Field label="Obs" className="full">{proc.obs}</Field> : null}
            </div>
            <div className="actions">
              {st !== "quitado" && <button className="btn primary" onClick={onPay}>Registrar pagamento</button>}
              {wa && <a className="btn" href={wa} target="_blank" rel="noreferrer">Cobrar no WhatsApp</a>}
              <button className="btn" onClick={() => { setForm(proc); setEdit(true); }}>Editar</button>
              <button className="btn ghost" onClick={onClose}>Fechar</button>
            </div>
            <div className="pay-list">
              <h3>Historico de baixas</h3>
              {(proc.pagamentos || []).length === 0 ? (
                <p className="muted">Ainda nao ha pagamentos registrados neste sistema. O valor pago veio da planilha.</p>
              ) : (
                <ul>
                  {[...proc.pagamentos].reverse().map((pg) => (
                    <li key={pg.id}>
                      <span>{pg.data} · {pg.forma}{pg.obs ? " · " + pg.obs : ""}</span>
                      <strong>{money(pg.valor)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSave({
                ...proc,
                ...form,
                valorAcordado: Number(form.valorAcordado),
                honorariosCamcap: Number(form.honorariosCamcap),
                valorParcela: Number(form.valorParcela),
                totalParcelas: Number(form.totalParcelas),
                parcelasPagas: Number(form.parcelasPagas),
                valorPago: Number(form.valorPago),
                diaVencimento: Number(form.diaVencimento),
                saldo: remaining({ ...proc, ...form, valorPago: Number(form.valorPago), valorAcordado: Number(form.valorAcordado) }),
              });
              setEdit(false);
            }}
          >
            <div className="grid">
              <Field label="N. processo"><input value={form.numero} onChange={(e) => set("numero", e.target.value)} /></Field>
              <Field label="Dia vencimento"><input type="number" min="1" max="31" value={form.diaVencimento} onChange={(e) => set("diaVencimento", e.target.value)} /></Field>
              <Field label="Demandante"><input value={form.demandante} onChange={(e) => set("demandante", e.target.value)} /></Field>
              <Field label="Contato demandante"><input value={form.contatoDemandante} onChange={(e) => set("contatoDemandante", e.target.value)} /></Field>
              <Field label="Demandado"><input value={form.demandado} onChange={(e) => set("demandado", e.target.value)} /></Field>
              <Field label="Contato demandado"><input value={form.contatoDemandado} onChange={(e) => set("contatoDemandado", e.target.value)} /></Field>
              <Field label="Valor acordado"><input type="number" step="0.01" value={form.valorAcordado} onChange={(e) => set("valorAcordado", e.target.value)} /></Field>
              <Field label="Honorarios CAMCAP"><input type="number" step="0.01" value={form.honorariosCamcap} onChange={(e) => set("honorariosCamcap", e.target.value)} /></Field>
              <Field label="Valor parcela"><input type="number" step="0.01" value={form.valorParcela} onChange={(e) => set("valorParcela", e.target.value)} /></Field>
              <Field label="N. parcelas"><input type="number" value={form.totalParcelas} onChange={(e) => set("totalParcelas", e.target.value)} /></Field>
              <Field label="Parcelas pagas"><input type="number" value={form.parcelasPagas} onChange={(e) => set("parcelasPagas", e.target.value)} /></Field>
              <Field label="Valor pago"><input type="number" step="0.01" value={form.valorPago} onChange={(e) => set("valorPago", e.target.value)} /></Field>
              <Field label="Obs" className="full"><textarea value={form.obs} onChange={(e) => set("obs", e.target.value)} /></Field>
            </div>
            <div className="actions">
              <button className="btn primary" type="submit">Salvar</button>
              <button className="btn ghost" type="button" onClick={() => setEdit(false)}>Cancelar</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function PayModal({ proc, onClose, onConfirm }) {
  const [valor, setValor] = useState(proc.valorParcela);
  const [data, setData] = useState(todayISO());
  const [forma, setForma] = useState("PIX");
  const [obs, setObs] = useState("");

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Baixar parcela</h2>
        <p className="sub">{proc.numero} · {proc.demandado} · saldo {money(remaining(proc))}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm({ valor: Number(valor), data, forma, obs });
          }}
        >
          <div className="grid">
            <Field label="Valor"><input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} required /></Field>
            <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} required /></Field>
            <Field label="Forma">
              <select value={forma} onChange={(e) => setForma(e.target.value)}>
                <option>PIX</option>
                <option>Dinheiro</option>
                <option>Transferencia</option>
                <option>Cartao</option>
              </select>
            </Field>
            <Field label="Obs"><input value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
          </div>
          <div className="actions">
            <button className="btn primary" type="submit">Confirmar baixa</button>
            <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    numero: "",
    demandante: "",
    contatoDemandante: "",
    demandado: "",
    contatoDemandado: "",
    valorAcordado: "",
    honorariosCamcap: "",
    valorParcela: "",
    totalParcelas: "",
    diaVencimento: 30,
    obs: "",
  });
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo processo</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(form);
          }}
        >
          <div className="grid">
            <Field label="N. processo"><input value={form.numero} onChange={(e) => set("numero", e.target.value)} required /></Field>
            <Field label="Dia vencimento"><input type="number" min="1" max="31" value={form.diaVencimento} onChange={(e) => set("diaVencimento", e.target.value)} /></Field>
            <Field label="Demandante"><input value={form.demandante} onChange={(e) => set("demandante", e.target.value)} required /></Field>
            <Field label="Contato demandante"><input value={form.contatoDemandante} onChange={(e) => set("contatoDemandante", e.target.value)} /></Field>
            <Field label="Demandado"><input value={form.demandado} onChange={(e) => set("demandado", e.target.value)} required /></Field>
            <Field label="Contato demandado"><input value={form.contatoDemandado} onChange={(e) => set("contatoDemandado", e.target.value)} /></Field>
            <Field label="Valor acordado"><input type="number" step="0.01" value={form.valorAcordado} onChange={(e) => set("valorAcordado", e.target.value)} required /></Field>
            <Field label="Honorarios CAMCAP"><input type="number" step="0.01" value={form.honorariosCamcap} onChange={(e) => set("honorariosCamcap", e.target.value)} /></Field>
            <Field label="Valor parcela"><input type="number" step="0.01" value={form.valorParcela} onChange={(e) => set("valorParcela", e.target.value)} required /></Field>
            <Field label="N. parcelas"><input type="number" value={form.totalParcelas} onChange={(e) => set("totalParcelas", e.target.value)} /></Field>
            <Field label="Obs" className="full"><textarea value={form.obs} onChange={(e) => set("obs", e.target.value)} /></Field>
          </div>
          <div className="actions">
            <button className="btn primary" type="submit">Cadastrar</button>
            <button className="btn ghost" type="button" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
