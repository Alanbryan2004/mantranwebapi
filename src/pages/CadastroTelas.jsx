import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    XCircle, RotateCcw, PlusCircle, Pencil, Trash2,
    ChevronLeft, ChevronRight,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

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

export default function CadastroTelas() {
    const navigate = useNavigate();

    const [lista, setLista] = useState([]);
    const [editId, setEditId] = useState(null);
    const [pagina, setPagina] = useState(1);
    const [dados, setDados] = useState({
        nome_tabela: "",
        tipo_tabela: "Cadastro",
        qtd_campos: "",
        modulo: "Operacao",
    });

    async function carregar() {
        const data = await apiGet(
            "/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,modulo,qtd_campos,nivel_api&order=nome_tabela.asc"
        );
        setLista(data || []);
        setPagina(1);
    }

    useEffect(() => { carregar(); }, []);

    const totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
    const inicio = (pagina - 1) * PAGE_SIZE;
    const listaExibida = lista.slice(inicio, inicio + PAGE_SIZE);

    const limpar = () => {
        setDados({ nome_tabela: "", tipo_tabela: "Cadastro", qtd_campos: "", modulo: "Operacao" });
        setEditId(null);
    };

    const incluir = async () => {
        if (!dados.nome_tabela.trim()) return alert("Informe a Tela");
        if (!dados.qtd_campos || Number(dados.qtd_campos) < 0) return alert("Informe a quantidade de campos (pode ser 0)");

        try {
            await apiPost("/rest/v1/controle_api", {
                tela: dados.nome_tabela.trim(),
                nome_tabela: dados.nome_tabela.trim(),
                tipo_tabela: dados.tipo_tabela,
                qtd_campos: Number(dados.qtd_campos),
                modulo: dados.modulo,
            });

            alert("Tela incluída com sucesso");
            await carregar();
            limpar();
        } catch (error) {
            alert("Erro ao incluir: " + (error.message || String(error)));
        }
    };

    const alterar = async () => {
        if (!editId) return alert("Selecione um registro na tabela");

        try {
            await apiPatch(`/rest/v1/controle_api?id=eq.${editId}`, {
                tela: dados.nome_tabela.trim(),
                nome_tabela: dados.nome_tabela.trim(),
                tipo_tabela: dados.tipo_tabela,
                qtd_campos: Number(dados.qtd_campos),
                modulo: dados.modulo,
            });

            alert("Tela alterada com sucesso");
            await carregar();
            limpar();
        } catch (error) {
            alert("Erro ao alterar: " + (error.message || String(error)));
        }
    };

    const excluir = async () => {
        if (!editId) return alert("Selecione um registro na tabela");
        if (!window.confirm("Confirma exclusão da tela?")) return;

        try {
            await apiDelete(`/rest/v1/controle_api?id=eq.${editId}`);

            alert("Tela excluída com sucesso");
            await carregar();
            limpar();
        } catch (error) {
            alert("Erro ao excluir: " + (error.message || String(error)));
        }
    };

    const selecionar = (item) => {
        setDados({
            nome_tabela: item.tela,
            tipo_tabela: item.tipo_tabela,
            qtd_campos: item.qtd_campos,
            modulo: item.modulo,
        });
        setEditId(item.id);
    };

    return (
        <AppShell>
            {/* margin: -16 cancela o padding do AppShell e deixa a tela edge-to-edge */}
            <div style={{ margin: -16, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>

                {/* ── Título ── */}
                <div style={s.titulo}>CADASTRO DE TELAS</div>

                {/* ── Corpo ── */}
                <div style={{ flex: 1, padding: "12px 16px 70px" }}>

                    {/* Fieldset Parâmetros */}
                    <fieldset style={s.fieldset}>
                        <legend style={s.legend}>Parâmetros</legend>

                        <div style={s.grid2}>
                            <Campo label="Tela">
                                <input
                                    value={dados.nome_tabela}
                                    onChange={(e) => setDados({ ...dados, nome_tabela: e.target.value })}
                                    style={s.input}
                                />
                            </Campo>

                            <Campo label="Tipo">
                                <select
                                    value={dados.tipo_tabela}
                                    onChange={(e) => {
                                        const novoTipo = e.target.value;
                                        let novoModulo = dados.modulo;
                                        if (novoTipo === "Arquitetura") {
                                            novoModulo = "Mantran.API";
                                        } else if (dados.tipo_tabela === "Arquitetura") {
                                            novoModulo = "Operacao";
                                        }
                                        setDados({ ...dados, tipo_tabela: novoTipo, modulo: novoModulo });
                                    }}
                                    style={s.input}
                                >
                                    <option>Cadastro</option>
                                    <option>Documento</option>
                                    <option>Arquitetura</option>
                                </select>
                            </Campo>

                            <Campo label="Qtd. Campos">
                                <input
                                    type="number"
                                    min="0"
                                    value={dados.qtd_campos}
                                    onChange={(e) => setDados({ ...dados, qtd_campos: e.target.value })}
                                    style={{ ...s.input, width: 100 }}
                                />
                            </Campo>

                            <Campo label="Módulo">
                                <select
                                    value={dados.modulo}
                                    onChange={(e) => setDados({ ...dados, modulo: e.target.value })}
                                    style={s.input}
                                >
                                    {dados.tipo_tabela === "Arquitetura" ? (
                                        <>
                                            <option>Mantran.API</option>
                                            <option>Mantran.Web.React</option>
                                            <option>IA</option>
                                            <option>Organização</option>
                                        </>
                                    ) : (
                                        <>
                                            <option>Operacao</option>
                                            <option>Financeiro</option>
                                            <option>WMS</option>
                                            <option>Seguranca</option>
                                            <option>Oficina</option>
                                        </>
                                    )}
                                </select>
                            </Campo>
                        </div>
                    </fieldset>

                    {/* Fieldset Registros */}
                    <fieldset style={{ ...s.fieldset, marginTop: 12 }}>
                        <legend style={s.legend}>Registros Cadastrados</legend>

                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {["Tela", "Tipo", "Módulo", "Qtd. Campos", "Nível"].map((h, i) => (
                                        <th key={h} style={{ ...s.th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {listaExibida.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                            Nenhum registro encontrado
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
                                        <td style={{ ...s.td, color: "#1d4ed8" }}>{item.tela}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#1d4ed8" }}>{item.tipo_tabela}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#1d4ed8" }}>{item.modulo}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#1d4ed8" }}>{item.qtd_campos}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#1d4ed8" }}>{item.nivel_api}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Paginação */}
                        <div style={s.paginacao}>
                            <span style={s.paginacaoInfo}>
                                {lista.length === 0
                                    ? "0 registros"
                                    : `Exibindo ${inicio + 1}–${Math.min(inicio + PAGE_SIZE, lista.length)} de ${lista.length} registros`}
                            </span>

                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <BtnPag
                                    onClick={() => setPagina(p => p - 1)}
                                    disabled={pagina === 1}
                                >
                                    <ChevronLeft size={12} /> Ant
                                </BtnPag>

                                {paginas(pagina, totalPaginas).map((item, i) =>
                                    item === "..." ? (
                                        <span key={`e${i}`} style={{ fontSize: 11, color: "#9ca3af", padding: "0 2px" }}>…</span>
                                    ) : (
                                        <BtnPag
                                            key={item}
                                            onClick={() => setPagina(item)}
                                            ativo={pagina === item}
                                        >
                                            {item}
                                        </BtnPag>
                                    )
                                )}

                                <BtnPag
                                    onClick={() => setPagina(p => p + 1)}
                                    disabled={pagina === totalPaginas}
                                >
                                    Próx <ChevronRight size={12} />
                                </BtnPag>
                            </div>
                        </div>
                    </fieldset>
                </div>

                {/* ── Rodapé ── */}
                <div style={s.rodape}>
                    <BtnRodape icon={<XCircle size={22} />} label="Fechar"  onClick={() => navigate(-1)} />
                    <BtnRodape icon={<RotateCcw size={22} />} label="Limpar"  onClick={limpar} />
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
        width: 110,
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
