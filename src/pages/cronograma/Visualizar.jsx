import { useState, useEffect } from "react";
import AppShell from "../../components/AppShell";
import { apiGet, rpc } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { AlertCircle } from "lucide-react";

function formatarHHMM(horasDecimais) {
    if (!horasDecimais) return "0h 0m";
    const h = Math.floor(horasDecimais);
    const m = Math.round((horasDecimais - h) * 60);
    return `${h}h ${m}m`;
}

export default function Visualizar() {
    const { user } = useAuth();
    
    const [lista, setLista] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [apontamentos, setApontamentos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tooltipContent, setTooltipContent] = useState(null);
    const [filtroTecnico, setFiltroTecnico] = useState("");

    async function carregar() {
        try {
            setLoading(true);
            const [dataCronograma, dataTecnicos, dataApontamentos] = await Promise.all([
                apiGet("/rest/v1/cronograma?select=*,controle_api(tela,nome_tabela,tipo_tabela,status_api,status_teste,status_documentacao)&order=inicio.asc,termino.asc"),
                apiGet("/rest/v1/usuario?select=id,nome"),
                apiGet("/rest/v1/apontamento_tempo?select=controle_api_id,inicio,fim")
            ]);

            const filteredData = (dataCronograma || []).filter(item => item.controle_api?.tipo_tabela !== "Arquitetura");
            
            // AUTO-CURA: Se a tarefa está finalizada mas o relógio ficou aberto (aconteceu antes da atualização)
            const apontamentosAtuais = dataApontamentos || [];
            let precisaRecarregar = false;

            for (const item of filteredData) {
                const isFinished = item.controle_api?.status_api === "Finalizado" && 
                                   item.controle_api?.status_teste === "Finalizado" && 
                                   item.controle_api?.status_documentacao === "Finalizado";
                if (isFinished) {
                    const abertos = apontamentosAtuais.filter(a => a.controle_api_id === item.controle_api_id && !a.fim);
                    if (abertos.length > 0) {
                        try {
                            await rpc("finalizar_trabalho", {
                                p_controle_api_id: item.controle_api_id,
                                p_tecnico_id: item.tecnico_id
                            });
                            precisaRecarregar = true;
                        } catch (e) {
                            console.error("Erro ao auto-finalizar", e);
                        }
                    }
                }
            }

            if (precisaRecarregar) {
                const novosApontamentos = await apiGet("/rest/v1/apontamento_tempo?select=controle_api_id,inicio,fim");
                setApontamentos(novosApontamentos || []);
            } else {
                setApontamentos(apontamentosAtuais);
            }

            setLista(filteredData);
            setTecnicos(dataTecnicos || []);
        } catch (err) {
            console.error("Erro ao carregar dados", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        carregar();
    }, [user]);

    const getNomeTecnico = (id) => {
        const tec = tecnicos.find(t => t.id === id);
        return tec ? tec.nome : "Desconhecido";
    };

    const calcularHorasTrabalhadas = (controleApiId) => {
        const ap = apontamentos.filter(a => a.controle_api_id === controleApiId);
        let totalTime = 0;
        const now = Date.now();
        
        for (const a of ap) {
            const start = new Date(a.inicio).getTime();
            const end = a.fim ? new Date(a.fim).getTime() : now;
            totalTime += (end - start);
        }
        
        return totalTime / 1000 / 3600; // Em horas
    };

    const exibirTooltip = (item, e) => {
        if (!item.justificativa && !item.termino_original) return;
        
        setTooltipContent({
            termino_original: item.termino_original,
            justificativa: item.justificativa,
            x: e.clientX,
            y: e.clientY
        });
    };

    const ocultarTooltip = () => {
        setTooltipContent(null);
    };

    const listaFiltrada = filtroTecnico 
        ? lista.filter(item => item.tecnico_id === filtroTecnico)
        : lista;

    const dataFinalProjeto = listaFiltrada.length > 0 
        ? new Date(Math.max(...listaFiltrada.map(i => new Date(i.termino).getTime())))
        : null;

    let totalCargaHoraria = 0;
    let totalHorasTrabalhadas = 0;

    listaFiltrada.forEach(item => {
        const isFinished = item.controle_api?.status_api === "Finalizado" && 
                           item.controle_api?.status_teste === "Finalizado" && 
                           item.controle_api?.status_documentacao === "Finalizado";
                           
        const horasTrab = calcularHorasTrabalhadas(item.controle_api_id);
        const cargaOriginal = Number(item.carga_horaria) || 0;
        
        // Se finalizou, a carga real daquela tarefa foi o tempo efetivo que levou
        const cargaConsiderada = isFinished ? horasTrab : cargaOriginal;

        totalCargaHoraria += cargaConsiderada;
        totalHorasTrabalhadas += Math.min(horasTrab, cargaConsiderada);
    });

    const percentualTotal = totalCargaHoraria > 0 ? (totalHorasTrabalhadas / totalCargaHoraria) * 100 : 0;

    return (
        <AppShell>
            <div style={{ margin: -16, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>
                <div style={s.titulo}>VISUALIZAR CRONOGRAMA</div>

                <div style={{ flex: 1, padding: "12px 16px" }}>
                    {loading ? (
                        <div style={{ textAlign: "center", padding: 20, color: "#6b7280" }}>Carregando cronograma...</div>
                    ) : (
                        <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, background: "#fff", padding: "12px 16px", borderRadius: 8, border: "1px solid #d1d5db" }}>
                                <div>
                                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Previsão de Fim do Projeto</div>
                                    <div style={{ fontSize: 18, color: "#b91c1c", fontWeight: 800 }}>
                                        {dataFinalProjeto ? dataFinalProjeto.toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : "-"}
                                    </div>
                                </div>

                                <div style={{ flex: 1, padding: "0 40px", maxWidth: 450 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Progresso Geral</span>
                                        <span style={{ fontSize: 11, color: "#4b5563", fontWeight: 700 }}>
                                            {formatarHHMM(totalHorasTrabalhadas)} / {formatarHHMM(totalCargaHoraria)} ({percentualTotal.toFixed(0)}%)
                                        </span>
                                    </div>
                                    <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                                        <div style={{ 
                                            height: "100%", 
                                            background: percentualTotal >= 100 ? "#10b981" : "#3b82f6", 
                                            width: `${percentualTotal}%`,
                                            transition: "width 0.5s ease"
                                        }} />
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Filtrar Técnico:</span>
                                    <select
                                        value={filtroTecnico}
                                        onChange={(e) => setFiltroTecnico(e.target.value)}
                                        style={{ border: "1px solid #d1d5db", borderRadius: 4, padding: "6px 8px", fontSize: 12, outline: "none", width: 200 }}
                                    >
                                        <option value="">-- Todos --</option>
                                        {tecnicos.map(t => (
                                            <option key={t.id} value={t.id}>{t.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={s.gridContainer}>
                            <table style={s.table}>
                                <thead>
                                    <tr>
                                        {["Tela", "Início", "Término", "Técnico", "Progresso"].map((h, i) => (
                                            <th key={h} style={{ ...s.th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {listaFiltrada.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                                Nenhum cronograma cadastrado.
                                            </td>
                                        </tr>
                                    )}
                                    {listaFiltrada.map((item) => {
                                        const isFinished = item.controle_api?.status_api === "Finalizado" && 
                                                           item.controle_api?.status_teste === "Finalizado" && 
                                                           item.controle_api?.status_documentacao === "Finalizado";

                                        const horasTrab = calcularHorasTrabalhadas(item.controle_api_id);
                                        let percent = item.carga_horaria > 0 ? (horasTrab / item.carga_horaria) * 100 : 0;
                                        
                                        let barColor = "#3b82f6";
                                        if (isFinished) {
                                            barColor = "#10b981"; // Concluído (Verde)
                                        } else if (percent > 100) {
                                            barColor = "#ef4444"; // Estourado (Vermelho)
                                        }
                                        
                                        const widthPercent = Math.min(percent, 100);
                                        
                                        const hasAlteration = !!item.justificativa;

                                        return (
                                            <tr key={item.id} style={{ background: "#fff" }}>
                                                <td style={{ ...s.td, color: "#111827", fontWeight: 600 }}>
                                                    {item.controle_api?.nome_tabela}
                                                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: "normal" }}>
                                                        {item.controle_api?.tela}
                                                    </div>
                                                </td>
                                                <td style={{ ...s.td, textAlign: "center" }}>
                                                    {new Date(item.inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                                </td>
                                                <td style={{ ...s.td, textAlign: "center" }}>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                                        {new Date(item.termino).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                                        {hasAlteration && (
                                                            <AlertCircle 
                                                                size={16} 
                                                                color="#f59e0b" 
                                                                style={{ cursor: "pointer" }}
                                                                onMouseEnter={(e) => exibirTooltip(item, e)}
                                                                onMouseLeave={ocultarTooltip}
                                                            />
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ ...s.td, textAlign: "center", color: "#374151" }}>
                                                    {getNomeTecnico(item.tecnico_id)}
                                                </td>
                                                <td style={{ ...s.td, textAlign: "center", width: 150 }}>
                                                    <div style={s.progressContainer}>
                                                        <div style={s.progressText}>
                                                            {formatarHHMM(horasTrab)} / {item.carga_horaria}h ({percent.toFixed(0)}%)
                                                        </div>
                                                        <div style={s.progressBarBg}>
                                                            <div 
                                                                style={{ 
                                                                    ...s.progressBarFill, 
                                                                    width: `${widthPercent}%`,
                                                                    background: barColor 
                                                                }} 
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                             </table>
                        </div>
                        </>
                    )}
                </div>
                
                {/* Tooltip para justificativa */}
                {tooltipContent && (
                    <div style={{
                        position: "fixed",
                        top: tooltipContent.y + 10,
                        left: tooltipContent.x + 10,
                        background: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        padding: 12,
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                        zIndex: 9999,
                        width: 250,
                        pointerEvents: "none"
                    }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", marginBottom: 4 }}>Alteração de Prazo</div>
                        {tooltipContent.termino_original && (
                            <div style={{ fontSize: 12, marginBottom: 8 }}>
                                <strong>Data Inicial:</strong> {new Date(tooltipContent.termino_original).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                            </div>
                        )}
                        <div style={{ fontSize: 12 }}>
                            <strong>Justificativa:</strong><br />
                            <span style={{ color: "#374151" }}>{tooltipContent.justificativa}</span>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

const s = {
    titulo: {
        textAlign: "center",
        color: "#b91c1c",
        fontWeight: 600,
        fontSize: 13,
        padding: "8px 0",
        borderBottom: "1px solid #d1d5db",
        letterSpacing: "0.08em",
        background: "#fff",
    },
    gridContainer: {
        background: "#fff",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        overflow: "hidden"
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
    },
    th: {
        background: "#f9fafb",
        color: "#374151",
        borderBottom: "1px solid #e5e7eb",
        padding: "10px",
        fontWeight: 700,
        fontSize: 12,
    },
    td: {
        borderBottom: "1px solid #e5e7eb",
        padding: "10px",
        fontSize: 12,
    },
    progressContainer: {
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center"
    },
    progressText: {
        fontSize: 11,
        fontWeight: 600,
        color: "#4b5563"
    },
    progressBarBg: {
        width: "100%",
        height: 6,
        background: "#e5e7eb",
        borderRadius: 999,
        overflow: "hidden"
    },
    progressBarFill: {
        height: "100%",
        borderRadius: 999,
        transition: "width 0.3s ease"
    }
};
