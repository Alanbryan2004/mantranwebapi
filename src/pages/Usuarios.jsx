import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    XCircle, RotateCcw, PlusCircle, Pencil, Trash2,
    ChevronLeft, ChevronRight,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

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

export default function Usuarios() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [lista, setLista] = useState([]);
    const [editId, setEditId] = useState(null);
    const [pagina, setPagina] = useState(1);
    const [dados, setDados] = useState({
        nome: "",
        login: "",
        senha: "",
        perfil: "Tecnico",
        meta_semanal: "1",
        ativo: true,
    });

    // Segurança: Apenas Administrador acessa
    useEffect(() => {
        if (user && user.perfil !== "Administrador") {
            navigate("/");
        }
    }, [user, navigate]);

    async function carregar() {
        try {
            // Busca todos os usuários
            const users = await apiGet(
                "/rest/v1/usuario?select=id,nome,login,senha,perfil,ativo,meta_semanal&order=nome.asc"
            );

            // Busca as metas da tabela meta_tecnico para garantir consistência real
            let metas = [];
            try {
                metas = await apiGet("/rest/v1/meta_tecnico?select=tecnico_id,meta_semanal");
            } catch (e) {
                console.log("meta_tecnico não encontrada ou vazia", e);
            }

            // Combina usuários com metas individuais
            const combinada = (users || []).map(u => {
                const m = metas && metas.find(x => x.tecnico_id === u.id);
                return {
                    ...u,
                    meta_exibida: m ? m.meta_semanal : (u.meta_semanal !== undefined ? u.meta_semanal : 1)
                };
            });

            setLista(combinada);
            setPagina(1);
        } catch (err) {
            console.error("Erro ao carregar dados", err);
        }
    }

    useEffect(() => {
        if (user && user.perfil === "Administrador") {
            carregar();
        }
    }, [user]);

    if (!user || user.perfil !== "Administrador") {
        return null;
    }

    const totalPaginas = Math.max(1, Math.ceil(lista.length / PAGE_SIZE));
    const inicio = (pagina - 1) * PAGE_SIZE;
    const listaExibida = lista.slice(inicio, inicio + PAGE_SIZE);

    const limpar = () => {
        setDados({
            nome: "",
            login: "",
            senha: "",
            perfil: "Tecnico",
            meta_semanal: "1",
            ativo: true,
        });
        setEditId(null);
    };

    const incluir = async () => {
        if (!dados.nome.trim()) return alert("Informe o Nome do usuário");
        if (!dados.login.trim()) return alert("Informe o Login do usuário");
        if (!dados.senha.trim()) return alert("Informe a Senha");
        if (dados.meta_semanal === "" || Number(dados.meta_semanal) < 0) {
            return alert("Informe uma meta semanal válida (zero ou maior)");
        }

        try {
            // Verifica duplicidade local para evitar erros no banco
            const loginExistente = lista.some(u => u.login.toLowerCase() === dados.login.trim().toLowerCase());
            if (loginExistente) {
                return alert("Este login já está cadastrado!");
            }

            // 1. Salvar na tabela de usuario
            await apiPost("/rest/v1/usuario", {
                nome: dados.nome.trim(),
                login: dados.login.trim(),
                senha: dados.senha.trim(),
                perfil: dados.perfil,
                meta_semanal: Number(dados.meta_semanal),
                ativo: dados.ativo,
            });

            // 2. Buscar o ID do usuário gerado
            const rows = await apiGet(`/rest/v1/usuario?login=eq.${encodeURIComponent(dados.login.trim())}`);
            if (rows && rows.length > 0) {
                const newUserId = rows[0].id;
                
                // 3. Cadastrar a meta na tabela meta_tecnico para uso do Dashboard
                await apiPost("/rest/v1/meta_tecnico", {
                    tecnico_id: newUserId,
                    meta_semanal: Number(dados.meta_semanal)
                });
            }

            alert("Usuário cadastrado com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao cadastrar usuário: " + e.message);
        }
    };

    const alterar = async () => {
        if (!editId) return alert("Selecione um usuário na tabela");
        if (!dados.nome.trim()) return alert("Informe o Nome do usuário");
        if (!dados.login.trim()) return alert("Informe o Login do usuário");
        if (!dados.senha.trim()) return alert("Informe a Senha");
        if (dados.meta_semanal === "" || Number(dados.meta_semanal) < 0) {
            return alert("Informe uma meta semanal válida");
        }

        try {
            // Verifica duplicidade com outro ID
            const loginConflito = lista.some(u => u.id !== editId && u.login.toLowerCase() === dados.login.trim().toLowerCase());
            if (loginConflito) {
                return alert("Este login já está em uso por outro usuário!");
            }

            // 1. Atualizar tabela usuario
            await apiPatch(`/rest/v1/usuario?id=eq.${editId}`, {
                nome: dados.nome.trim(),
                login: dados.login.trim(),
                senha: dados.senha.trim(),
                perfil: dados.perfil,
                meta_semanal: Number(dados.meta_semanal),
                ativo: dados.ativo,
            });

            // 2. Upsert na tabela meta_tecnico
            const existingMeta = await apiGet(`/rest/v1/meta_tecnico?tecnico_id=eq.${editId}`);
            if (existingMeta && existingMeta.length > 0) {
                await apiPatch(`/rest/v1/meta_tecnico?tecnico_id=eq.${editId}`, {
                    meta_semanal: Number(dados.meta_semanal)
                });
            } else {
                await apiPost("/rest/v1/meta_tecnico", {
                    tecnico_id: editId,
                    meta_semanal: Number(dados.meta_semanal)
                });
            }

            alert("Usuário alterado com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao alterar usuário: " + e.message);
        }
    };

    const excluir = async () => {
        if (!editId) return alert("Selecione um usuário na tabela");
        if (editId === user.id) return alert("Você não pode excluir o seu próprio usuário conectado!");
        if (!window.confirm(`Confirma exclusão do usuário "${dados.nome}"?`)) return;

        try {
            // 1. Excluir dependências na tabela meta_tecnico
            try {
                await apiDelete(`/rest/v1/meta_tecnico?tecnico_id=eq.${editId}`);
            } catch (err) {
                console.log("Sem registro de meta para remover", err);
            }

            // 2. Excluir na tabela usuario
            await apiDelete(`/rest/v1/usuario?id=eq.${editId}`);

            alert("Usuário excluído com sucesso!");
            await carregar();
            limpar();
        } catch (e) {
            alert("Erro ao excluir usuário: " + e.message);
        }
    };

    const selecionar = (item) => {
        setDados({
            nome: item.nome,
            login: item.login,
            senha: item.senha || "",
            perfil: item.perfil,
            meta_semanal: String(item.meta_exibida),
            ativo: item.ativo,
        });
        setEditId(item.id);
    };

    return (
        <AppShell>
            <div style={{ margin: -16, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 56px)" }}>

                {/* ── Título ── */}
                <div style={s.titulo}>CADASTRO DE USUÁRIOS</div>

                {/* ── Corpo ── */}
                <div style={{ flex: 1, padding: "12px 16px 70px" }}>

                    {/* Fieldset Parâmetros */}
                    <fieldset style={s.fieldset}>
                        <legend style={s.legend}>Parâmetros do Usuário</legend>

                        <div style={s.grid2}>
                            <Campo label="Nome">
                                <input
                                    value={dados.nome}
                                    onChange={(e) => setDados({ ...dados, nome: e.target.value })}
                                    style={s.input}
                                    placeholder="Nome completo do usuário"
                                />
                            </Campo>

                            <Campo label="Login">
                                <input
                                    value={dados.login}
                                    onChange={(e) => setDados({ ...dados, login: e.target.value })}
                                    style={s.input}
                                    placeholder="Ex: joao"
                                />
                            </Campo>

                            <Campo label="Senha">
                                <input
                                    type="text"
                                    value={dados.senha}
                                    onChange={(e) => setDados({ ...dados, senha: e.target.value })}
                                    style={s.input}
                                    placeholder="Senha de acesso"
                                />
                            </Campo>

                            <Campo label="Perfil">
                                <select
                                    value={dados.perfil}
                                    onChange={(e) => setDados({ ...dados, perfil: e.target.value })}
                                    style={s.input}
                                >
                                    <option value="Tecnico">Técnico</option>
                                    <option value="Administrador">Administrador</option>
                                </select>
                            </Campo>

                            <Campo label="Meta Semanal (Telas)">
                                <input
                                    type="number"
                                    min="0"
                                    value={dados.meta_semanal}
                                    onChange={(e) => setDados({ ...dados, meta_semanal: e.target.value })}
                                    style={{ ...s.input, width: 100 }}
                                />
                            </Campo>

                            <Campo label="Ativo">
                                <select
                                    value={dados.ativo ? "Sim" : "Não"}
                                    onChange={(e) => setDados({ ...dados, ativo: e.target.value === "Sim" })}
                                    style={s.input}
                                >
                                    <option>Sim</option>
                                    <option>Não</option>
                                </select>
                            </Campo>
                        </div>
                    </fieldset>

                    {/* Fieldset Registros */}
                    <fieldset style={{ ...s.fieldset, marginTop: 12 }}>
                        <legend style={s.legend}>Usuários Cadastrados</legend>

                        <table style={s.table}>
                            <thead>
                                <tr>
                                    {["Nome", "Login", "Perfil", "Meta Semanal (Telas)", "Status"].map((h, i) => (
                                        <th key={h} style={{ ...s.th, textAlign: i === 0 ? "left" : "center" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {listaExibida.length === 0 && (
                                    <tr>
                                        <td colSpan={5} style={{ ...s.td, textAlign: "center", color: "#9ca3af", padding: 16 }}>
                                            Nenhum usuário cadastrado encontrado
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
                                        <td style={{ ...s.td, color: "#1d4ed8", fontWeight: 600 }}>{item.nome}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#374151" }}>{item.login}</td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#10b981", fontWeight: 600 }}>
                                            {item.perfil === "Tecnico" ? "👤 Técnico" : "👑 Administrador"}
                                        </td>
                                        <td style={{ ...s.td, textAlign: "center", color: "#4f46e5", fontWeight: 700 }}>
                                            {item.meta_exibida}
                                        </td>
                                        <td style={{ ...s.td, textAlign: "center" }}>
                                            <span style={{
                                                padding: "2px 8px",
                                                borderRadius: 6,
                                                fontSize: 10,
                                                fontWeight: 700,
                                                background: item.ativo ? "#d1fae5" : "#fee2e2",
                                                color: item.ativo ? "#065f46" : "#991b1b"
                                            }}>
                                                {item.ativo ? "ATIVO" : "INATIVO"}
                                            </span>
                                        </td>
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
