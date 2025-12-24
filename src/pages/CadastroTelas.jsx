// src/pages/CadastroTelas.jsx
import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

// ---------- helpers ----------
function camelToSnakeUpper(name = "") {
    // "ContasPagar" -> "CONTAS_PAGAR"
    // "CTePage" -> "CTE_PAGE"
    const cleaned = String(name || "")
        .replace(/\.(jsx|tsx|js|ts)$/i, "")
        .trim();

    if (!cleaned) return "";

    // Se já vier em snake, só upper
    if (cleaned.includes("_")) return cleaned.toUpperCase();

    // Insere underscore antes de maiúsculas (exceto primeira)
    const snake = cleaned
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2");

    return snake.toUpperCase();
}

function containsCI(hay, needle) {
    return String(hay || "").toLowerCase().includes(String(needle || "").toLowerCase());
}

const MODULOS = ["Operacao", "Financeiro", "WMS", "Seguranca", "Oficina"];
const TIPOS = ["Cadastro", "Documento"];

export default function CadastroTelas() {
    const { user } = useAuth();

    // ---------- abas ----------
    const [aba, setAba] = useState("cadastro"); // "cadastro" | "consulta"

    // ---------- form ----------
    const [form, setForm] = useState({
        id: null,
        nome_tabela: "",
        tipo_tabela: "Cadastro",
        qtd_campos: "",
        modulo: "Operacao",
    });

    const [busy, setBusy] = useState(false);
    const [erro, setErro] = useState("");

    // ---------- consulta ----------
    const [lista, setLista] = useState([]);
    const [loadingLista, setLoadingLista] = useState(true);

    const [q, setQ] = useState("");
    const [fModulo, setFModulo] = useState("Todos");

    const total = lista.length;

    const filtrada = useMemo(() => {
        let arr = [...lista];

        if (fModulo !== "Todos") {
            arr = arr.filter((r) => String(r.modulo || "") === fModulo);
        }

        if (q.trim()) {
            arr = arr.filter((r) => {
                return (
                    containsCI(r.nome_tabela, q) ||
                    containsCI(r.tipo_tabela, q) ||
                    containsCI(r.modulo, q)
                );
            });
        }

        return arr;
    }, [lista, q, fModulo]);

    // ---------- carregar lista ----------
    async function carregarLista() {
        setLoadingLista(true);
        setErro("");
        try {
            // Ajuste o select conforme quiser mostrar na grid
            const rows = await apiGet(
                `/rest/v1/controle_api?select=id,nome_tabela,tipo_tabela,modulo,qtd_campos,nivel_api,peso_api,created_at,updated_at&order=nome_tabela.asc`
            );

            setLista(Array.isArray(rows) ? rows : []);
        } catch (e) {
            setErro(e?.message || "Erro ao carregar telas.");
            setLista([]);
        } finally {
            setLoadingLista(false);
        }
    }

    useEffect(() => {
        carregarLista();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---------- ações ----------
    function limparFormulario() {
        setForm({
            id: null,
            nome_tabela: "",
            tipo_tabela: "Cadastro",
            qtd_campos: "",
            modulo: "Operacao",
        });
        setErro("");
    }

    function carregarNoCadastro(row) {
        setForm({
            id: row.id,
            nome_tabela: row.nome_tabela || "",
            tipo_tabela: row.tipo_tabela || "Cadastro",
            qtd_campos: row.qtd_campos ?? "",
            modulo: row.modulo || "Operacao",
        });
        setAba("cadastro");
        setErro("");
    }

    async function incluir() {
        setErro("");

        const nome = camelToSnakeUpper(form.nome_tabela);
        const qtd = Number(form.qtd_campos);

        if (!nome) return setErro("Informe o Nome da Tela.");
        if (!form.tipo_tabela) return setErro("Informe o Tipo.");
        if (!form.modulo) return setErro("Informe o Módulo.");
        if (!Number.isFinite(qtd) || qtd <= 0) return setErro("Informe um Tamanho (qtd_campos) válido (> 0).");
        if (!user?.id) return setErro("Usuário não identificado (user.id). Faça login novamente.");

        setBusy(true);
        try {
            // não enviar nivel_api/peso_api (trigger calcula)
            const payload = {
                nome_tabela: nome,
                tipo_tabela: form.tipo_tabela,
                qtd_campos: qtd,
                modulo: form.modulo,
                usuario_id: user.id,
            };

            // Supabase: para retornar o registro, o helper deve usar Prefer: return=representation
            const inserted = await apiPost(`/rest/v1/controle_api`, payload, {
                headers: { Prefer: "return=representation" },
            });

            // apiPost pode retornar objeto ou array; normaliza
            const reg = Array.isArray(inserted) ? inserted[0] : inserted;

            // atualiza lista (recarrega para pegar nível/peso da trigger)
            await carregarLista();

            // carrega no cadastro já em modo edição
            if (reg?.id) {
                const row = lista.find((x) => x.id === reg.id) || reg;
                carregarNoCadastro(row);
            } else {
                limparFormulario();
            }
        } catch (e) {
            setErro(e?.message || "Erro ao incluir.");
        } finally {
            setBusy(false);
        }
    }

    async function alterar() {
        setErro("");

        if (!form.id) return setErro("Nenhum registro selecionado para alterar.");

        const nome = camelToSnakeUpper(form.nome_tabela);
        const qtd = Number(form.qtd_campos);

        if (!nome) return setErro("Informe o Nome da Tela.");
        if (!form.tipo_tabela) return setErro("Informe o Tipo.");
        if (!form.modulo) return setErro("Informe o Módulo.");
        if (!Number.isFinite(qtd) || qtd <= 0) return setErro("Informe um Tamanho (qtd_campos) válido (> 0).");
        if (!user?.id) return setErro("Usuário não identificado (user.id). Faça login novamente.");

        setBusy(true);
        try {
            const payload = {
                nome_tabela: nome,
                tipo_tabela: form.tipo_tabela,
                qtd_campos: qtd,
                modulo: form.modulo,
                usuario_id: user.id,
            };

            await apiPatch(`/rest/v1/controle_api?id=eq.${form.id}`, payload, {
                headers: { Prefer: "return=representation" },
            });

            await carregarLista();

            // re-seleciona o registro atualizado (para refletir trigger)
            const atualizado = (await apiGet(
                `/rest/v1/controle_api?select=id,nome_tabela,tipo_tabela,modulo,qtd_campos,nivel_api,peso_api,created_at,updated_at&id=eq.${form.id}`
            ))?.[0];

            if (atualizado) carregarNoCadastro(atualizado);
        } catch (e) {
            setErro(e?.message || "Erro ao alterar.");
        } finally {
            setBusy(false);
        }
    }

    async function excluir() {
        setErro("");
        if (!form.id) return setErro("Nenhum registro selecionado para excluir.");

        const ok = window.confirm(
            `Confirma excluir a tela "${form.nome_tabela}"?\n\nEssa exclusão é definitiva.`
        );
        if (!ok) return;

        setBusy(true);
        try {
            await apiDelete(`/rest/v1/controle_api?id=eq.${form.id}`);
            await carregarLista();
            limparFormulario();
            setAba("consulta");
        } catch (e) {
            setErro(e?.message || "Erro ao excluir.");
        } finally {
            setBusy(false);
        }
    }

    // ---------- UI ----------
    return (
        <AppShell>
            <main className="flex-1 min-h-[calc(100vh-48px)] p-4 overflow-auto">
                {/* Cabeçalho */}
                <div className="flex items-center justify-between mb-3">
                    <h1 className="text-[16px] font-semibold text-gray-800">
                        Cadastro de Telas
                    </h1>

                    {/* Abas */}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setAba("cadastro")}
                            className={`px-3 py-1.5 rounded border text-[12px] ${aba === "cadastro"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            Aba 1 - Cadastro
                        </button>

                        <button
                            type="button"
                            onClick={() => setAba("consulta")}
                            className={`px-3 py-1.5 rounded border text-[12px] ${aba === "consulta"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            Aba 2 - Consulta
                        </button>
                    </div>
                </div>

                {erro ? (
                    <div className="mb-3 p-2 rounded border border-red-200 bg-red-50 text-[12px] text-red-700">
                        {erro}
                    </div>
                ) : null}

                {/* ===== ABA CADASTRO ===== */}
                {aba === "cadastro" && (
                    <section className="bg-white rounded border border-gray-200 p-3">
                        <fieldset className="border border-gray-200 rounded p-3">
                            <legend className="px-2 text-[12px] font-semibold text-red-700">
                                Dados da Tela
                            </legend>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                {/* Nome da Tela */}
                                <label className="col-span-2 text-right text-[12px] text-gray-700">
                                    Nome da Tela
                                </label>
                                <input
                                    className="col-span-4 border border-gray-300 rounded px-2 py-1 text-[12px] uppercase"
                                    value={form.nome_tabela}
                                    onChange={(e) =>
                                        setForm((s) => ({ ...s, nome_tabela: e.target.value }))
                                    }
                                    onBlur={() =>
                                        setForm((s) => ({
                                            ...s,
                                            nome_tabela: camelToSnakeUpper(s.nome_tabela),
                                        }))
                                    }
                                    placeholder="Ex: ContasPagar"
                                />

                                {/* Tipo */}
                                <label className="col-span-2 text-right text-[12px] text-gray-700">
                                    Tipo
                                </label>
                                <select
                                    className="col-span-4 border border-gray-300 rounded px-2 py-1 text-[12px]"
                                    value={form.tipo_tabela}
                                    onChange={(e) =>
                                        setForm((s) => ({ ...s, tipo_tabela: e.target.value }))
                                    }
                                >
                                    {TIPOS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>

                                {/* Tamanho */}
                                <label className="col-span-2 text-right text-[12px] text-gray-700">
                                    Tamanho
                                </label>
                                <input
                                    className="col-span-2 border border-gray-300 rounded px-2 py-1 text-[12px] text-center"
                                    value={form.qtd_campos}
                                    onChange={(e) =>
                                        setForm((s) => ({
                                            ...s,
                                            qtd_campos: e.target.value.replace(/[^\d]/g, ""),
                                        }))
                                    }
                                    placeholder="qtd_campos"
                                />

                                {/* Módulo */}
                                <label className="col-span-2 text-right text-[12px] text-gray-700">
                                    Módulo
                                </label>
                                <select
                                    className="col-span-6 border border-gray-300 rounded px-2 py-1 text-[12px]"
                                    value={form.modulo}
                                    onChange={(e) =>
                                        setForm((s) => ({ ...s, modulo: e.target.value }))
                                    }
                                >
                                    {MODULOS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>

                                {/* ID (somente leitura) */}
                                <label className="col-span-2 text-right text-[12px] text-gray-500">
                                    ID
                                </label>
                                <input
                                    className="col-span-10 border border-gray-200 rounded px-2 py-1 text-[12px] bg-gray-50 text-gray-600"
                                    value={form.id || ""}
                                    readOnly
                                    placeholder="(gerado pelo banco)"
                                />
                            </div>
                        </fieldset>

                        {/* Ações */}
                        <div className="flex items-center gap-2 mt-3">
                            {!form.id ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={incluir}
                                    className="px-3 py-2 rounded bg-green-700 text-white text-[12px] hover:bg-green-800 disabled:opacity-60"
                                >
                                    Incluir
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={alterar}
                                        className="px-3 py-2 rounded bg-blue-700 text-white text-[12px] hover:bg-blue-800 disabled:opacity-60"
                                    >
                                        Alterar
                                    </button>

                                    <button
                                        type="button"
                                        disabled={busy}
                                        onClick={excluir}
                                        className="px-3 py-2 rounded bg-red-700 text-white text-[12px] hover:bg-red-800 disabled:opacity-60"
                                    >
                                        Excluir
                                    </button>
                                </>
                            )}

                            <button
                                type="button"
                                disabled={busy}
                                onClick={limparFormulario}
                                className="px-3 py-2 rounded bg-gray-200 text-gray-800 text-[12px] hover:bg-gray-300 disabled:opacity-60"
                            >
                                Limpar
                            </button>

                            <div className="ml-auto text-[12px] text-gray-600">
                                {busy ? "Processando..." : null}
                            </div>
                        </div>

                        {/* Dica rápida */}
                        <div className="mt-2 text-[11px] text-gray-500">
                            Obs: <b>nível</b> e <b>peso</b> são calculados automaticamente pela trigger com base em <b>qtd_campos</b>.
                        </div>
                    </section>
                )}

                {/* ===== ABA CONSULTA ===== */}
                {aba === "consulta" && (
                    <section className="bg-white rounded border border-gray-200 p-3">
                        {/* filtros */}
                        <fieldset className="border border-gray-200 rounded p-3">
                            <legend className="px-2 text-[12px] font-semibold text-red-700">
                                Consulta
                            </legend>

                            <div className="grid grid-cols-12 gap-2 items-center">
                                <label className="col-span-2 text-right text-[12px] text-gray-700">
                                    Pesquisa
                                </label>
                                <input
                                    className="col-span-6 border border-gray-300 rounded px-2 py-1 text-[12px]"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                    placeholder="Digite para filtrar (Nome/Tipo/Módulo)"
                                />

                                <label className="col-span-1 text-right text-[12px] text-gray-700">
                                    Módulo
                                </label>
                                <select
                                    className="col-span-3 border border-gray-300 rounded px-2 py-1 text-[12px]"
                                    value={fModulo}
                                    onChange={(e) => setFModulo(e.target.value)}
                                >
                                    <option value="Todos">Todos</option>
                                    {MODULOS.map((m) => (
                                        <option key={m} value={m}>
                                            {m}
                                        </option>
                                    ))}
                                </select>

                                <div className="col-span-12 flex items-center justify-between mt-1">
                                    <button
                                        type="button"
                                        onClick={carregarLista}
                                        disabled={loadingLista}
                                        className="px-3 py-2 rounded bg-gray-200 text-gray-800 text-[12px] hover:bg-gray-300 disabled:opacity-60"
                                    >
                                        Recarregar
                                    </button>

                                    <div className="text-[12px] text-gray-600">
                                        {loadingLista ? "Carregando..." : `Exibindo ${filtrada.length} de ${total} registros`}
                                    </div>
                                </div>
                            </div>
                        </fieldset>

                        {/* grid */}
                        <div className="mt-3 border border-gray-200 rounded overflow-auto">
                            <table className="min-w-full text-[12px]">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr className="text-gray-700">
                                        <th className="p-2 text-left border-b">Nome da Tela</th>
                                        <th className="p-2 text-left border-b">Tipo</th>
                                        <th className="p-2 text-left border-b">Módulo</th>
                                        <th className="p-2 text-center border-b">Tamanho</th>
                                        <th className="p-2 text-center border-b">Nível</th>
                                        <th className="p-2 text-center border-b">Peso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingLista ? (
                                        <tr>
                                            <td className="p-3 text-gray-500" colSpan={6}>
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : filtrada.length === 0 ? (
                                        <tr>
                                            <td className="p-3 text-gray-500" colSpan={6}>
                                                Nenhum registro encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        filtrada.map((r) => (
                                            <tr
                                                key={r.id}
                                                className="hover:bg-red-50 cursor-pointer"
                                                onClick={() => carregarNoCadastro(r)}
                                                title="Clique para abrir no Cadastro"
                                            >
                                                <td className="p-2 border-b">{r.nome_tabela}</td>
                                                <td className="p-2 border-b">{r.tipo_tabela}</td>
                                                <td className="p-2 border-b">{r.modulo}</td>
                                                <td className="p-2 border-b text-center">{r.qtd_campos ?? ""}</td>
                                                <td className="p-2 border-b text-center">{r.nivel_api ?? ""}</td>
                                                <td className="p-2 border-b text-center">{r.peso_api ?? ""}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-2 text-[11px] text-gray-500">
                            Dica: clique em qualquer linha para abrir na <b>Aba 1 - Cadastro</b> e fazer alteração ou exclusão.
                        </div>
                    </section>
                )}
            </main>
        </AppShell>
    );
}
