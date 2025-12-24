import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    XCircle,
    RotateCcw,
    PlusCircle,
    Edit,
    Trash2,
} from "lucide-react";
import AppShell from "../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";

/* ================= Helpers visuais ================= */
function Label({ children }) {
    return (
        <label className="text-[12px] text-gray-700 pr-2">
            {children}
        </label>
    );
}

function Txt(props) {
    return (
        <input
            {...props}
            className="border border-gray-300 rounded px-2 py-[3px] h-[28px]
      text-[13px] w-full focus:outline-none focus:ring-1 focus:ring-red-300"
        />
    );
}

function Sel({ children, ...rest }) {
    return (
        <select
            {...rest}
            className="border border-gray-300 rounded px-2 py-[3px] h-[28px]
      text-[13px] w-full focus:outline-none focus:ring-1 focus:ring-red-300"
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

    /* ================= Load ================= */
    async function carregar() {
        const data = await apiGet(
            "/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,modulo,qtd_campos,nivel_api&order=nome_tabela.asc"
        );
        setLista(data || []);
    }

    useEffect(() => {
        carregar();
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
    };

    const incluir = async () => {
        if (!dados.nome_tabela.trim())
            return alert("Informe a Tela");

        if (!dados.qtd_campos || Number(dados.qtd_campos) <= 0)
            return alert("Informe a quantidade de campos");

        const payload = {
            tela: dados.nome_tabela.trim(),
            nome_tabela: dados.nome_tabela.trim(),
            tipo_tabela: dados.tipo_tabela,
            qtd_campos: Number(dados.qtd_campos),
            modulo: dados.modulo,
        };

        await apiPost("/rest/v1/controle_api", payload);

        alert("Tela incluída com sucesso ✅");
        await carregar();
        limpar();
    };

    const alterar = async () => {
        if (!editId) return alert("Selecione um registro");

        await apiPatch(`/rest/v1/controle_api?id=eq.${editId}`, {
            tela: dados.nome_tabela.trim(),
            nome_tabela: dados.nome_tabela.trim(),
            tipo_tabela: dados.tipo_tabela,
            qtd_campos: Number(dados.qtd_campos),
            modulo: dados.modulo,
        });

        alert("Tela alterada com sucesso ✏️");
        await carregar();
        limpar();
    };

    const excluir = async () => {
        if (!editId) return alert("Selecione um registro");
        if (!window.confirm("Confirma exclusão da tela?")) return;

        await apiDelete(`/rest/v1/controle_api?id=eq.${editId}`);

        alert("Tela excluída com sucesso 🗑️");
        await carregar();
        limpar();
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
    };

    /* ================= Render ================= */
    return (
        <AppShell>
            <div className="mt-[44px] bg-gray-50 h-[calc(100vh-56px)] text-[13px]">

                {/* Título */}
                <h1 className="text-center text-red-700 font-semibold py-2 text-sm border-b border-gray-300">
                    CADASTRO DE TELAS
                </h1>

                {/* Conteúdo */}
                <div className="p-4 bg-white border-x border-b rounded-b-md flex flex-col gap-4">

                    {/* Abas */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAba("cadastro")}
                            className={`px-5 py-1 rounded border text-[12px] font-medium
                ${aba === "cadastro"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 hover:bg-gray-100"}`}
                        >
                            Cadastro
                        </button>

                        <button
                            onClick={() => setAba("consulta")}
                            className={`px-5 py-1 rounded border text-[12px] font-medium
                ${aba === "consulta"
                                    ? "bg-red-700 text-white border-red-700"
                                    : "bg-white text-gray-700 hover:bg-gray-100"}`}
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
                                    onChange={(e) =>
                                        setDados({ ...dados, nome_tabela: e.target.value })
                                    }
                                />

                                <Label className="col-span-2">Tipo</Label>
                                <Sel
                                    className="col-span-4"
                                    value={dados.tipo_tabela}
                                    onChange={(e) =>
                                        setDados({ ...dados, tipo_tabela: e.target.value })
                                    }
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
                                    onChange={(e) =>
                                        setDados({ ...dados, qtd_campos: e.target.value })
                                    }
                                />

                                <Label className="col-span-2">Módulo</Label>
                                <Sel
                                    className="col-span-6"
                                    value={dados.modulo}
                                    onChange={(e) =>
                                        setDados({ ...dados, modulo: e.target.value })
                                    }
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
                                                <td className="border px-2 py-1 text-center">
                                                    {item.qtd_campos}
                                                </td>
                                                <td className="border px-2 py-1 text-center">
                                                    {item.nivel_api}
                                                </td>
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
                        onClick={() => navigate(-1)}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700"
                    >
                        <XCircle size={18} />
                        <span>Fechar</span>
                    </button>

                    <button
                        onClick={limpar}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700"
                    >
                        <RotateCcw size={18} />
                        <span>Limpar</span>
                    </button>

                    <button
                        onClick={incluir}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700"
                    >
                        <PlusCircle size={18} />
                        <span>Incluir</span>
                    </button>

                    <button
                        onClick={alterar}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700"
                    >
                        <Edit size={18} />
                        <span>Alterar</span>
                    </button>

                    <button
                        onClick={excluir}
                        className="flex flex-col items-center text-[11px] text-gray-700 hover:text-red-700"
                    >
                        <Trash2 size={18} />
                        <span>Excluir</span>
                    </button>

                </div>
            </div>
        </AppShell>
    );
}
