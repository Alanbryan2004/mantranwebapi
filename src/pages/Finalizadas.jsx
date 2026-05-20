import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet } from "../services/api";

export default function Finalizadas() {
  const [telas, setTelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [usuarios, setUsuarios] = useState([]);
  const [buscaTela, setBuscaTela] = useState("");
  const [buscaTecnico, setBuscaTecnico] = useState("");

  useEffect(() => {
    let ativo = true;

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

        if (!ativo) return;

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

          mapa[t.tela].tabelas.push(t.nome_tabela);
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
        if (ativo) setErro(e.message || String(e));
      } finally {
        if (ativo) setLoading(false);
      }
    }

    carregar();
    return () => (ativo = false);
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
                  {t.tabelas.map((tb, i) => (
                    <li key={i}>{tb}</li>
                  ))}
                </ul>

                {t.endpoints && t.endpoints.length > 0 && (
                  <div style={styles.endpointsContainer}>
                    <div style={styles.endpointsTitle}>🔗 Endpoints:</div>
                    <div style={styles.endpointsList}>
                      {t.endpoints.map((ep, i) => (
                        <span key={i} style={styles.endpointTag}>
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
    paddingLeft: 18,
    fontSize: 13,
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
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px dashed #e5e7eb",
  },
  endpointsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#4b5563",
    marginBottom: 6,
  },
  endpointsList: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  endpointTag: {
    background: "#f3f4f6",
    color: "#374151",
    padding: "4px 8px",
    borderRadius: 6,
    fontSize: 12,
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
};
