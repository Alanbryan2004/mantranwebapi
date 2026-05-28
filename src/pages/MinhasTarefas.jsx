import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, rpc, apiPatch, limparApontamentosAntigos } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function MinhasTarefas() {
  const { user } = useAuth();

  const [tarefas, setTarefas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());

  const tecnicoId = user?.id;
  const tecnicoNome = user?.nome;

  async function carregar() {
    if (!tecnicoId) return;

    setLoading(true);
    setErro("");
    try {
      // Auto-pausa retroativa para garantir consistência de apontamentos anteriores
      await limparApontamentosAntigos();

      const rows = await apiGet(
        `/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,nivel_api,peso_api,qtd_campos,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,observacoes,modulo,data_inicio,data_fim_real,endpoints` +
          `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}` +
          `&order=created_at.asc`
      );

      const allApontamentos = await apiGet(
        `/rest/v1/apontamento_tempo?select=controle_api_id,inicio,fim` +
          `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}`
      );
      
      setTarefas(rows || []);
      setApontamentos(allApontamentos || []);
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [tecnicoId]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);

      // Verificação em tempo real pós-18:00
      const current = new Date(nowTs);
      if (current.getHours() >= 18) {
        const activeIds = (apontamentos || []).filter(a => !a.fim).map(a => a.controle_api_id);
        if (activeIds.length > 0) {
          const tarefasAtivas = tarefas.filter(t => activeIds.includes(t.id) && busyId !== t.id);
          for (const t of tarefasAtivas) {
            console.log(`[Auto-Pausa] Horário limite atingido (18:00). Pausando tarefa: ${t.nome_tabela}`);
            pausar(t);
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [apontamentos, tarefas, busyId]);

  const apontAbertos = useMemo(() => {
    return (apontamentos || []).filter(a => !a.fim).map(a => a.controle_api_id);
  }, [apontamentos]);

  const resumo = useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => isConcluida(t)).length;
    const trabalhando = tarefas.filter((t) => apontAbertos.includes(t.id)).length;
    const pendentes = total - concluidas;
    return { total, pendentes, trabalhando, concluidas };
  }, [tarefas, apontAbertos]);

  // 👉 MOSTRAR SOMENTE TAREFAS NÃO CONCLUÍDAS
  const tarefasVisiveis = useMemo(() => {
    return tarefas.filter((t) => !isConcluida(t));
  }, [tarefas]);

  async function iniciar(tarefa) {
    setBusyId(tarefa.id);
    try {
      await rpc("iniciar_trabalho", {
        p_controle_api_id: tarefa.id,
        p_tecnico_id: tecnicoId,
        p_tecnico_nome: tecnicoNome,
      });

      // Garantir que a fase correta fique como "Trabalhando" e as finalizadas não sejam sobrescritas
      let newApi = tarefa.status_api || "Pendente";
      let newTeste = tarefa.status_teste || "Pendente";
      let newDoc = tarefa.status_documentacao || "Pendente";

      if (newApi !== "Finalizado") {
        newApi = "Trabalhando";
      } else if (newTeste !== "Finalizado") {
        newTeste = "Trabalhando";
      } else if (newDoc !== "Finalizado") {
        newDoc = "Trabalhando";
      }

      await apiPatch(`/rest/v1/controle_api?id=eq.${tarefa.id}`, {
        status_api: newApi,
        status_teste: newTeste,
        status_documentacao: newDoc,
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

  async function devolver(tarefa) {
    if (!window.confirm(`Tem certeza que deseja devolver a tarefa "${tarefa.nome_tabela}" para a lista de Pendentes?`)) {
      return;
    }
    setBusyId(tarefa.id);
    try {
      await apiPatch(`/rest/v1/controle_api?id=eq.${tarefa.id}`, {
        tecnico_id: null,
        tecnico_nome: null,
        status_api: "Pendente",
        status_teste: "Pendente",
        status_documentacao: "Pendente",
        data_inicio: null,
        tela: ""
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
    try {
      await rpc("atualizar_status", {
        p_controle_api_id: tarefa.id,
        p_campo: campo,
        p_status: status,
      });

      // Auto-finaliza o timer se a tarefa ficou totalmente concluída
      const novaTarefa = { ...tarefa, [campo]: status };
      if (isConcluida(novaTarefa)) {
        await rpc("finalizar_trabalho", {
          p_controle_api_id: tarefa.id,
          p_tecnico_id: tecnicoId,
        });
      }

      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  async function salvarObs(tarefa, texto) {
    setBusyId(tarefa.id);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      await fetch(`${baseUrl}/rest/v1/controle_api?id=eq.${tarefa.id}`, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ observacoes: texto }),
      });

      await carregar();
    } catch (e) {
      setErro(String(e.message || e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Minhas Tarefas">
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && (
        <>
          <div style={styles.grid}>
            <Card title="Total" value={resumo.total} />
            <Card title="Pendentes" value={resumo.pendentes} />
            <Card title="Trabalhando" value={resumo.trabalhando} />
            <Card title="Concluídas" value={resumo.concluidas} />
          </div>

          <div style={{ height: 16 }} />

          <div style={styles.list}>
            {tarefasVisiveis.length === 0 ? (
              <div style={{ padding: 14, color: "#6b7280" }}>
                Nenhuma tarefa pendente 🎉
              </div>
            ) : (
              tarefasVisiveis.map((t) => {
                const aberto = apontAbertos.includes(t.id);
                const concl = isConcluida(t);
                const podeFinalizar =
                  t.status_api === "Finalizado" &&
                  t.status_teste === "Finalizado" &&
                  t.status_documentacao === "Finalizado";

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
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={styles.timeSpent}>
                          ⏱️ {formatarHHMM(
                            ((apontamentos || [])
                              .filter(a => a.controle_api_id === t.id)
                              .reduce((acc, a) => {
                                const start = new Date(a.inicio).getTime();
                                const end = a.fim ? new Date(a.fim).getTime() : now;
                                return acc + (end - start);
                              }, 0) / 1000) / 3600
                          )}
                        </div>
                        <div style={styles.statePill}>
                          {aberto ? "Em andamento" : "Pausada"}
                        </div>
                      </div>
                    </div>

                    <div style={styles.actions}>
                      <button
                        style={btn(!aberto)}
                        disabled={busyId === t.id || aberto}
                        onClick={() => iniciar(t)}
                      >
                        ▶ Iniciar
                      </button>

                      <button
                        style={btn(aberto)}
                        disabled={busyId === t.id || !aberto}
                        onClick={() => pausar(t)}
                      >
                        ⏸ Pausar
                      </button>

                      <button
                        style={btnDanger(podeFinalizar && !aberto)}
                        disabled={busyId === t.id || aberto || !podeFinalizar}
                        onClick={() => finalizar(t)}
                      >
                        ⏹ Finalizar
                      </button>

                      <button
                        style={btnWarning(!aberto)}
                        disabled={busyId === t.id || aberto}
                        onClick={() => devolver(t)}
                        title="Devolver para Pendentes"
                      >
                        ↩ Devolver
                      </button>
                    </div>

                    <div style={styles.statusRow}>
                      <StatusSelect
                        label="API"
                        value={t.status_api}
                        onChange={(v) => mudarStatus(t, "status_api", v)}
                      />
                      <StatusSelect
                        label="Teste"
                        value={t.status_teste}
                        onChange={(v) => mudarStatus(t, "status_teste", v)}
                      />
                      <StatusSelect
                        label="Doc"
                        value={t.status_documentacao}
                        onChange={(v) =>
                          mudarStatus(t, "status_documentacao", v)
                        }
                      />
                    </div>

                    <div style={styles.obsWrap}>
                      <textarea
                        style={styles.textarea}
                        defaultValue={t.observacoes || ""}
                        placeholder="Observações…"
                        onBlur={(e) =>
                          salvarObs(t, e.target.value || null)
                        }
                      />
                    </div>

                    <EndpointsEditor tarefa={t} setErro={setErro} />
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

async function salvarEndpoints(tarefaId, novosEndpoints, setErro) {
  try {
    await apiPatch(`/rest/v1/controle_api?id=eq.${tarefaId}`, {
      endpoints: novosEndpoints
    });
  } catch (e) {
    setErro(String(e.message || e));
  }
}

function EndpointsEditor({ tarefa, setErro }) {
  const [endpoints, setEndpoints] = useState(tarefa.endpoints || []);

  function adicionar() {
    setEndpoints([...endpoints, ""]);
  }

  function atualizar(index, valor) {
    const novos = [...endpoints];
    novos[index] = valor;
    setEndpoints(novos);
  }

  function remover(index) {
    const novos = endpoints.filter((_, i) => i !== index);
    setEndpoints(novos);
    salvarEndpoints(tarefa.id, novos, setErro);
  }

  function salvarNoBlur() {
    salvarEndpoints(tarefa.id, endpoints, setErro);
  }

  return (
    <div style={styles.endpointsWrap}>
      <div style={styles.endpointsTitle}>Endpoints</div>
      {endpoints.map((ep, i) => (
        <div key={i} style={styles.endpointRow}>
          <input
            style={styles.endpointInput}
            value={ep}
            placeholder="Ex: /rest/v1/rota..."
            onChange={(e) => atualizar(i, e.target.value)}
            onBlur={salvarNoBlur}
          />
          <button style={styles.btnRemoveEp} onClick={() => remover(i)} title="Remover endpoint">
            ✖
          </button>
        </div>
      ))}
      <button style={styles.btnAddEp} onClick={adicionar}>
        + Adicionar Endpoint
      </button>
    </div>
  );
}

function isConcluida(t) {
  if (!t) return false;
  if (t.tipo_tabela === "Arquitetura") {
    return t.status_api === "Finalizado";
  }
  return (
    t.status_api === "Finalizado" &&
    t.status_teste === "Finalizado" &&
    t.status_documentacao === "Finalizado"
  );
}

function StatusSelect({ label, value, onChange }) {
  return (
    <div style={styles.statusBox}>
      <div style={styles.statusLabel}>{label}</div>
      <select
        style={styles.select}
        value={value || "Pendente"}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="Pendente">Pendente</option>
        <option value="Trabalhando">Trabalhando</option>
        <option value="Finalizado">Finalizado</option>
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
  return { ...styles.btn, opacity: active ? 1 : 0.6 };
}

function btnDanger(active) {
  return {
    ...styles.btn,
    borderColor: active ? "#ef4444" : "#e5e7eb",
    color: active ? "#ef4444" : "#111827",
    opacity: active ? 1 : 0.6,
  };
}

function btnWarning(active) {
  return {
    ...styles.btn,
    borderColor: active ? "#f59e0b" : "#e5e7eb",
    color: active ? "#d97706" : "#111827",
    opacity: active ? 1 : 0.6,
  };
}

function formatarHHMM(horasDecimais) {
  const h = Math.floor(horasDecimais);
  const m = Math.floor((horasDecimais - h) * 60);
  return `${h}h ${m}m`;
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900 },

  list: { display: "flex", flexDirection: "column", gap: 12 },

  taskCard: {
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
    background: "#fff",
  },

  taskTop: { display: "flex", justifyContent: "space-between" },
  taskTitle: { fontSize: 16, fontWeight: 900 },
  taskSub: { fontSize: 13, color: "#374151" },

  statePill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
  },

  timeSpent: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "monospace",
    color: "#374151",
    background: "#f3f4f6",
    padding: "6px 10px",
    borderRadius: 8,
  },

  actions: { display: "flex", gap: 8, marginTop: 12 },
  btn: {
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "8px 10px",
    cursor: "pointer",
    background: "#fff",
  },

  statusRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 },
  statusBox: { background: "#fafafa", padding: 10, borderRadius: 12 },
  statusLabel: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  select: { width: "100%", padding: 8 },

  obsWrap: { marginTop: 12 },
  textarea: { width: "100%", minHeight: 70, padding: 10 },

  endpointsWrap: { marginTop: 16, background: "#f9fafb", padding: 12, borderRadius: 12, border: "1px dashed #d1d5db" },
  endpointsTitle: { fontSize: 13, fontWeight: 800, marginBottom: 10, color: "#374151" },
  endpointRow: { display: "flex", gap: 8, marginBottom: 8 },
  endpointInput: { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 },
  btnRemoveEp: { background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontWeight: "bold" },
  btnAddEp: { background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600, color: "#374151", marginTop: 4 },

  err: {
    marginTop: 10,
    background: "#FEF2F2",
    color: "#991B1B",
    padding: 10,
    borderRadius: 12,
  },
};
