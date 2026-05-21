import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, limparApontamentosAntigos } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const CORES = [
  "#ef4444", // Vermelho
  "#3b82f6", // Azul
  "#10b981", // Verde
  "#f59e0b", // Âmbar
  "#8b5cf6", // Roxo
  "#ec4899", // Rosa
  "#06b6d4", // Ciano
  "#6366f1", // Indigo
];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function obterSemanasGrafico() {
  const semanas = [];
  
  // Data inicial fixa: Segunda-feira, 04/05/2026 (Maio é o mês 4 em JS)
  const dataInicial = new Date(2026, 4, 4);
  dataInicial.setHours(0, 0, 0, 0);
  
  const hoje = new Date();
  const segundaAtual = getMonday(hoje);
  segundaAtual.setHours(0, 0, 0, 0);
  
  let temp = new Date(dataInicial);
  
  while (temp <= segundaAtual) {
    const d = new Date(temp);
    const fim = new Date(d);
    fim.setDate(d.getDate() + 6);
    fim.setHours(23, 59, 59, 999);
    
    const format = (date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}`;
    };
    
    semanas.push({
      inicio: d,
      fim: fim,
      label: `${format(d)} - ${format(fim)}`,
      key: d.getTime(),
    });
    
    // Avança 7 dias para a próxima semana
    temp.setDate(temp.getDate() + 7);
  }
  
  return semanas;
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "Administrador";

  const [rows, setRows] = useState([]);
  const [produtividadeHoras, setProdutividadeHoras] = useState([]);
  const [produtividadeTelas, setProdutividadeTelas] = useState([]);
  const [idsEmAndamento, setIdsEmAndamento] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);
  const [historicoTelas, setHistoricoTelas] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
  const HORAS_POR_TELA = 8;
  const HORAS_POR_DIA = 8;

  const [expandedTech, setExpandedTech] = useState({});

  const toggleExpand = (nome) => {
    setExpandedTech((prev) => ({ ...prev, [nome]: !prev[nome] }));
  };

  /* =========================
     BUSCA DADOS
  ========================= */
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        setLoading(true);
        setErro("");

        // Auto-pausa retroativa para manter dados do Dashboard consistentes
        await limparApontamentosAntigos();

        let filtro = "";
        if (!isAdmin) {
          filtro = `&tecnico_id=eq.${user.id}`;
        }

        // 🔹 Tarefas
        const data = await apiGet(
          `/rest/v1/controle_api` +
            `?select=id,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,modulo,tela,nome_tabela` +
            filtro
        );
        const todosAponts = await apiGet(
          `/rest/v1/apontamento_tempo?select=tecnico_id,controle_api_id,inicio,fim` + filtro
        );

        const idsAbertos = (todosAponts || [])
          .filter(a => !a.fim)
          .map(a => a.controle_api_id);

        let prodHoras = [];
        let prodTelas = [];

        if (isAdmin) {
          // 🔹 Produtividade antiga (horas) – usada para previsão
          prodHoras = await apiGet(
            `/rest/v1/vw_horas_tecnico_semana` +
              `?select=tecnico_id,tecnico_nome,meta_semanal,horas_trabalhadas`
          );

          // 🔹 Produtividade NOVA (telas)
          let pt = await apiGet(
            `/rest/v1/vw_produtividade_telas_semana?select=tecnico_id,tecnico_nome,telas_finalizadas`
          );

          // 🔹 Metas Individuais (se não existir, catch e usa 1)
          let metasFetch = [];
          try {
            metasFetch = await apiGet(`/rest/v1/meta_tecnico?select=tecnico_id,meta_semanal`);
          } catch (e) {
            console.log("Aviso: tabela meta_tecnico não encontrada ou erro ao buscar. Usando meta padrão de 1.", e);
          }

          if (pt && Array.isArray(pt)) {
            prodTelas = pt.map(p => {
              const m = metasFetch && metasFetch.find(x => x.tecnico_id === p.tecnico_id);
              return { ...p, meta_semanal: m ? m.meta_semanal : 1 };
            });
          }
        }

        // 🔹 Histórico de Conclusões para o Gráfico
        const completedTasks = await apiGet(
          `/rest/v1/controle_api?select=tecnico_id,tecnico_nome,data_fim_real` +
            `&status_api=eq.Finalizado&status_teste=eq.Finalizado&status_documentacao=eq.Finalizado` +
            `&data_fim_real=not.is.null` +
            filtro
        );

        if (!ativo) return;

        setRows(data || []);
        setProdutividadeHoras(prodHoras || []);
        setProdutividadeTelas(prodTelas || []);
        setIdsEmAndamento(idsAbertos);
        setApontamentos(todosAponts || []);
        setHistoricoTelas(completedTasks || []);

      } catch (e) {
        if (ativo) setErro(String(e.message || e));
      } finally {
        if (ativo) setLoading(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [isAdmin, user?.id]);

  /* =========================
     RESUMO GERAL
  ========================= */
  const resumo = useMemo(() => {
    const total = rows.length;

    const pendentes = rows.filter((r) => r.status_api === "Pendente").length;
    const trabalhando = rows.filter(
  (r) => idsEmAndamento.includes(r.id)
).length;


    const concluidas = rows.filter(
      (r) =>
        r.status_api === "Finalizado" &&
        r.status_teste === "Finalizado" &&
        r.status_documentacao === "Finalizado"
    ).length;

    const porTecnico = {};
    
    // Cálculo de horas totais por técnico
    const horasPorTecnico = {};
    for (const a of apontamentos) {
      const tid = a.tecnico_id;
      if (!tid) continue;
      const start = new Date(a.inicio).getTime();
      const end = a.fim ? new Date(a.fim).getTime() : Date.now();
      horasPorTecnico[tid] = (horasPorTecnico[tid] || 0) + (end - start) / 36e5;
    }

    if (isAdmin) {
      for (const r of rows) {
        const key = r.tecnico_nome || "Sem Técnico";
        porTecnico[key] ||= {
          total: 0,
          pendentes: 0,
          trabalhando: 0,
          concluidas: 0,
          horasTotais: 0,
        };

        porTecnico[key].total++;
        porTecnico[key].horasTotais = horasPorTecnico[r.tecnico_id] || 0;

        if (r.status_api === "Pendente") porTecnico[key].pendentes++;
        if (idsEmAndamento.includes(r.id)) {
          porTecnico[key].trabalhando++;
        }

        if (
          r.status_api === "Finalizado" &&
          r.status_teste === "Finalizado" &&
          r.status_documentacao === "Finalizado"
        ) {
          porTecnico[key].concluidas++;
        }
      }
    }

    return { total, pendentes, trabalhando, concluidas, porTecnico };
  }, [rows, idsEmAndamento, isAdmin, apontamentos]);

  /* =========================
     PRODUTIVIDADE (TELAS)
  ========================= */
  const produtividadeTelasFormatada = useMemo(() => {
    return produtividadeTelas.map((t) => {
      const finalizadas = t.telas_finalizadas || 0;
      const metaTech = t.meta_semanal || 1;
      const faltam = Math.max(metaTech - finalizadas, 0);
      const percentual = (finalizadas / metaTech) * 100;
      const horasSemanais = produtividadeHoras.find(ph => ph.tecnico_id === t.tecnico_id)?.horas_trabalhadas || 0;

      let status = "verde";
      if (percentual < 60) status = "vermelho";
      else if (percentual < 100) status = "amarelo";

      return {
        ...t,
        finalizadas,
        faltam,
        percentual,
        status,
        horasSemanais,
      };
    });
  }, [produtividadeTelas, produtividadeHoras]);

  /* =========================
     PREVISÃO DE CONCLUSÃO (MANTIDA)
  ========================= */
  const previsao = useMemo(() => {
    if (!isAdmin) return null;

    const telasRestantes = resumo.pendentes + resumo.trabalhando;
    if (telasRestantes === 0) return null;

    const horasRestantes = telasRestantes * HORAS_POR_TELA;
    const diasNecessarios = Math.ceil(horasRestantes / HORAS_POR_DIA);

    let data = new Date();
    let diasUteis = diasNecessarios;

    while (diasUteis > 0) {
      data.setDate(data.getDate() + 1);
      const dia = data.getDay();
      if (dia !== 0 && dia !== 6) diasUteis--;
    }

    return {
      telasRestantes,
      horasRestantes,
      dataPrevista: data,
    };
  }, [isAdmin, resumo]);

  /* =========================
     CÁLCULOS DO GRÁFICO DE DESEMPENHO
  ========================= */
  const graficoData = useMemo(() => {
    const semanas = obterSemanasGrafico();
    const tecnicosSet = new Set();
    const tecnicosInfo = {};

    for (const t of historicoTelas) {
      if (t.tecnico_id) {
        tecnicosSet.add(t.tecnico_id);
        tecnicosInfo[t.tecnico_id] = t.tecnico_nome || "Sem Nome";
      }
    }

    const listaTecnicos = Array.from(tecnicosSet);

    if (listaTecnicos.length === 0 && !isAdmin && user) {
      listaTecnicos.push(user.id);
      tecnicosInfo[user.id] = user.nome || user.tecnico_nome || "Meu Desempenho";
    }

    const tecnicosOrdenados = listaTecnicos.map(id => ({
      id,
      nome: tecnicosInfo[id],
    })).sort((a, b) => a.nome.localeCompare(b.nome));

    const series = tecnicosOrdenados.map((tech, idx) => {
      const valores = semanas.map(sem => {
        const count = historicoTelas.filter(t => {
          if (t.tecnico_id !== tech.id) return false;
          if (!t.data_fim_real) return false;
          const dataFim = new Date(t.data_fim_real + "T12:00:00");
          return dataFim >= sem.inicio && dataFim <= sem.fim;
        }).length;
        return count;
      });

      return {
        tecnicoId: tech.id,
        tecnicoNome: tech.nome,
        valores,
        cor: CORES[idx % CORES.length],
      };
    });

    return { semanas, series };
  }, [historicoTelas, isAdmin, user]);

  const maxValor = useMemo(() => {
    let max = 4;
    if (graficoData && graficoData.series) {
      for (const s of graficoData.series) {
        const localMax = Math.max(...s.valores, 0);
        if (localMax > max) max = localMax;
      }
    }
    return Math.ceil(max / 2) * 2;
  }, [graficoData]);

  const gridLevels = useMemo(() => {
    const levels = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      levels.push(Math.round((maxValor / steps) * i * 10) / 10);
    }
    return Array.from(new Set(levels)).sort((a, b) => a - b);
  }, [maxValor]);

  return (
    <AppShell>
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <>
          {/* =========================
              CARDS GERAIS
          ========================= */}
          <div style={styles.grid}>
            <Card title="Total" value={resumo.total} />
            <Card title="Pendentes" value={resumo.pendentes} />
            <Card title="Trabalhando" value={resumo.trabalhando} />
            <Card title="Concluídas" value={resumo.concluidas} />
          </div>

          {/* =========================
              PREVISÃO DE CONCLUSÃO
          ========================= */}
          {isAdmin && previsao && (
            <div style={{ ...styles.card, marginTop: 16 }}>
              <div style={styles.cardTitle}>Previsão de Conclusão</div>
              <div style={{ marginTop: 6 }}>
                Telas restantes: <strong>{previsao.telasRestantes}</strong>
              </div>
              <div>
                Horas estimadas:{" "}
                <strong>{previsao.horasRestantes.toFixed(1)}h</strong>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>
                Data prevista:{" "}
                {previsao.dataPrevista.toLocaleDateString("pt-BR")}
              </div>
            </div>
          )}

          {/* =========================
              GRÁFICO DE DESEMPENHO SEMANAL
          ========================= */}
          <div style={styles.chartCard}>
            <div style={styles.chartTitle}>Desempenho de Produtividade Semanal (Telas Finalizadas)</div>
            
            {/* Legenda */}
            <div style={styles.legendContainer}>
              {graficoData.series.map((s) => (
                <div key={s.tecnicoId} style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: s.cor }}></span>
                  <span>{s.tecnicoNome}</span>
                </div>
              ))}
            </div>

            {/* SVG do Gráfico */}
            <div style={{ position: "relative", width: "100%", overflow: "hidden", maxHeight: "220px" }}>
              <svg viewBox="0 0 1000 200" width="100%" height={200} style={{ overflow: "visible" }}>
                <defs>
                  {graficoData.series.map((s) => (
                    <linearGradient key={s.tecnicoId} id={`grad-${s.tecnicoId}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.cor} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={s.cor} stopOpacity={0.0} />
                    </linearGradient>
                  ))}
                </defs>

                {/* Grade Horizontal e Valores Y */}
                {gridLevels.map((level) => {
                  const y = 20 + 150 - (level / maxValor) * 150;
                  return (
                    <g key={level}>
                      <line
                        x1={40}
                        y1={y}
                        x2={980}
                        y2={y}
                        stroke="rgba(0,0,0,0.06)"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={30}
                        y={y + 4}
                        fill="#9ca3af"
                        fontSize={10}
                        textAnchor="end"
                      >
                        {level}
                      </text>
                    </g>
                  );
                })}

                {/* Colunas Verticais das Semanas */}
                {graficoData.semanas.map((sem, idx) => {
                  const x = 40 + (idx / (graficoData.semanas.length - 1 || 1)) * 940;
                  return (
                    <line
                      key={sem.key}
                      x1={x}
                      y1={20}
                      x2={x}
                      y2={170}
                      stroke="rgba(0,0,0,0.03)"
                    />
                  );
                })}

                {/* Linhas e Áreas de Gradiente para cada Técnico */}
                {graficoData.series.map((series) => {
                  const points = series.valores.map((val, idx) => {
                    const x = 40 + (idx / (graficoData.semanas.length - 1 || 1)) * 940;
                    const y = 20 + 150 - (val / maxValor) * 150;
                    return { x, y, val, idx };
                  });

                  const linePath = points
                    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                    .join(" ");

                  const areaPath = `${linePath} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;

                  return (
                    <g key={series.tecnicoId}>
                      {/* Área Gradiente */}
                      <path
                        d={areaPath}
                        fill={`url(#grad-${series.tecnicoId})`}
                      />
                      {/* Linha Principal */}
                      <path
                        d={linePath}
                        fill="none"
                        stroke={series.cor}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Círculos nos Pontos e Área Interativa */}
                      {points.map((p) => (
                        <g key={p.idx}>
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={4}
                            fill="#fff"
                            stroke={series.cor}
                            strokeWidth={2}
                          />
                          {/* Circle Interativo invisível maior */}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={12}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={(e) => {
                              setTooltip({
                                tecnicoNome: series.tecnicoNome,
                                semana: graficoData.semanas[p.idx].label,
                                quantidade: p.val,
                                x: p.x,
                                y: p.y,
                                color: series.cor,
                              });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        </g>
                      ))}
                    </g>
                  );
                })}

                {/* Eixo X - Labels das Semanas */}
                {graficoData.semanas.map((sem, idx) => {
                  const x = 40 + (idx / (graficoData.semanas.length - 1 || 1)) * 940;
                  return (
                    <text
                      key={sem.key}
                      x={x}
                      y={192}
                      fill="#6b7280"
                      fontSize={10}
                      textAnchor="middle"
                    >
                      {sem.label}
                    </text>
                  );
                })}

                {/* Balão Tooltip Glassmorphism NATIVO DO SVG via foreignObject */}
                {tooltip && (
                  <foreignObject
                    x={tooltip.x - 75}
                    y={tooltip.y - 95}
                    width={150}
                    height={85}
                    style={{ overflow: "visible", pointerEvents: "none" }}
                  >
                    <div
                      style={{
                        background: "rgba(17, 24, 39, 0.9)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        border: `1px solid ${tooltip.color}`,
                        borderRadius: "8px",
                        padding: "8px 12px",
                        color: "#fff",
                        fontSize: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        minWidth: "130px",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: tooltip.color }}></span>
                        {tooltip.tecnicoNome}
                      </div>
                      <div style={{ color: "#e5e7eb", fontSize: "11px" }}>Semana: {tooltip.semana}</div>
                      <div style={{ fontWeight: 800, color: "#38bdf8", marginTop: 2, fontSize: "12px" }}>Telas: {tooltip.quantidade}</div>
                    </div>
                  </foreignObject>
                )}
              </svg>
            </div>
          </div>

          {/* =========================
              STATUS + PRODUTIVIDADE
          ========================= */}
          {isAdmin && (
            <>
              <h3 style={styles.h3}>Status por Técnico</h3>
              <div style={styles.list}>
                {Object.entries(resumo.porTecnico)
                  .filter(([k]) => k !== "Sem Técnico")
                  .map(([nome, v]) => (
                    <div key={nome} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <div 
                        style={{ ...styles.row, borderBottom: "none", cursor: "pointer" }}
                        onClick={() => toggleExpand(nome)}
                      >
                        <div style={{ fontWeight: 800 }}>{nome}</div>
                        <div style={styles.badges}>
                          <Badge label={`Total: ${v.total}`} />
                          <Badge label={`Trabalhando: ${v.trabalhando}`} />
                          <Badge label={`Concluídas: ${v.concluidas}`} />
                          <Badge label={`Total Horas: ${formatarHHMM(v.horasTotais)}`} style={{ borderColor: "#3b82f6", color: "#1d4ed8" }} />
                        </div>
                      </div>
                      {expandedTech[nome] && (() => {
                        const techTasks = rows.filter(r => r.tecnico_nome === nome);
                        const workingTasks = techTasks.filter(r => idsEmAndamento.includes(r.id));
                        const pausedTasks = techTasks.filter(r => 
                          !idsEmAndamento.includes(r.id) && 
                          !(r.status_api === "Finalizado" && r.status_teste === "Finalizado" && r.status_documentacao === "Finalizado")
                        );

                        const calcularHorasTarefa = (tarefaId) => {
                          const taskAponts = apontamentos.filter(a => a.controle_api_id === tarefaId);
                          let totalMs = 0;
                          for (const a of taskAponts) {
                            const start = new Date(a.inicio).getTime();
                            const end = a.fim ? new Date(a.fim).getTime() : Date.now();
                            totalMs += (end - start);
                          }
                          return totalMs / 36e5;
                        };

                        return (
                          <div style={{ padding: "0px 14px 14px 14px", fontSize: 13, display: "flex", gap: "24px" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, marginBottom: 6, color: "#1d4ed8" }}>▶ Em andamento:</div>
                              {workingTasks.length > 0 ? (
                                <ul style={{ paddingLeft: 20, margin: 0, color: "#374151" }}>
                                  {workingTasks.map(t => {
                                    const horasTarefa = calcularHorasTarefa(t.id);
                                    return (
                                      <li key={t.id} style={{ marginBottom: 4 }}>
                                        <strong>{t.tela || t.nome_tabela || "Sem nome"}</strong>{" "}
                                        <span style={{ color: "#9ca3af", fontSize: 12 }}>({t.modulo})</span>
                                        {" — "}
                                        <span style={{ color: "#1d4ed8", fontWeight: 600 }}>⏱️ {formatarHHMM(horasTarefa)}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <div style={{ color: "#9ca3af", paddingLeft: 4 }}>Nenhuma tela em andamento.</div>
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, marginBottom: 6, color: "#d97706" }}>⏸ Pausadas / Na fila:</div>
                              {pausedTasks.length > 0 ? (
                                <ul style={{ paddingLeft: 20, margin: 0, color: "#374151" }}>
                                  {pausedTasks.map(t => {
                                    const horasTarefa = calcularHorasTarefa(t.id);
                                    return (
                                      <li key={t.id} style={{ marginBottom: 4 }}>
                                        <strong>{t.tela || t.nome_tabela || "Sem nome"}</strong>{" "}
                                        <span style={{ color: "#9ca3af", fontSize: 12 }}>({t.modulo})</span>
                                        {" — "}
                                        <span style={{ color: "#d97706", fontWeight: 600 }}>⏱️ {formatarHHMM(horasTarefa)}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <div style={{ color: "#9ca3af", paddingLeft: 4 }}>Nenhuma tela pausada.</div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))}
              </div>

              <h3 style={styles.h3}>Produtividade Semanal (Telas)</h3>
              <div style={styles.list}>
                {produtividadeTelasFormatada.map((t) => (
                  <div key={t.tecnico_id} style={styles.row}>
                    <div style={{ fontWeight: 800 }}>{t.tecnico_nome}</div>
                    <div style={styles.badges}>
                      <Badge label={`Finalizadas: ${t.finalizadas}`} />
                      <Badge label={`Faltam: ${t.faltam}`} />
                      <Badge label={`Meta: ${t.meta_semanal || 1}`} />
                      <Badge label={`Horas: ${formatarHHMM(t.horasSemanais)}`} style={{ borderColor: "#8b5cf6", color: "#6d28d9" }} />
                      <span
                        style={{
                          ...styles.percentual,
                          background:
                            t.status === "verde"
                              ? "#dcfce7"
                              : t.status === "amarelo"
                              ? "#fef9c3"
                              : "#fee2e2",
                        }}
                      >
                        {t.percentual.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

/* =========================
   COMPONENTES
========================= */
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

function Badge({ label, style = {} }) {
  return <span style={{ ...styles.badge, ...style }}>{label}</span>;
}

/* =========================
   STYLES
========================= */
const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: {
    fontSize: 26,
    fontWeight: 900,
    color: "#111827",
    marginTop: 6,
  },
  h3: { marginTop: 22, marginBottom: 10 },
  list: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
  },
  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  badge: {
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: 999,
    padding: "6px 10px",
  },
  percentual: {
    fontSize: 12,
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 700,
  },
  err: {
    marginTop: 10,
    background: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: 12,
    padding: 10,
  },
  chartCard: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    position: "relative",
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 12,
  },
  legendContainer: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#4b5563",
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },
};
