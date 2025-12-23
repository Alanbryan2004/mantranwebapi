// src/pages/MinhasTarefas.jsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, rpc } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function MinhasTarefas() {
  const { user } = useAuth();

  const [tarefas, setTarefas] = useState([]);
  const [apontAbertos, setApontAbertos] = useState([]); // lista de controle_api_id com fim null
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busyId, setBusyId] = useState(null);

  const tecnicoId = user?.id; // UUID
  const tecnicoNome = user?.nome;

  async function carregar() {
    if (!tecnicoId) return;

    setLoading(true);
    setErro("");
    try {
      // 1) Minhas tarefas (atribuídas ao técnico)
      const rows = await apiGet(
        `/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,nivel_api,peso_api,qtd_campos,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,observacoes,modulo,data_inicio,data_fim_real` +
          `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}` +
          `&order=created_at.asc`
      );

      // 2) Apontamentos abertos (fim is null) do técnico
      // Queremos saber quais tarefas estão "rodando" de verdade (timer aberto)
      const abertos = await apiGet(
        `/rest/v1/apontamento_tempo?select=controle_api_id` +
          `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}` +
          `&fim=is.null` +
          `&order=inicio.desc`
      );

      setTarefas(rows || []);
      setApontAbertos((abertos || []).map((x) => x.controle_api_id));
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tecnicoId]);

  const resumo = useMemo(() => {
    const total = tarefas.length;

    // pendente = ainda não está OK nos 3
    const concluidas = tarefas.filter((t) => isConcluida(t)).length;

    // trabalhando = tem apontamento aberto
    const trabalhando = tarefas.filter((t) => apontAbertos.includes(t.id)).length;

    // pendentes = total - concluidas (independente de estar pausado/rodando)
    const pendentes = total - concluidas;

    return { total, pendentes, trabalhando, concluidas };
  }, [tarefas, apontAbertos]);

  async function iniciar(tarefa) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      await rpc("iniciar_trabalho", {
        p_controle_api_id: tarefa.id,
        p_tecnico_id: tecnicoId,
        p_tecnico_nome: tecnicoNome,
      });
      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function pausar(tarefa) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      await rpc("pausar_trabalho", {
        p_controle_api_id: tarefa.id,
        p_tecnico_id: tecnicoId,
      });
      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function retomar(tarefa) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      await rpc("retomar_trabalho", {
        p_controle_api_id: tarefa.id,
        p_tecnico_id: tecnicoId,
        p_tecnico_nome: tecnicoNome,
      });
      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function finalizar(tarefa) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      await rpc("finalizar_trabalho", {
        p_controle_api_id: tarefa.id,
        p_tecnico_id: tecnicoId,
      });
      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function mudarStatus(tarefa, campo, status) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      await rpc("atualizar_status", {
        p_controle_api_id: tarefa.id,
        p_campo: campo, // status_api | status_teste | status_documentacao
        p_status: status, // Trabalhando | OK
      });
      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  // (Opcional) salvar observações direto por PATCH no PostgREST
  async function salvarObs(tarefa, texto) {
    setBusyId(tarefa.id);
    setErro("");
    try {
      // PATCH em PostgREST
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const res = await fetch(`${baseUrl}/rest/v1/controle_api?id=eq.${tarefa.id}`, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ observacoes: texto }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Minhas Tarefas">
      {loading ? <div>Carregando...</div> : null}
      {erro ? <div style={styles.err}>{erro}</div> : null}

      {!loading && (
        <>
          <div style={styles.grid}>
            <Card title="Total" value={resumo.total} />
            <Card title="Pendentes" value={resumo.pendentes} />
            <Card title="Trabalhando" value={resumo.trabalhando} />
            <Card title="Concluídas (OK)" value={resumo.concluidas} />
          </div>

          <div style={{ height: 14 }} />

          <div style={styles.list}>
            {tarefas.length === 0 ? (
              <div style={{ padding: 14, color: "#6b7280" }}>
                Nenhuma tarefa atribuída a você ainda.
              </div>
            ) : (
              tarefas.map((t) => {
                const aberto = apontAbertos.includes(t.id);
                const concl = isConcluida(t);
                const podeFinalizar = t.status_api === "OK" && t.status_teste === "OK" && t.status_documentacao === "OK";
                const isBusy = busyId === t.id;

                return (
                  <div key={t.id} style={styles.taskCard}>
                    <div style={styles.taskTop}>
                      <div>
                        <div style={styles.taskTitle}>{t.nome_tabela}</div>
                        <div style={styles.taskSub}>
                          Tela: <b>{t.tela}</b> | Tipo: <b>{t.tipo_tabela}</b> | Nível:{" "}
                          <b>{t.nivel_api}</b> | Campos: <b>{t.qtd_campos}</b>
                        </div>
                        <div style={styles.taskSub}>
                          Módulo: <b>{t.modulo}</b>
                          {t.data_inicio ? (
                            <>
                              {" "}
                              | Início: <b>{formatDateTime(t.data_inicio)}</b>
                            </>
                          ) : null}
                          {t.data_fim_real ? (
                            <>
                              {" "}
                              | Fim: <b>{formatDateTime(t.data_fim_real)}</b>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div style={styles.statePill}>
                        {concl ? "OK" : aberto ? "Em andamento" : "Pausado/Não iniciado"}
                      </div>
                    </div>

                    <div style={styles.actions}>
                      <button
                        style={btn(!aberto && !concl)}
                        disabled={isBusy || concl || aberto}
                        onClick={() => iniciar(t)}
                      >
                        ▶ Iniciar
                      </button>

                      <button
                        style={btn(aberto && !concl)}
                        disabled={isBusy || concl || !aberto}
                        onClick={() => pausar(t)}
                      >
                        ⏸ Pausar
                      </button>

                      <button
                        style={btn(!aberto && !concl)}
                        disabled={isBusy || concl || aberto}
                        onClick={() => retomar(t)}
                      >
                        ⏵ Retomar
                      </button>

                      <button
                        style={btnDanger(podeFinalizar && !aberto && !concl)}
                        disabled={isBusy || concl || aberto || !podeFinalizar}
                        onClick={() => finalizar(t)}
                        title={!podeFinalizar ? "Só finaliza quando API, Teste e Doc estiverem OK" : ""}
                      >
                        ⏹ Finalizar
                      </button>
                    </div>

                    <div style={styles.statusRow}>
                      <StatusSelect
                        label="API"
                        value={t.status_api}
                        disabled={isBusy || concl}
                        onChange={(v) => mudarStatus(t, "status_api", v)}
                      />
                      <StatusSelect
                        label="Teste"
                        value={t.status_teste}
                        disabled={isBusy || concl}
                        onChange={(v) => mudarStatus(t, "status_teste", v)}
                      />
                      <StatusSelect
                        label="Doc"
                        value={t.status_documentacao}
                        disabled={isBusy || concl}
                        onChange={(v) => mudarStatus(t, "status_documentacao", v)}
                      />
                    </div>

                    <div style={styles.obsWrap}>
                      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Observações</div>
                      <textarea
                        style={styles.textarea}
                        defaultValue={t.observacoes || ""}
                        placeholder="Anote aqui qualquer detalhe, pendência, decisão..."
                        disabled={isBusy}
                        onBlur={(e) => {
                          const v = e.target.value || null;
                          if ((t.observacoes || "") !== (v || "")) salvarObs(t, v);
                        }}
                      />
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                        Dica: salva automaticamente ao sair do campo (blur).
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function isConcluida(t) {
  return t.status_api === "OK" && t.status_teste === "OK" && t.status_documentacao === "OK";
}

function formatDateTime(v) {
  try {
    const d = new Date(v);
    return d.toLocaleString("pt-BR");
  } catch {
    return String(v);
  }
}

function StatusSelect({ label, value, onChange, disabled }) {
  return (
    <div style={styles.statusBox}>
      <div style={styles.statusLabel}>{label}</div>
      <select
        style={styles.select}
        value={value || "Trabalhando"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="Trabalhando">Trabalhando</option>
        <option value="OK">OK</option>
      </select>
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

function btn(active) {
  return {
    ...styles.btn,
    opacity: active ? 1 : 0.65,
  };
}

function btnDanger(active) {
  return {
    ...styles.btn,
    borderColor: active ? "#ef4444" : "#e5e7eb",
    color: active ? "#ef4444" : "#111827",
    opacity: active ? 1 : 0.65,
  };
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900, color: "#111827", marginTop: 6 },

  list: { background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 10 },

  taskCard: {
    border: "1px solid #f3f4f6",
    borderRadius: 14,
    padding: 14,
    margin: 10,
    background: "#fff",
  },
  taskTop: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  taskTitle: { fontSize: 16, fontWeight: 900, color: "#111827" },
  taskSub: { fontSize: 13, color: "#374151", marginTop: 4 },

  statePill: {
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: 999,
    padding: "6px 10px",
    whiteSpace: "nowrap",
  },

  actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  btn: {
    fontSize: 13,
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
  },

  statusRow: { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginTop: 12 },
  statusBox: { border: "1px solid #f3f4f6", borderRadius: 12, padding: 10, background: "#fafafa" },
  statusLabel: { fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 800 },
  select: { width: "100%", padding: 8, borderRadius: 10, border: "1px solid #e5e7eb" },

  obsWrap: { marginTop: 12 },
  textarea: {
    width: "100%",
    minHeight: 70,
    resize: "vertical",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    padding: 10,
    outline: "none",
  },

  err: {
    marginTop: 10,
    background: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: 12,
    padding: 10,
  },
};
