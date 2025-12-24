import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { XCircle, RotateCcw, PlusCircle, Edit, Trash2 } from "lucide-react";
import AppShell from "../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

/* ================= Helpers visuais ================= */
function Label({ children, className = "" }) {
    return <label className={`text-[12px] text-gray-700 pr-2 ${className}`}>{children}</label>;
}

function Txt({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-300 rounded px-2 py-[3px] h-[28px]
      text-[13px] w-full focus:outline-none focus:ring-1 focus:ring-red-300 ${className}`}
        />
    );
}

function Sel({ children, className = "", ...rest }) {
    return (
        <select
            {...rest}
            className={`border border-gray-300 rounded px-2 py-[3px] h-[28px]
      text-[13px] w-full focus:outline-none focus:ring-1 focus:ring-red-300 ${className}`}
        >
            {children}
        </select>
    );
}

/* ================= Componente ================= */
export default function CadastroTelas() {
    const navigate = useNavigate();

    const [aba, setAba] = useState("cadastro");
    const [lista, setLista] = useState([]);
    const [editId, setEditId] = useState(null);

    const [dados, setDados] = useState({
        nome_tabela: "",
        tipo_tabela: "Cadastro",
        qtd_campos: "",
        modulo: "Operacao",
    });

    // Mensagens e busy (pra você VER o que acontece)
    const [msg, setMsg] = useState({ tipo: "", texto: "" }); // tipo: ok | err | info
    const [busy, setBusy] = useState(false);

    function showInfo(texto) {
        setMsg({ tipo: "info", texto });
    }
    function showOk(texto) {
        setMsg({ tipo: "ok", texto });
    }
    function showErr(texto) {
        setMsg({ tipo: "err", texto });
    }

    /* ================= Load ================= */
    async function carregar() {
        try {
            showInfo("Carregando lista...");
            const data = await apiGet(
                "/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,modulo,qtd_campos,nivel_api&order=nome_tabela.asc"
            );
            setLista(data || []);
            setMsg({ tipo: "", texto: "" });
        } catch (e) {
            showErr(e?.message || String(e));
        }
    }

    useEffect(() => {
        carregar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ================= Ações ================= */
    const limpar = () => {
        setDados({
            nome_tabela: "",
            tipo_tabela: "Cadastro",
            qtd_campos: "",
            modulo: "Operacao",
        });
        setEditId(null);
        setMsg({ tipo: "", texto: "" });
    };

    const incluir = async () => {
        // Debug visual
        showInfo("Salvando...");

        const nome = (dados.nome_tabela || "").trim();
        if (!nome) {
            showErr("Informe a Tela.");
            return;
        }

        const qtd = Number(dados.qtd_campos);
        if (!qtd || qtd <= 0) {
            showErr("Informe a quantidade de campos.");
            return;
        }

        const payload = {
            tela: nome,
            nome_tabela: nome,
            tipo_tabela: dados.tipo_tabela,
            qtd_campos: qtd,
            modulo: dados.modulo,

            // ✅ status correto ao criar
            status_api: "Pendente",
            status_teste: "Pendente",
            status_documentacao: "Pendente",

            // ✅ garante pendência real
            tecnico_id: null,
            tecnico_nome: null,
            data_inicio: null,
            data_fim_prevista: null,
        };

        try {
            setBusy(true);

            // Se o apiPost der erro, agora aparece na tela
            await apiPost("/rest/v1/controle_api", payload);

            showOk("Tela incluída com sucesso ✅");
            await carregar();
            limpar();
        } catch (e) {
            showErr(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    };

    const alterar = async () => {
        if (!editId) return showErr("Selecione um registro.");

        try {
            setBusy(true);
            showInfo("Salvando alteração...");

            await apiPatch(`/rest/v1/controle_api?id=eq.${editId}`, {
                tela: (dados.nome_tabela || "").trim(),
                nome_tabela: (dados.nome_tabela || "").trim(),
                tipo_tabela: dados.tipo_tabela,
                qtd_campos: Number(dados.qtd_campos),
                modulo: dados.modulo,
            });

            showOk("Tela alterada com sucesso ✏️");
            await carregar();
            limpar();
        } catch (e) {
            showErr(e?.message || String(e));
        } finally {
            setBusy(false);
        }
    };

    const excluir = async () => {
        if (!editId) return showErr("Selecione um registro.");
        if (!window.confirm("Confirma exclusão da tela?")) return;

        try {
            setBusy(true);
            showInfo("Excluindo...");

            await apiDelete(`/rest/v1/controle_api?id=eq.${editId}`);

            showOk("Tela excluída com sucesso 🗑️");
            await carregar();
            limpar();
        } catch (e) {
            showErr(e?.message || String(e));
        } finally {
            setBusy(false);
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
        setAba("cadastro");
        setMsg({ tipo: "", texto: "" });
    };

    // Estilo simples da “caixa de mensagem”
    const msgStyle =
        msg.tipo === "ok"
            ? "bg-green-50 border-green-200 text-green-700"
            : msg.tipo === "err"
                ? "bg-red-50 border-red-200 text-red-700"
                : msg.tipo === "info"
                    ? "bg-gray-50 border-gray-200 text-gray-700"
                    : "";

    /* ================= Render ================= */
    return (
        <AppShell>
            <div className="mt-[44px] bg-gray-50 h-[calc(100vh-56px)] text-[13px]">
                {/* Título */}
                <h1 className="text-center text-red-700 font-semibold py-2 text-sm border-b border-gray-300">
                    CADASTRO DE TELAS
                </h1>

                {/* Mensagem (agora você SEMPRE vê o que está acontecendo) */}
                {msg.texto ? (
                    <div className={`mx-4 mt-3 border rounded px-3 py-2 text-[12px] ${msgStyle}`}>
                        {msg.texto}
                    </div>
                ) : null}

                {/* Conteúdo */}
                <div className="p-4 bg-white border-x border-b rounded-b-md flex flex-col gap-4">
                    {/* Abas */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAba("cadastro");
                            }}
                            className={`px-5 py-1 rounded border text-[12px] font-medium
              ${aba === "cadastro"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            Cadastro
                        </button>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setAba("consulta");
                            }}
                            className={`px-5 py-1 rounded border text-[12px] font-medium
              ${aba === "consulta"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            Consulta
                        </button>
                    </div>

                    {/* ================= CADASTRO ================= */}
                    {aba === "cadastro" && (
                        <fieldset className="border border-gray-300 rounded p-5">
                            <legend className="px-3 text-red-700 font-semibold text-[13px]">
                                Dados da Tela
                            </legend>

                            {/* Linha 1 */}
                            <div className="grid grid-cols-12 gap-6 mb-4 items-center">
                                <Label className="col-span-2">Tela</Label>
                                <Txt
                                    className="col-span-4"
                                    value={dados.nome_tabela}
                                    onChange={(e) => setDados({ ...dados, nome_tabela: e.target.value })}
                                />

                                <Label className="col-span-2">Tipo</Label>
                                <Sel
                                    className="col-span-4"
                                    value={dados.tipo_tabela}
                                    onChange={(e) => setDados({ ...dados, tipo_tabela: e.target.value })}
                                >
                                    <option>Cadastro</option>
                                    <option>Documento</option>
                                </Sel>
                            </div>

                            {/* Linha 2 */}
                            <div className="grid grid-cols-12 gap-6 items-center">
                                <Label className="col-span-2">Qtd. Campos</Label>
                                <Txt
                                    className="col-span-2 text-center"
                                    value={dados.qtd_campos}
                                    onChange={(e) => setDados({ ...dados, qtd_campos: e.target.value })}
                                />

                                <Label className="col-span-2">Módulo</Label>
                                <Sel
                                    className="col-span-6"
                                    value={dados.modulo}
                                    onChange={(e) => setDados({ ...dados, modulo: e.target.value })}
                                >
                                    <option>Operacao</option>
                                    <option>Financeiro</option>
                                    <option>WMS</option>
                                    <option>Seguranca</option>
                                    <option>Oficina</option>
                                </Sel>
                            </div>
                        </fieldset>
                    )}

                    {/* ================= CONSULTA ================= */}
                    {aba === "consulta" && (
                        <fieldset className="border border-gray-300 rounded p-4">
                            <legend className="px-3 text-red-700 font-semibold text-[13px]">
                                Telas Cadastradas
                            </legend>

                            <div className="border border-gray-300 rounded overflow-auto">
                                <table className="w-full text-[12px]">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="border px-2 py-1">Tela</th>
                                            <th className="border px-2 py-1">Tipo</th>
                                            <th className="border px-2 py-1">Módulo</th>
                                            <th className="border px-2 py-1">Qtd</th>
                                            <th className="border px-2 py-1">Nível</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lista.map((item) => (
                                            <tr
                                                key={item.id}
                                                onClick={() => selecionar(item)}
                                                className="cursor-pointer hover:bg-red-50"
                                            >
                                                <td className="border px-2 py-1">{item.tela}</td>
                                                <td className="border px-2 py-1">{item.tipo_tabela}</td>
                                                <td className="border px-2 py-1">{item.modulo}</td>
                                                <td className="border px-2 py-1 text-center">{item.qtd_campos}</td>
                                                <td className="border px-2 py-1 text-center">{item.nivel_api}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="text-[11px] text-gray-500 mt-1">
                                Exibindo {lista.length} registros
                            </div>
                        </fieldset>
                    )}
                </div>

                {/* ================= Rodapé ================= */}
                <div className="border-t border-gray-300 bg-white py-2 px-4 flex gap-8">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            navigate(-1);
                        }}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700 disabled:opacity-50"
                    >
                        <XCircle size={18} />
                        <span>Fechar</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            limpar();
                        }}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700 disabled:opacity-50"
                    >
                        <RotateCcw size={18} />
                        <span>Limpar</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            incluir();
                        }}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700 disabled:opacity-50"
                    >
                        <PlusCircle size={18} />
                        <span>{busy ? "Aguarde..." : "Incluir"}</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            alterar();
                        }}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700 disabled:opacity-50"
                    >
                        <Edit size={18} />
                        <span>Alterar</span>
                    </button>

                    <button
                        type="button"
                        disabled={busy}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            excluir();
                        }}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700 disabled:opacity-50"
                    >
                        <Trash2 size={18} />
                        <span>Excluir</span>
                    </button>
                </div>
            </div>
        </AppShell>
    );
}
