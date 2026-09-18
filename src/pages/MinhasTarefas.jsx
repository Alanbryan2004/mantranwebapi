import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, rpc, apiPatch, limparApontamentosAntigos } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function MinhasTarefas() {
  const { user } = useAuth();

  const [tarefas, setTarefas] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [cenariosQa, setCenariosQa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Modal de Análise e Correção de Erros de QA
  const [modalQa, setModalQa] = useState(null); // { tela, tarefa, cenariosErro }
  const [notaCorrecao, setNotaCorrecao] = useState("");
  const [salvandoCorrecao, setSalvandoCorrecao] = useState(false);

  const tecnicoId = user?.id;
  const tecnicoNome = user?.nome;

  async function carregar() {
    if (!tecnicoId) return;

    setLoading(true);
    setErro("");
    try {
      // Auto-pausa retroativa para garantir consistência de apontamentos anteriores
      await limparApontamentosAntigos();

      const [rows, allApontamentos, allQaCenarios] = await Promise.all([
        apiGet(
          `/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,nivel_api,peso_api,qtd_campos,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,observacoes,modulo,data_inicio,data_fim_real,endpoints` +
            `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}` +
            `&order=created_at.asc`
        ),
        apiGet(
          `/rest/v1/apontamento_tempo?select=controle_api_id,inicio,fim` +
            `&tecnico_id=eq.${encodeURIComponent(tecnicoId)}`
        ),
        apiGet(`/rest/v1/qa_cenarios?select=*`).catch(() => [])
      ]);
      
      setTarefas(rows || []);
      setApontamentos(allApontamentos || []);
      setCenariosQa(allQaCenarios || []);
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

  // Verifica se a tarefa possui apontamento de erro no QA
  const getErrosQaDaTarefa = (t) => {
    const nomeTela = t.tela || t.nome_tabela;
    return (cenariosQa || []).filter(
      (c) => (c.tela === nomeTela || c.tela === t.tela || c.tela === t.nome_tabela) && c.status === "ERRO"
    );
  };

  const isReprovadaQa = (t) => {
    return getErrosQaDaTarefa(t).length > 0;
  };

  const resumo = useMemo(() => {
    const total = tarefas.length;
    const concluidas = tarefas.filter((t) => isConcluida(t) && !isReprovadaQa(t)).length;
    const trabalhando = tarefas.filter((t) => apontAbertos.includes(t.id)).length;
    const pendentes = total - concluidas;
    return { total, pendentes, trabalhando, concluidas };
  }, [tarefas, apontAbertos, cenariosQa]);

  // 👉 MOSTRAR SOMENTE TAREFAS NÃO CONCLUÍDAS OU REPROVADAS NO QA
  const tarefasVisiveis = useMemo(() => {
    return tarefas.filter((t) => !isConcluida(t) || isReprovadaQa(t));
  }, [tarefas, cenariosQa]);

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

      // AUTO-COMPLETAR para tarefas de Arquitetura
      if (novaTarefa.tipo_tabela === "Arquitetura" && novaTarefa.status_api === "Finalizado") {
        if (novaTarefa.status_teste !== "Finalizado") {
          await rpc("atualizar_status", { p_controle_api_id: tarefa.id, p_campo: "status_teste", p_status: "Finalizado" });
          novaTarefa.status_teste = "Finalizado";
        }
        if (novaTarefa.status_documentacao !== "Finalizado") {
          await rpc("atualizar_status", { p_controle_api_id: tarefa.id, p_campo: "status_documentacao", p_status: "Finalizado" });
          novaTarefa.status_documentacao = "Finalizado";
        }
      }

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

  function abrirModalQa(tarefa, erros) {
    setModalQa({
      tarefa,
      tela: tarefa.tela || tarefa.nome_tabela,
      cenariosErro: erros
    });
    setNotaCorrecao("");
  }

  async function retornarParaValidacao() {
    if (!notaCorrecao.trim()) {
      alert("Por favor, informe a correção realizada antes de retornar para validação.");
      return;
    }

    setSalvandoCorrecao(true);
    try {
      for (const cenario of modalQa.cenariosErro) {
        await apiPatch(`/rest/v1/qa_cenarios?id=eq.${cenario.id}`, {
          status: "PENDENTE",
          observacao_correcao: notaCorrecao.trim(),
          updated_at: new Date().toISOString()
        });
      }

      setModalQa(null);
      await carregar();
    } catch (e) {
      alert("Erro ao retornar para validação: " + (e.message || String(e)));
    } finally {
      setSalvandoCorrecao(false);
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
                const errosQa = getErrosQaDaTarefa(t);
                const isReprovada = errosQa.length > 0;
                const podeFinalizar =
                  t.status_api === "Finalizado" &&
                  t.status_teste === "Finalizado" &&
                  t.status_documentacao === "Finalizado";

                return (
                  <div 
                    key={t.id} 
                    style={{
                      ...styles.taskCard,
                      borderColor: isReprovada ? "#fca5a5" : "#eee",
                      boxShadow: isReprovada ? "0 0 0 1px #ef4444, 0 4px 6px -1px rgba(239, 68, 68, 0.1)" : "none"
                    }}
                  >
                    {/* ALERTA / BANNER SE A TELA ESTIVER REPROVADA PELO QA */}
                    {isReprovada && (
                      <div style={styles.reprovadoBanner}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>🚨</span>
                          <div>
                            <div style={{ fontWeight: 800, color: "#991b1b", fontSize: 14 }}>
                              REPROVADO PELO QA ({errosQa.length} {errosQa.length === 1 ? "apontamento de erro" : "apontamentos de erro"})
                            </div>
                            <div style={{ fontSize: 12, color: "#b91c1c" }}>
                              Esta tela foi reprovada pela equipe de QA. Clique abaixo para verificar os erros e enviar para nova validação.
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => abrirModalQa(t, errosQa)}
                          style={styles.btnVerErroQa}
                        >
                          ⚠️ Reprovado - Ver Erro e Revalidar
                        </button>
                      </div>
                    )}

                    <div style={styles.taskTop}>
                      <div>
                        <div style={styles.taskTitle}>
                          {t.nome_tabela}
                          {isReprovada && (
                            <span style={styles.badgeReprovado}>Reprovado no QA</span>
                          )}
                        </div>
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

                      {!concl && (
                        <button
                          style={btnWarning(!aberto)}
                          disabled={busyId === t.id || aberto}
                          onClick={() => devolver(t)}
                          title="Devolver para Pendentes"
                        >
                          ↩ Devolver
                        </button>
                      )}

                      {isReprovada && (
                        <button
                          style={styles.btnReprovadoAction}
                          onClick={() => abrirModalQa(t, errosQa)}
                        >
                          🚨 Reprovado
                        </button>
                      )}
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

      {/* MODAL PARA O TÉCNICO VER ERRO DO QA E RETORNAR PARA VALIDAÇÃO */}
      {modalQa && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <h3 style={styles.modalTitle}>Apontamentos de Erro do QA</h3>
                  <span style={styles.modalSubHeader}>Tela: <strong>{modalQa.tela}</strong></span>
                </div>
              </div>
            </div>

            <div style={styles.modalBody}>
              <div style={{ fontSize: 13, color: "#374151" }}>
                Abaixo estão os cenários de teste reprovados pelo QA para esta tela:
              </div>

              <div style={styles.qaErrorsList}>
                {modalQa.cenariosErro.map((c, i) => (
                  <div key={c.id} style={styles.qaErrorCard}>
                    <div style={styles.qaErrorHeader}>
                      <span style={styles.qaErrorBadge}>Cenário #{i + 1}</span>
                      <strong style={{ fontSize: 13, color: "#111827" }}>{c.titulo}</strong>
                    </div>

                    {c.descricao && (
                      <div style={styles.qaErrorDesc}>
                        <strong>Regra de Negócio:</strong> {c.descricao}
                      </div>
                    )}

                    <div style={styles.qaErrorObs}>
                      <strong style={{ color: "#991b1b" }}>Erro apontado pelo QA ({c.qa_nome || "QA"}):</strong>
                      <div style={{ marginTop: 4, color: "#7f1d1d", whiteSpace: "pre-wrap" }}>
                        {c.observacao_erro || "Nenhum detalhe adicional informado."}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.correcaoField}>
                <label style={styles.correcaoLabel}>
                  Descreva a correção efetuada: <span style={{ color: "red" }}>*</span>
                </label>
                <textarea
                  style={styles.correcaoTextarea}
                  placeholder="Ex: Corrigido tratamento de validação de duplicidade e ajustado status retornado para 400."
                  value={notaCorrecao}
                  onChange={(e) => setNotaCorrecao(e.target.value)}
                  rows={4}
                  autoFocus
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                style={styles.btnModalCancel}
                onClick={() => setModalQa(null)}
                disabled={salvandoCorrecao}
              >
                Fechar
              </button>
              <button
                style={styles.btnModalReturnQa}
                onClick={retornarParaValidacao}
                disabled={salvandoCorrecao}
              >
                {salvandoCorrecao ? "Enviando..." : "🔁 Retornar para Nova Validação"}
              </button>
            </div>
          </div>
        </div>
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

  /* ESTILOS QA */
  reprovadoBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 14px",
    marginBottom: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  },
  btnVerErroQa: {
    background: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  btnReprovadoAction: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
    borderRadius: 10,
    padding: "8px 12px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12
  },
  badgeReprovado: {
    marginLeft: 8,
    background: "#fee2e2",
    color: "#dc2626",
    border: "1px solid #fca5a5",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 800
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 16
  },
  modalCard: {
    background: "#fff",
    borderRadius: 14,
    width: "100%",
    maxWidth: 580,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #fee2e2",
    background: "#fff"
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#991b1b",
    margin: 0
  },
  modalSubHeader: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    display: "block"
  },
  modalBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    maxHeight: "65vh",
    overflowY: "auto"
  },
  qaErrorsList: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  qaErrorCard: {
    background: "#fef2f2",
    border: "1px solid #fee2e2",
    borderRadius: 8,
    padding: "10px 12px"
  },
  qaErrorHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  qaErrorBadge: {
    fontSize: 10,
    fontWeight: 800,
    background: "#fee2e2",
    color: "#b91c1c",
    border: "1px solid #fca5a5",
    padding: "2px 6px",
    borderRadius: 4
  },
  qaErrorDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4
  },
  qaErrorObs: {
    fontSize: 12,
    marginTop: 6,
    paddingTop: 6,
    borderTop: "1px dashed #fecaca"
  },
  correcaoField: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginTop: 6
  },
  correcaoLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1e293b"
  },
  correcaoTextarea: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none",
    resize: "vertical"
  },
  modalFooter: {
    padding: "14px 20px",
    borderTop: "1px solid #f1f5f9",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10
  },
  btnModalCancel: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#475569",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  },
  btnModalReturnQa: {
    background: "#16a34a",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer"
  }
};
