import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    XCircle, RotateCcw, PlusCircle, Pencil, Trash2,
    ChevronLeft, ChevronRight, RefreshCw
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

const PAGE_SIZE = 20;

function paginas(atual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const set = new Set([1, total, atual, atual - 1, atual + 1].filter(p => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const result = [];
    for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("...");
        result.push(sorted[i]);
    }
    return result;
}

export default function Incluir() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [lista, setLista] = useState([]);
    const [telas, setTelas] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    
    const [editId, setEditId] = useState(null);
    const [pagina, setPagina] = useState(1);
    const [dados, setDados] = useState({
        controle_api_id: "",
        inicio: "",
        termino: "",
        tecnico_id: "",
        carga_horaria: "",
        justificativa: "",
    });
    
    const [originalItem, setOriginalItem] = useState(null);
    const [filtroTecnico, setFiltroTecnico] = useState("");

    // Segurança: Apenas Administrador acessa Incluir
    useEffect(() => {
        if (user && user.perfil !== "Administrador") {
            navigate("/cronograma/visualizar");
        }
    }, [user, navigate]);

    async function carregar() {
        try {
            const [dataCronograma, dataTelas, dataTecnicos] = await Promise.all([
                apiGet("/rest/v1/cronograma?select=*,controle_api(tela,nome_tabela)&order=inicio.asc,termino.asc"),
                apiGet("/rest/v1/controle_api?select=id,tela,nome_tabela&order=nome_tabela.asc"),
                apiGet("/rest/v1/usuario?select=id,nome&ativo=eq.true&order=nome.asc")
            ]);

            setLista(dataCronograma || []);
            setTelas(dataTelas || []);
            setTecnicos(dataTecnicos || []);
        } catch (err) {
            console.error("Erro ao carregar dados", err);
            alert("Erro ao carregar os dados. Verifique a tabela cronograma no banco de dados.");
        }
    }

    useEffect(() => {
        if (user && user.perfil === "Administrador") {
            carregar();
        }
    }, [user]);

    if (!user || user.perfil !== "Administrador") return null;

    const listaFiltrada = filtroTecnico 
        ? lista.filter(item => item.tecnico_id === filtroTecnico)
        : lista;

    const totalPaginas = Math.max(1, Math.ceil(listaFiltrada.length / PAGE_SIZE));
    const inicioOffset = (pagina - 1) * PAGE_SIZE;
    const listaExibida = listaFiltrada.slice(inicioOffset, inicioOffset + PAGE_SIZE);

    const limpar = () => {
        setDados({
            controle_api_id: "",
            inicio: "",
            termino: "",
            tecnico_id: "",
            carga_horaria: "",
            justificativa: "",
        });
        setOriginalItem(null);
        setEditId(null);
    };

    const incluir = async () => {
        if (!dados.controle_api_id) return alert("Selecione a Tela");
        if (!dados.inicio) return alert("Informe a data de Início");
        if (!dados.termino) return alert("Informe a data de Término");
        if (!dados.tecnico_id) return alert("Selecione o Técnico");
        if (!dados.carga_horaria || Number(dados.carga_horaria) <= 0) return alert("Informe a Carga Horária");

        try {
            await apiPost("/rest/v1/cronograma", {
                controle_api_id: dados.controle_api_id,
                inicio: dados.inicio,
                termino: dados.termino,
                tecnico_id: dados.tecnico_id,
                carga_horaria: Number(dados.carga_horaria)
            });

            const tecnicoSelecionado = tecnicos.find(t => t.id === dados.tecnico_id);
            if (tecnicoSelecionado) {
                await apiPatch(`/rest/v1/controle_api?id=eq.${dados.controle_api_id}`, {
                    tecnico_id: tecnicoSelecionado.id,
                    tecnico_nome: tecnicoSelecionado.nome
                });
            }

            alert("Cronograma incluído com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao cadastrar: " + e.message);
        }
    };

    const alterar = async () => {
        if (!editId) return alert("Selecione um registro na tabela");
        if (!dados.controle_api_id) return alert("Selecione a Tela");
        if (!dados.inicio) return alert("Informe a data de Início");
        if (!dados.termino) return alert("Informe a data de Término");
        if (!dados.tecnico_id) return alert("Selecione o Técnico");
        if (!dados.carga_horaria || Number(dados.carga_horaria) <= 0) return alert("Informe a Carga Horária");

        const isTerminoAlterado = originalItem && originalItem.termino !== dados.termino;
        if (isTerminoAlterado && !dados.justificativa.trim()) {
            return alert("Como a data de término foi alterada, você deve informar uma justificativa.");
        }

        try {
            const payload = {
                controle_api_id: dados.controle_api_id,
                inicio: dados.inicio,
                termino: dados.termino,
                tecnico_id: dados.tecnico_id,
                carga_horaria: Number(dados.carga_horaria),
                justificativa: dados.justificativa
            };

            // Se for a primeira alteração, grava o término original
            if (isTerminoAlterado && !originalItem.termino_original) {
                payload.termino_original = originalItem.termino;
            }

            await apiPatch(`/rest/v1/cronograma?id=eq.${editId}`, payload);

            const tecnicoSelecionado = tecnicos.find(t => t.id === dados.tecnico_id);
            if (tecnicoSelecionado) {
                await apiPatch(`/rest/v1/controle_api?id=eq.${dados.controle_api_id}`, {
                    tecnico_id: tecnicoSelecionado.id,
                    tecnico_nome: tecnicoSelecionado.nome
                });
            }

            alert("Cronograma alterado com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao alterar: " + e.message);
        }
    };

    const excluir = async () => {
        if (!editId) return alert("Selecione um registro na tabela");
        if (!window.confirm("Confirma exclusão deste cronograma?")) return;

        try {
            await apiDelete(`/rest/v1/cronograma?id=eq.${editId}`);
            alert("Registro excluído com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao excluir: " + e.message);
        }
    };

    const sincronizarTudo = async () => {
        if (!window.confirm("Isso vai vincular TODAS as tarefas do Cronograma aos respectivos técnicos na tabela principal. Deseja continuar?")) return;
        
        try {
            for (const item of lista) {
                const tecnicoSelecionado = tecnicos.find(t => t.id === item.tecnico_id);
                if (tecnicoSelecionado) {
                    await apiPatch(`/rest/v1/controle_api?id=eq.${item.controle_api_id}`, {
                        tecnico_id: tecnicoSelecionado.id,
                        tecnico_nome: tecnicoSelecionado.nome
                    });
                }
            }
            alert("Sincronização concluída com sucesso! Agora todas as tarefas já vão aparecer para os técnicos.");
            await carregar();
        } catch (e) {
            alert("Erro na sincronização: " + e.message);
        }
    };

    const selecionar = (item) => {
        setDados({
            controle_api_id: item.controle_api_id,
            inicio: item.inicio,
            termino: item.termino,
            tecnico_id: item.tecnico_id,
            carga_horaria: item.carga_horaria,
            justificativa: item.justificativa || "",
        });
        setOriginalItem(item);
        setEditId(item.id);
    };

    const getNomeTecnico = (id) => {
        const tec = tecnicos.find(t => t.id === id);
        return tec ? tec.nome : "Desconhecido";
    };

    // Filtra as telas que já estão no cronograma, exceto a que está selecionada na edição atual
    const telasDisponiveis = telas.filter(t => 
        !lista.some(c => c.controle_api_id === t.id) || t.id === dados.controle_api_id
    );

    return (
        <AppShell>
            <div style={{ margin: -16, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>
                <div style={s.titulo}>INCLUIR CRONOGRAMA</div>

                <div style={{ flex: 1, padding: "12px 16px 70px" }}>
                    <fieldset style={s.fieldset}>
                        <legend style={s.legend}>Dados do Cronograma</legend>

                        <div style={s.grid2}>
                            <Campo label="Tela">
                                <select
                                    value={dados.controle_api_id}
                                    onChange={(e) => setDados({ ...dados, controle_api_id: e.target.value })}
                                    style={s.input}
                                >
                                    <option value="">-- Selecione a Tela --</option>
                                    {telasDisponiveis.map(t => (
                                        <option key={t.id} value={t.id}>{t.nome_tabela} ({t.tela})</option>
                                    ))}
                                </select>
                            </Campo>

                            <Campo label="Técnico">
                                <select
                                    value={dados.tecnico_id}
                                    onChange={(e) => setDados({ ...dados, tecnico_id: e.target.value })}
                                    style={s.input}
                                >
                                    <option value="">-- Selecione o Técnico --</option>
                                    {tecnicos.map(t => (
                                        <option key={t.id} value={t.id}>{t.nome}</option>
                                    ))}
                                </select>
                            </Campo>

                            <Campo label="Início">
                                <input
                                    type="date"
                                    value={dados.inicio}
                                    onChange={(e) => setDados({ ...dados, inicio: e.target.value })}
                                    style={s.input}
                                />
                            </Campo>

                            <Campo label="Término">
                                <input
                                    type="date"
                                    value={dados.termino}
                                    onChange={(e) => setDados({ ...dados, termino: e.target.value })}
                                    style={s.input}
                                />
                            </Campo>

                            <Campo label="Carga Horária">
                                <input
                                    type="number"
                                    min="1"
                                    value={dados.carga_horaria}
                                    onChange={(e) => setDados({ ...dados, carga_horaria: e.target.value })}
                                    style={{ ...s.input, width: 100 }}
                                    placeholder="Horas"
                                />
                            </Campo>
                            
                            {originalItem && originalItem.termino !== dados.termino && (
                                <Campo label="Justificativa (Alteração de Data)">
                                    <input
                                        type="text"
                                        value={dados.justificativa}
                                        onChange={(e) => setDados({ ...dados, justificativa: e.target.value })}
                                        style={{ ...s.input, borderColor: "#b91c1c" }}
                                        placeholder="Motivo da alteração..."
                                    />
                                </Campo>
                            )}
                        </div>
                    </fieldset>

                    <fieldset style={{ ...s.fieldset, marginTop: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d1d5db", paddingBottom: 8, marginBottom: 8, marginTop: 8 }}>
                            <legend style={{ ...s.legend, padding: 0 }}>Cronogramas Cadastrados</legend>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Filtrar Técnico:</span>
                                <select
                                    value={filtroTecnico}
                                    onChange={(e) => {
                                        setFiltroTecnico(e.target.value);
                                        setPagina(1);
                                    }}
                                    style={{ ...s.input, width: 180, height: 26 }}
                                >
                                    <option value="">-- Todos --</option>
                                    {tecnicos.map(t => (
                                        <option key={t.id} value={t.id}>{t.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {["Tela", "Início", "Término", "Técnico", "Carga Horária"].map((h, i) => (
                                        <th key={h} style={{ ...s.th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {listaExibida.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                            Nenhum cronograma cadastrado
                                        </td>
                                    </tr>
                                )}
                                {listaExibida.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => selecionar(item)}
                                        style={{
                                            cursor: "pointer",
                                            background: editId === item.id ? "#fefce8" : "#fff",
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = editId === item.id ? "#fef9c3" : "#fff1f2"}
                                        onMouseLeave={e => e.currentTarget.style.background = editId === item.id ? "#fefce8" : "#fff"}
                                    >
                                        <td style={{ ...s.td, color: "#1d4ed8", fontWeight: 600 }}>{item.controle_api?.nome_tabela}</td>
                                        <td style={{ ...s.td, textAlign: "center" }}>{new Date(item.inicio).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                        <td style={{ ...s.td, textAlign: "center" }}>
                                            {new Date(item.termino).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                            {item.justificativa && <span title={item.justificativa}> ⚠️</span>}
                                        </td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#374151" }}>{getNomeTecnico(item.tecnico_id)}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#4f46e5", fontWeight: 700 }}>{item.carga_horaria}h</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div style={s.paginacao}>
                            <span style={s.paginacaoInfo}>
                                {listaFiltrada.length === 0
                                    ? "0 registros"
                                    : `Exibindo ${inicioOffset + 1}–${Math.min(inicioOffset + PAGE_SIZE, listaFiltrada.length)} de ${listaFiltrada.length} registros`}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <BtnPag onClick={() => setPagina(p => p - 1)} disabled={pagina === 1}>
                                    <ChevronLeft size={12} /> Ant
                                </BtnPag>
                                {paginas(pagina, totalPaginas).map((item, i) =>
                                    item === "..." ? (
                                        <span key={`e${i}`} style={{ fontSize: 11, color: "#9ca3af", padding: "0 2px" }}>…</span>
                                    ) : (
                                        <BtnPag key={item} onClick={() => setPagina(item)} ativo={pagina === item}>
                                            {item}
                                        </BtnPag>
                                    )
                                )}
                                <BtnPag onClick={() => setPagina(p => p + 1)} disabled={pagina === totalPaginas}>
                                    Próx <ChevronRight size={12} />
                                </BtnPag>
                            </div>
                        </div>
                    </fieldset>
                </div>

                <div style={s.rodape}>
                    <BtnRodape icon={<XCircle size={22} />} label="Fechar" onClick={() => navigate(-1)} />
                    <BtnRodape icon={<RotateCcw size={22} />} label="Limpar" onClick={limpar} />
                    <BtnRodape icon={<RefreshCw size={22} />} label="Sincronizar" onClick={sincronizarTudo} />
                    <BtnRodape icon={<PlusCircle size={22} />} label="Incluir" onClick={incluir} />
                    <BtnRodape icon={<Pencil size={22} />} label="Alterar" onClick={alterar} />
                    <BtnRodape icon={<Trash2 size={22} />} label="Excluir" onClick={excluir} />
                </div>
            </div>
        </AppShell>
    );
}

function Campo({ label, children }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={s.label}>{label}</span>
            <div style={{ flex: 1 }}>{children}</div>
        </div>
    );
}

function BtnRodape({ icon, label, onClick }) {
    return (
        <button onClick={onClick} style={s.btnRodape}
            onMouseEnter={e => { e.currentTarget.style.color = "#991b1b"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#b91c1c"; }}
        >
            {icon}
            <span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
        </button>
    );
}

function BtnPag({ onClick, disabled, ativo, children }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: "flex", alignItems: "center", gap: 2,
                padding: "2px 6px", fontSize: 11, borderRadius: 4, cursor: disabled ? "not-allowed" : "pointer",
                border: "1px solid",
                borderColor: ativo ? "#b91c1c" : "#d1d5db",
                background: ativo ? "#b91c1c" : "#fff",
                color: ativo ? "#fff" : disabled ? "#d1d5db" : "#374151",
                minWidth: 24, justifyContent: "center",
            }}
        >
            {children}
        </button>
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
    fieldset: {
        border: "1px solid #d1d5db",
        borderRadius: 6,
        padding: "4px 16px 12px",
        background: "#fff",
    },
    legend: {
        color: "#b91c1c",
        fontWeight: 600,
        fontSize: 12,
        padding: "0 6px",
    },
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px 32px",
        marginTop: 4,
    },
    label: {
        fontSize: 12,
        color: "#374151",
        width: 140,
        flexShrink: 0,
    },
    input: {
        width: "100%",
        border: "1px solid #d1d5db",
        borderRadius: 4,
        padding: "2px 8px",
        height: 26,
        fontSize: 12,
        color: "#111827",
        background: "#fff",
        boxSizing: "border-box",
        outline: "none",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12,
        marginTop: 4,
    },
    th: {
        background: "#6b7280",
        color: "#fff",
        border: "1px solid #9ca3af",
        padding: "5px 10px",
        fontWeight: 600,
        fontSize: 12,
    },
    td: {
        border: "1px solid #e5e7eb",
        padding: "4px 10px",
        fontSize: 12,
    },
    paginacao: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 8,
    },
    paginacaoInfo: {
        fontSize: 11,
        color: "#6b7280",
    },
    rodape: {
        position: "fixed",
        bottom: 0,
        left: 220,
        right: 0,
        background: "#fff",
        borderTop: "1px solid #d1d5db",
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "6px 24px",
        zIndex: 50,
    },
    btnRodape: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        color: "#b91c1c",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        transition: "color 0.15s",
    },
};
