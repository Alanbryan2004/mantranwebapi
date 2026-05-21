import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, apiPatch } from "../services/api";

export default function Finalizadas() {
  const [telas, setTelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [usuarios, setUsuarios] = useState([]);
  const [buscaTela, setBuscaTela] = useState("");
  const [buscaTecnico, setBuscaTecnico] = useState("");

  // Estados para edição de endpoints
  const [editingTable, setEditingTable] = useState(null);
  const [tempEndpoints, setTempEndpoints] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  async function carregar() {
    try {
      setErro("");
      setLoading(true);

      const [tarefas, horas, listaUsuarios] = await Promise.all([
        apiGet(
          `/rest/v1/controle_api` +
            `?select=id,tela,nome_tabela,tecnico_nome,endpoints` +
            `&status_api=eq.Finalizado` +
            `&status_teste=eq.Finalizado` +
            `&status_documentacao=eq.Finalizado`
        ),
        apiGet(
          `/rest/v1/apontamento_tempo` +
            `?select=controle_api_id,inicio,fim` +
            `&fim=not.is.null`
        ),
        apiGet(`/rest/v1/usuario?select=id,nome&order=nome.asc`).catch(() => [])
      ]);

      setUsuarios(listaUsuarios || []);

      const mapa = {};

      for (const t of tarefas || []) {
        if (!mapa[t.tela]) {
          mapa[t.tela] = {
            tela: t.tela,
            tabelas: [],
            horas: 0,
            tecnicos: new Set(),
            endpoints: new Set(),
          };
        }

        mapa[t.tela].tabelas.push({
          id: t.id,
          nome_tabela: t.nome_tabela,
          endpoints: t.endpoints || []
        });

        if (t.tecnico_nome) {
          mapa[t.tela].tecnicos.add(t.tecnico_nome);
        }

        if (t.endpoints && Array.isArray(t.endpoints)) {
          for (const ep of t.endpoints) {
            if (ep && ep.trim()) {
              mapa[t.tela].endpoints.add(ep.trim());
            }
          }
        }

        const horasTabela = (horas || []).filter(
          (h) => h.controle_api_id === t.id
        );

        for (const h of horasTabela) {
          const inicio = new Date(h.inicio);
          const fim = new Date(h.fim);
          mapa[t.tela].horas += (fim - inicio) / 36e5;
        }
      }

      const lista = Object.values(mapa).map(item => ({
        ...item,
        tecnico: Array.from(item.tecnicos).join(", ") || "Sem Técnico",
        endpoints: Array.from(item.endpoints),
      }));
      setTelas(lista);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const telasFiltradas = useMemo(() => {
    return telas.filter((t) => {
      const matchTela = t.tela.toLowerCase().includes(buscaTela.toLowerCase());
      const matchTecnico = buscaTecnico
        ? t.tecnico.toLowerCase().includes(buscaTecnico.toLowerCase())
        : true;
      return matchTela && matchTecnico;
    });
  }, [telas, buscaTela, buscaTecnico]);

  const mediaHorasFiltradas = useMemo(() => {
    const total = telasFiltradas.reduce((s, t) => s + t.horas, 0);
    return telasFiltradas.length ? total / telasFiltradas.length : 0;
  }, [telasFiltradas]);

  // Funções para controle do Modal de Edição de Endpoints
  function abrirModalEdicao(tb) {
    setEditingTable(tb);
    setTempEndpoints(tb.endpoints ? [...tb.endpoints] : []);
  }

  function fecharModalEdicao() {
    setEditingTable(null);
    setTempEndpoints([]);
  }

  function adicionarNovoEndpoint() {
    setTempEndpoints([...tempEndpoints, ""]);
  }

  function atualizarEndpointTemporario(index, valor) {
    const novos = [...tempEndpoints];
    novos[index] = valor;
    setTempEndpoints(novos);
  }

  function removerEndpointTemporario(index) {
    const novos = tempEndpoints.filter((_, i) => i !== index);
    setTempEndpoints(novos);
  }

  async function salvarAlteracoesEndpoints() {
    if (!editingTable) return;
    setIsSaving(true);
    try {
      const filtrados = tempEndpoints.map(ep => ep.trim()).filter(Boolean);
      await apiPatch(`/rest/v1/controle_api?id=eq.${editingTable.id}`, {
        endpoints: filtrados
      });
      fecharModalEdicao();
      await carregar();
    } catch (e) {
      setErro("Erro ao salvar endpoints: " + (e.message || String(e)));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell title="Finalizadas">
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <>
          {/* 🔍 FILTROS */}
          <div style={styles.filterBar}>
            <input
              placeholder="🔍 Filtrar por Nome da Tela..."
              value={buscaTela}
              onChange={(e) => setBuscaTela(e.target.value)}
              style={styles.filterInput}
            />

            <select
              value={buscaTecnico}
              onChange={(e) => setBuscaTecnico(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="">👤 Todos os Técnicos</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.nome}
                </option>
              ))}
            </select>

            {(buscaTela || buscaTecnico) && (
              <button
                onClick={() => {
                  setBuscaTela("");
                  setBuscaTecnico("");
                }}
                style={styles.clearBtn}
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* 🔢 CARDS TOPO */}
          <div style={styles.grid}>
            <Card
              title="Total de Telas Finalizadas"
              value={telasFiltradas.length}
            />
            <Card
              title="Média de Horas por Tela"
              value={formatarHHMM(mediaHorasFiltradas)}
            />
          </div>

          {/* 🔴 FIELDSETS POR TELA */}
          <div style={styles.wrapper}>
            {telasFiltradas.map((t) => (
              <fieldset key={t.tela} style={styles.fieldset}>
                <legend style={styles.legend}>{t.tela}</legend>

                <div style={styles.innerCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span>⏱️ Horas totais: <strong>{formatarHHMM(t.horas)}</strong></span>
                    <span>👤 Finalizado por: <strong>{t.tecnico}</strong></span>
                  </div>
                </div>

                <ul style={styles.ul}>
                  {t.tabelas.map((tb) => (
                    <li key={tb.id} style={styles.tableLi}>
                      <div style={styles.tableNameRow}>
                        <span style={styles.tableName}>🔹 {tb.nome_tabela}</span>
                        <button
                          style={styles.editBtn}
                          onClick={() => abrirModalEdicao(tb)}
                          title="Editar ou Adicionar Endpoints para esta tabela"
                        >
                          ✏️ Editar Endpoints
                        </button>
                      </div>

                      {tb.endpoints && tb.endpoints.length > 0 ? (
                        <div style={styles.tableEndpointsList}>
                          {tb.endpoints.map((ep, idx) => (
                            <span key={idx} style={styles.endpointTag}>
                              {ep}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={styles.noEndpoints}>Nenhum endpoint cadastrado</div>
                      )}
                    </li>
                  ))}
                </ul>

                {t.endpoints && t.endpoints.length > 0 && (
                  <div style={styles.endpointsContainer}>
                    <div style={styles.endpointsTitle}>🔗 Resumo Geral de Endpoints da Tela:</div>
                    <div style={styles.endpointsList}>
                      {t.endpoints.map((ep, i) => (
                        <span key={i} style={styles.endpointTagGlobal}>
                          {ep}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </fieldset>
            ))}

            {telasFiltradas.length === 0 && (
              <div style={styles.empty}>
                Nenhuma tela finalizada encontrada com estes filtros
              </div>
            )}
          </div>
        </>
      )}

      {/* 🔮 MODAL DE EDIÇÃO DE ENDPOINTS */}
      {editingTable && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                Editar Endpoints: <span style={styles.modalTableHighlight}>{editingTable.nome_tabela}</span>
              </h3>
              <button style={styles.modalCloseBtn} onClick={fecharModalEdicao}>✖</button>
            </div>
            
            <div style={styles.modalBody}>
              <div style={styles.modalSubtitle}>
                Adicione, altere ou remova as rotas de API desenvolvidas para esta tabela. As modificações serão salvas diretamente no banco de dados.
              </div>
              
              <div style={styles.modalEndpointsList}>
                {tempEndpoints.map((ep, i) => (
                  <div key={i} style={styles.modalEndpointRow}>
                    <input
                      style={styles.modalEndpointInput}
                      value={ep}
                      placeholder="Ex: /rest/v1/nome_tabela..."
                      onChange={(e) => atualizarEndpointTemporario(i, e.target.value)}
                    />
                    <button
                      style={styles.modalBtnRemove}
                      onClick={() => removerEndpointTemporario(i)}
                      title="Remover"
                    >
                      ✖
                    </button>
                  </div>
                ))}
                
                {tempEndpoints.length === 0 && (
                  <div style={styles.modalEmpty}>Nenhum endpoint adicionado para esta tabela.</div>
                )}
              </div>

              <button style={styles.modalBtnAdd} onClick={adicionarNovoEndpoint}>
                ➕ Adicionar Endpoint
              </button>
            </div>

            <div style={styles.modalFooter}>
              <button 
                style={styles.modalBtnCancel} 
                onClick={fecharModalEdicao}
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                style={styles.modalBtnSave} 
                onClick={salvarAlteracoesEndpoints}
                disabled={isSaving}
              >
                {isSaving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function formatarHHMM(horasDecimais) {
  const h = Math.floor(horasDecimais);
  const m = Math.round((horasDecimais - h) * 60);
  return `${h}h ${m}m`;
}

function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    marginBottom: 24,
  },

  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900 },

  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  fieldset: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "14px 16px 16px",
    background: "#fff",
  },

  legend: {
    padding: "0 8px",
    fontWeight: 800,
    color: "#b91c1c", // vermelho-700
    fontSize: 14,
  },

  innerCard: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },

  ul: {
    paddingLeft: 0,
    listStyleType: "none",
    fontSize: 13,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  tableLi: {
    background: "#f9fafb",
    border: "1px solid #f3f4f6",
    borderRadius: 10,
    padding: "12px 14px",
  },

  tableNameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },

  tableName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1f2937",
  },

  editBtn: {
    background: "#eff6ff",
    color: "#2563eb",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  tableEndpointsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },

  noEndpoints: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 4,
  },

  empty: {
    padding: 20,
    textAlign: "center",
    color: "#6b7280",
  },

  err: {
    background: "#fee2e2",
    color: "#991b1b",
    border: "1px solid #fecaca",
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },

  endpointsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: "1px dashed #e5e7eb",
  },

  endpointsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#6b7280",
    marginBottom: 8,
  },

  endpointsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },

  endpointTag: {
    background: "#e0f2fe",
    color: "#0369a1",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
    fontFamily: "monospace",
    border: "1px solid #bae6fd",
  },

  endpointTagGlobal: {
    background: "#f3f4f6",
    color: "#4b5563",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontFamily: "monospace",
    border: "1px solid #e5e7eb",
  },

  filterBar: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    background: "#fff",
    padding: 16,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    alignItems: "center",
    flexWrap: "wrap",
  },

  filterInput: {
    flex: 1,
    minWidth: 200,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  },

  filterSelect: {
    minWidth: 200,
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    fontSize: 14,
    background: "#fff",
    outline: "none",
    cursor: "pointer",
  },

  clearBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #d1d5db",
    background: "#f3f4f6",
    color: "#4b5563",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },

  /* 🔮 MODAL STYLES */
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.4)", // Slate escuro transparente
    backdropFilter: "blur(8px)", // Efeito desfoque
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },

  modalContent: {
    background: "#ffffff",
    width: "100%",
    maxWidth: 550,
    borderRadius: 16,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    display: "flex",
    flexDirection: "column",
    maxHeight: "85vh",
    overflow: "hidden",
    animation: "modalFadeIn 0.3s ease-out",
  },

  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },

  modalTableHighlight: {
    color: "#2563eb",
  },

  modalCloseBtn: {
    background: "none",
    border: "none",
    fontSize: 16,
    color: "#64748b",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    width: 28,
    height: 28,
    transition: "all 0.2s",
    ":hover": {
      background: "#f1f5f9",
      color: "#0f172a",
    }
  },

  modalBody: {
    padding: "20px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 1.5,
  },

  modalEndpointsList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxHeight: 250,
    overflowY: "auto",
    paddingRight: 4,
  },

  modalEndpointRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  modalEndpointInput: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.2s",
    fontFamily: "monospace",
    ":focus": {
      borderColor: "#2563eb",
    }
  },

  modalBtnRemove: {
    background: "#fef2f2",
    color: "#ef4444",
    border: "1px solid #fee2e2",
    borderRadius: 8,
    padding: "10px 12px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: "bold",
    transition: "all 0.2s",
    ":hover": {
      background: "#fee2e2",
    }
  },

  modalEmpty: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    padding: "20px 0",
    fontStyle: "italic",
  },

  modalBtnAdd: {
    alignSelf: "flex-start",
    background: "#ffffff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s",
    ":hover": {
      background: "#f8fafc",
      borderColor: "#94a3b8",
    }
  },

  modalFooter: {
    padding: "16px 20px",
    borderTop: "1px solid #f1f5f9",
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    background: "#f8fafc",
  },

  modalBtnCancel: {
    background: "#ffffff",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },

  modalBtnSave: {
    background: "#2563eb",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
