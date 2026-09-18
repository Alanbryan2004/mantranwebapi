import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, apiPost, apiPatch, apiDelete } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import {
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  PlusCircle,
  Trash2,
  Edit3,
  AlertTriangle,
  RotateCcw,
  Search,
  User,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Copy,
  Check,
  Camera,
  Image as ImageIcon,
  Maximize2,
  X
} from "lucide-react";

// Função para processar e comprimir imagem do print
function processarImagem(file, callback) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      callback(dataUrl);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export default function QATestes() {
  const { user } = useAuth();

  const [telas, setTelas] = useState([]);
  const [cenarios, setCenarios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [tableMissing, setTableMissing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Filtros
  const [buscaTela, setBuscaTela] = useState("");
  const [buscaTecnico, setBuscaTecnico] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");

  // Tela selecionada / expandida
  const [telaExpandida, setTelaExpandida] = useState(null);

  // Modal de Adicionar/Editar Cenário
  const [modalCenario, setModalCenario] = useState(null); // { tela, cenarioId, titulo, descricao, tecnico_id, tecnico_nome }
  const [tituloCenario, setTituloCenario] = useState("");
  const [descricaoCenario, setDescricaoCenario] = useState("");
  const [salvandoCenario, setSalvandoCenario] = useState(false);

  // Modal de Registro de Erro pelo QA
  const [modalErro, setModalErro] = useState(null); // { cenario, erroTexto, imagem }
  const [textoErro, setTextoErro] = useState("");
  const [imagemErro, setImagemErro] = useState(null);
  const [salvandoErro, setSalvandoErro] = useState(false);

  // Modal de Visualização de Imagem em Tamanho Real (Lightbox)
  const [modalZoomImagem, setModalZoomImagem] = useState(null);

  // Escuta colar (Ctrl+V) global na tela quando o modal de erro estiver aberto
  useEffect(() => {
    if (!modalErro) return;

    const handleGlobalPaste = (e) => {
      const items = (e.clipboardData || window.clipboardData)?.items;
      if (items) {
        for (let item of items) {
          if (item.type && item.type.indexOf("image") === 0) {
            const file = item.getAsFile();
            processarImagem(file, (dataUrl) => {
              setImagemErro(dataUrl);
            });
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [modalErro]);

  async function colarDoClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageTypes = item.types.filter((type) => type.startsWith("image/"));
          if (imageTypes.length > 0) {
            const blob = await item.getType(imageTypes[0]);
            processarImagem(blob, (dataUrl) => {
              setImagemErro(dataUrl);
            });
            return;
          }
        }
        alert("Nenhuma imagem encontrada na área de transferência. Tire o print (PrintScreen ou Win+Shift+S) e tente novamente.");
      } else {
        alert("Pressione Ctrl+V no teclado para colar o print.");
      }
    } catch (err) {
      alert("Para colar, basta pressionar Ctrl+V no teclado.");
    }
  }

  async function carregar() {
    try {
      setErro("");
      setLoading(true);

      const [dataTarefas, dataUsuarios] = await Promise.all([
        apiGet(
          `/rest/v1/controle_api?select=id,tela,nome_tabela,tipo_tabela,nivel_api,modulo,tecnico_id,tecnico_nome,endpoints&status_api=eq.Finalizado&status_teste=eq.Finalizado&status_documentacao=eq.Finalizado`
        ),
        apiGet("/rest/v1/usuario?select=id,nome,login,perfil,e_tecnico,ativo&ativo=eq.true&order=nome.asc").catch(() => [])
      ]);

      // Buscar cenários de QA
      let dataCenarios = [];
      try {
        dataCenarios = await apiGet("/rest/v1/qa_cenarios?select=*&order=created_at.asc");
        setTableMissing(false);
      } catch (err) {
        console.warn("Tabela qa_cenarios ainda não existe no Supabase:", err);
        setTableMissing(true);
      }

      setUsuarios(dataUsuarios || []);
      setCenarios(dataCenarios || []);

      // Agrupa tarefas por Tela
      const mapaTelas = {};
      for (const t of dataTarefas || []) {
        const nomeTela = t.tela || t.nome_tabela;
        if (!mapaTelas[nomeTela]) {
          mapaTelas[nomeTela] = {
            tela: nomeTela,
            modulo: t.modulo || "Geral",
            tabelas: [],
            tecnico_id: t.tecnico_id,
            tecnico_nome: t.tecnico_nome,
            tecnicos: new Set(),
            endpoints: new Set()
          };
        }

        mapaTelas[nomeTela].tabelas.push(t);
        if (t.tecnico_nome) mapaTelas[nomeTela].tecnicos.add(t.tecnico_nome);
        if (t.tecnico_id && !mapaTelas[nomeTela].tecnico_id) mapaTelas[nomeTela].tecnico_id = t.tecnico_id;
        if (t.tecnico_nome && !mapaTelas[nomeTela].tecnico_nome) mapaTelas[nomeTela].tecnico_nome = t.tecnico_nome;

        if (Array.isArray(t.endpoints)) {
          t.endpoints.forEach((ep) => ep && ep.trim() && mapaTelas[nomeTela].endpoints.add(ep.trim()));
        }
      }

      const listaAgrupada = Object.values(mapaTelas).map((item) => ({
        ...item,
        tecnico: Array.from(item.tecnicos).join(", ") || item.tecnico_nome || "Sem Técnico",
        endpoints: Array.from(item.endpoints)
      }));

      setTelas(listaAgrupada);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // Calcular status consolidado de uma tela baseado nos seus cenários
  function calcularStatusTela(nomeTela) {
    const cenariosDaTela = (cenarios || []).filter((c) => c.tela === nomeTela);
    if (cenariosDaTela.length === 0) {
      return { status: "SEM_CENARIOS", label: "Sem Cenários", cor: "#6b7280", bg: "#f3f4f6", icon: HelpCircle };
    }

    const temErro = cenariosDaTela.some((c) => c.status === "ERRO");
    if (temErro) {
      return { status: "REPROVADO", label: "Reprovado", cor: "#dc2626", bg: "#fee2e2", icon: XCircle };
    }

    const todosOk = cenariosDaTela.every((c) => c.status === "OK");
    if (todosOk) {
      return { status: "APROVADO", label: "Aprovado (100% OK)", cor: "#16a34a", bg: "#dcfce7", icon: CheckCircle2 };
    }

    return { status: "PENDENTE", label: "Pendente / Em Teste", cor: "#2563eb", bg: "#dbeafe", icon: Clock };
  }

  // Estatísticas gerais
  const resumo = useMemo(() => {
    let aprovados = 0;
    let reprovados = 0;
    let pendentes = 0;
    let semCenarios = 0;

    for (const t of telas) {
      const { status } = calcularStatusTela(t.tela);
      if (status === "APROVADO") aprovados++;
      else if (status === "REPROVADO") reprovados++;
      else if (status === "PENDENTE") pendentes++;
      else semCenarios++;
    }

    return { total: telas.length, aprovados, reprovados, pendentes, semCenarios };
  }, [telas, cenarios]);

  // Lista filtrada
  const telasFiltradas = useMemo(() => {
    return telas.filter((t) => {
      const matchTela = t.tela.toLowerCase().includes(buscaTela.toLowerCase());
      const matchTecnico = buscaTecnico ? t.tecnico.toLowerCase().includes(buscaTecnico.toLowerCase()) : true;
      const { status } = calcularStatusTela(t.tela);
      const matchStatus = filtroStatus === "TODOS" || status === filtroStatus;
      return matchTela && matchTecnico && matchStatus;
    });
  }, [telas, cenarios, buscaTela, buscaTecnico, filtroStatus]);

  // Ações de Cenário
  function abrirModalNovoCenario(t) {
    setModalCenario({
      tela: t.tela,
      cenarioId: null,
      tecnico_id: t.tecnico_id,
      tecnico_nome: t.tecnico_nome || t.tecnico
    });
    setTituloCenario("");
    setDescricaoCenario("");
  }

  function abrirModalEditarCenario(c) {
    setModalCenario({
      tela: c.tela,
      cenarioId: c.id,
      tecnico_id: c.tecnico_id,
      tecnico_nome: c.tecnico_nome
    });
    setTituloCenario(c.titulo || "");
    setDescricaoCenario(c.descricao || "");
  }

  async function salvarCenario() {
    if (!tituloCenario.trim()) {
      alert("Por favor, informe o título ou o que será testado.");
      return;
    }

    setSalvandoCenario(true);
    try {
      if (modalCenario.cenarioId) {
        // Editar
        await apiPatch(`/rest/v1/qa_cenarios?id=eq.${modalCenario.cenarioId}`, {
          titulo: tituloCenario.trim(),
          descricao: descricaoCenario.trim(),
          updated_at: new Date().toISOString()
        });
      } else {
        // Criar
        await apiPost("/rest/v1/qa_cenarios", {
          tela: modalCenario.tela,
          titulo: tituloCenario.trim(),
          descricao: descricaoCenario.trim(),
          status: "PENDENTE",
          tecnico_id: modalCenario.tecnico_id || null,
          tecnico_nome: modalCenario.tecnico_nome || null,
          qa_id: user?.id || null,
          qa_nome: user?.nome || user?.login || "QA"
        });
      }

      setModalCenario(null);
      await carregar();
    } catch (e) {
      alert("Erro ao salvar cenário: " + (e.message || String(e)));
    } finally {
      setSalvandoCenario(false);
    }
  }

  async function excluirCenario(id) {
    if (!window.confirm("Deseja realmente excluir este cenário de teste?")) return;
    try {
      await apiDelete(`/rest/v1/qa_cenarios?id=eq.${id}`);
      await carregar();
    } catch (e) {
      alert("Erro ao excluir cenário: " + (e.message || String(e)));
    }
  }

  async function mudarStatusCenario(cenario, novoStatus) {
    if (novoStatus === "ERRO") {
      setModalErro({ cenario, erroTexto: cenario.observacao_erro || "", imagem: cenario.evidencia_imagem || null });
      setTextoErro(cenario.observacao_erro || "");
      setImagemErro(cenario.evidencia_imagem || null);
      return;
    }

    try {
      await apiPatch(`/rest/v1/qa_cenarios?id=eq.${cenario.id}`, {
        status: novoStatus,
        qa_id: user?.id || null,
        qa_nome: user?.nome || user?.login || "QA",
        updated_at: new Date().toISOString()
      });
      await carregar();
    } catch (e) {
      alert("Erro ao atualizar status: " + (e.message || String(e)));
    }
  }

  async function confirmarErro() {
    if (!textoErro.trim()) {
      alert("Por favor, descreva o erro encontrado para que o técnico possa corrigir.");
      return;
    }

    setSalvandoErro(true);
    try {
      await apiPatch(`/rest/v1/qa_cenarios?id=eq.${modalErro.cenario.id}`, {
        status: "ERRO",
        observacao_erro: textoErro.trim(),
        evidencia_imagem: imagemErro || null,
        qa_id: user?.id || null,
        qa_nome: user?.nome || user?.login || "QA",
        updated_at: new Date().toISOString()
      });
      setModalErro(null);
      setImagemErro(null);
      await carregar();
    } catch (e) {
      alert("Erro ao registrar erro: " + (e.message || String(e)));
    } finally {
      setSalvandoErro(false);
    }
  }

  function copiarSqlScript() {
    const sql = `-- EXECUTE ESTE SCRIPT NO SUPABASE SQL EDITOR
CREATE TABLE IF NOT EXISTS public.qa_cenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tela TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE',
    observacao_erro TEXT,
    observacao_correcao TEXT,
    tecnico_id UUID,
    tecnico_nome TEXT,
    qa_id UUID,
    qa_nome TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_cenarios_tela ON public.qa_cenarios(tela);
CREATE INDEX IF NOT EXISTS idx_qa_cenarios_tecnico_id ON public.qa_cenarios(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_qa_cenarios_status ON public.qa_cenarios(status);

ALTER TABLE public.qa_cenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on qa_cenarios" ON public.qa_cenarios;
CREATE POLICY "Allow anon all on qa_cenarios" ON public.qa_cenarios FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.qa_cenarios TO anon;
GRANT ALL ON TABLE public.qa_cenarios TO authenticated;
GRANT ALL ON TABLE public.qa_cenarios TO service_role;`;

    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  }

  return (
    <AppShell title="QA Testes">
      <div style={styles.container}>
        {/* TÍTULO */}
        <div style={styles.headerTitleRow}>
          <div>
            <h1 style={styles.headerTitle}>PROCESSO DE QA & VALIDAÇÃO DE TELAS</h1>
            <p style={styles.headerSubtitle}>
              Gestão de testes funcionais e regras de negócio para homologação de telas finalizadas.
            </p>
          </div>
        </div>

        {/* ALERTA SE TABELA ESTIVER AUSENTE */}
        {tableMissing && (
          <div style={styles.tableWarning}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <AlertTriangle size={24} color="#b45309" />
              <div>
                <strong style={{ color: "#92400e" }}>Tabela `qa_cenarios` não encontrada no Supabase.</strong>
                <div style={{ fontSize: 12, color: "#78350f" }}>
                  Para salvar e persistir os testes de QA, execute o script SQL de criação no SQL Editor do seu Supabase.
                </div>
              </div>
            </div>
            <button onClick={copiarSqlScript} style={styles.btnCopySql}>
              {copiedSql ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
              {copiedSql ? "Script Copiado!" : "Copiar Script SQL"}
            </button>
          </div>
        )}

        {loading && <div style={styles.loading}>Carregando telas e cenários de QA...</div>}
        {erro && <div style={styles.err}>{erro}</div>}

        {!loading && (
          <>
            {/* CARDS DE RESUMO */}
            <div style={styles.gridStats}>
              <div style={{ ...styles.statCard, borderLeft: "4px solid #6b7280" }}>
                <div style={styles.statLabel}>Telas Finalizadas</div>
                <div style={styles.statValue}>{resumo.total}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: "4px solid #16a34a" }}>
                <div style={styles.statLabel}>Aprovadas (100% OK)</div>
                <div style={{ ...styles.statValue, color: "#16a34a" }}>{resumo.aprovados}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: "4px solid #dc2626" }}>
                <div style={styles.statLabel}>Reprovadas (Com Erro)</div>
                <div style={{ ...styles.statValue, color: "#dc2626" }}>{resumo.reprovados}</div>
              </div>
              <div style={{ ...styles.statCard, borderLeft: "4px solid #2563eb" }}>
                <div style={styles.statLabel}>Em Teste / Pendentes</div>
                <div style={{ ...styles.statValue, color: "#2563eb" }}>{resumo.pendentes}</div>
              </div>
            </div>

            {/* BARRA DE FILTROS */}
            <div style={styles.filterBar}>
              <div style={styles.filterGroup}>
                <Search size={16} color="#6b7280" />
                <input
                  placeholder="Buscar por Tela..."
                  value={buscaTela}
                  onChange={(e) => setBuscaTela(e.target.value)}
                  style={styles.inputSearch}
                />
              </div>

              <div style={styles.filterGroup}>
                <User size={16} color="#6b7280" />
                <select
                  value={buscaTecnico}
                  onChange={(e) => setBuscaTecnico(e.target.value)}
                  style={styles.selectFilter}
                >
                  <option value="">Todos os Técnicos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.nome}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.filterGroup}>
                <ShieldCheck size={16} color="#6b7280" />
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  style={styles.selectFilter}
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="APROVADO">Aprovado (100% OK)</option>
                  <option value="REPROVADO">Reprovado (Com Erro)</option>
                  <option value="PENDENTE">Pendente / Em Teste</option>
                  <option value="SEM_CENARIOS">Sem Cenários</option>
                </select>
              </div>

              {(buscaTela || buscaTecnico || filtroStatus !== "TODOS") && (
                <button
                  onClick={() => {
                    setBuscaTela("");
                    setBuscaTecnico("");
                    setFiltroStatus("TODOS");
                  }}
                  style={styles.clearBtn}
                >
                  Limpar Filtros
                </button>
              )}
            </div>

            {/* LISTAGEM DE TELAS */}
            <div style={styles.screenList}>
              {telasFiltradas.length === 0 ? (
                <div style={styles.empty}>Nenhuma tela encontrada para os filtros aplicados.</div>
              ) : (
                telasFiltradas.map((t) => {
                  const infoStatus = calcularStatusTela(t.tela);
                  const IconStatus = infoStatus.icon;
                  const cenariosDaTela = cenarios.filter((c) => c.tela === t.tela);
                  const isExpandido = telaExpandida === t.tela;

                  const totalCenarios = cenariosDaTela.length;
                  const totalOk = cenariosDaTela.filter((c) => c.status === "OK").length;
                  const totalErro = cenariosDaTela.filter((c) => c.status === "ERRO").length;
                  const totalPendente = cenariosDaTela.filter((c) => c.status === "PENDENTE").length;

                  return (
                    <div key={t.tela} style={styles.screenCard}>
                      {/* CABEÇALHO DO CARD DA TELA */}
                      <div
                        style={styles.screenHeader}
                        onClick={() => setTelaExpandida(isExpandido ? null : t.tela)}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <span style={styles.screenTitle}>{t.tela}</span>
                            <span style={styles.moduleTag}>{t.modulo}</span>
                            <div
                              style={{
                                ...styles.statusBadge,
                                background: infoStatus.bg,
                                color: infoStatus.cor,
                                borderColor: infoStatus.cor
                              }}
                            >
                              <IconStatus size={14} />
                              {infoStatus.label}
                            </div>
                          </div>
                          <div style={styles.screenMeta}>
                            <span>
                              👤 Desenvolvido por: <strong>{t.tecnico}</strong>
                            </span>
                            <span>•</span>
                            <span>
                              📋 Tabelas: <strong>{t.tabelas.length}</strong>
                            </span>
                            {t.endpoints.length > 0 && (
                              <>
                                <span>•</span>
                                <span>
                                  🔗 Endpoints: <strong>{t.endpoints.length}</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* RESUMO DE CENÁRIOS E BOTÃO EXPANDIR */}
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          {totalCenarios > 0 && (
                            <div style={styles.countersBox}>
                              <span style={{ color: "#16a34a", fontWeight: 700 }}>{totalOk} OK</span>
                              <span style={{ color: "#6b7280" }}>•</span>
                              <span style={{ color: "#dc2626", fontWeight: 700 }}>{totalErro} Erro</span>
                              <span style={{ color: "#6b7280" }}>•</span>
                              <span style={{ color: "#2563eb", fontWeight: 700 }}>{totalPendente} Pend</span>
                            </div>
                          )}
                          <button style={styles.btnExpand}>
                            {isExpandido ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO - CENÁRIOS DE TESTE */}
                      {isExpandido && (
                        <div style={styles.screenBody}>
                          <div style={styles.bodyTopRow}>
                            <div>
                              <h3 style={styles.cenariosTitle}>
                                Cenários de Teste & Regras de Negócio ({totalCenarios})
                              </h3>
                              <p style={styles.cenariosSub}>
                                Cada cenário deve cobrir um caso de uso ou regra de negócio da tela.
                              </p>
                            </div>
                            <button
                              onClick={() => abrirModalNovoCenario(t)}
                              style={styles.btnAddCenario}
                            >
                              <PlusCircle size={16} />
                              Adicionar Cenário de Teste
                            </button>
                          </div>

                          {cenariosDaTela.length === 0 ? (
                            <div style={styles.emptyCenarios}>
                              <HelpCircle size={32} color="#9ca3af" />
                              <div>Nenhum cenário de teste cadastrado para esta tela ainda.</div>
                              <button
                                onClick={() => abrirModalNovoCenario(t)}
                                style={styles.btnStartTesting}
                              >
                                ✍️ Definir o que será testado antes de Iniciar
                              </button>
                            </div>
                          ) : (
                            <div style={styles.cenariosList}>
                              {cenariosDaTela.map((c, idx) => {
                                const isOk = c.status === "OK";
                                const isErro = c.status === "ERRO";
                                const isPendente = c.status === "PENDENTE";

                                return (
                                  <div
                                    key={c.id}
                                    style={{
                                      ...styles.cenarioCard,
                                      borderLeft: isErro
                                        ? "4px solid #dc2626"
                                        : isOk
                                        ? "4px solid #16a34a"
                                        : "4px solid #2563eb"
                                    }}
                                  >
                                    <div style={styles.cenarioMain}>
                                      <div style={{ flex: 1 }}>
                                        <div style={styles.cenarioHeader}>
                                          <span style={styles.cenarioIndex}>#{idx + 1}</span>
                                          <strong style={styles.cenarioTitulo}>{c.titulo}</strong>
                                        </div>
                                        {c.descricao && (
                                          <div style={styles.cenarioDesc}>{c.descricao}</div>
                                        )}

                                        {/* EXIBIÇÃO DE ERRO APONTADO PELO QA */}
                                        {c.observacao_erro && (
                                          <div style={styles.erroBox}>
                                            <div style={styles.erroBoxTitle}>
                                              <AlertTriangle size={14} /> Detalhe do Erro Apontado pelo QA ({c.qa_nome || "QA"}):
                                            </div>
                                            <div style={styles.erroBoxContent}>{c.observacao_erro}</div>

                                            {/* PRINT ANEXADO */}
                                            {c.evidencia_imagem && (
                                              <div style={styles.printPreviewWrap}>
                                                <div style={styles.printHeader}>
                                                  <Camera size={13} color="#b91c1c" />
                                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b" }}>Print / Evidência do Erro:</span>
                                                  <button
                                                    type="button"
                                                    style={styles.btnVerPrint}
                                                    onClick={() => setModalZoomImagem(c.evidencia_imagem)}
                                                  >
                                                    <Maximize2 size={12} /> Ampliar Print
                                                  </button>
                                                </div>
                                                <img
                                                  src={c.evidencia_imagem}
                                                  alt="Evidência do Erro"
                                                  style={styles.printThumb}
                                                  onClick={() => setModalZoomImagem(c.evidencia_imagem)}
                                                  title="Clique para visualizar em tamanho real"
                                                />
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* EXIBIÇÃO DE CORREÇÃO DO TÉCNICO */}
                                        {c.observacao_correcao && (
                                          <div style={styles.correcaoBox}>
                                            <div style={styles.correcaoBoxTitle}>
                                              <MessageSquare size={14} /> Retorno / Correção do Técnico ({c.tecnico_nome || "Técnico"}):
                                            </div>
                                            <div style={styles.correcaoBoxContent}>
                                              {c.observacao_correcao}
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {/* BOTÕES DE STATUS E AÇÕES */}
                                      <div style={styles.cenarioActions}>
                                        <div style={styles.statusButtonsGroup}>
                                          <button
                                            onClick={() => mudarStatusCenario(c, "PENDENTE")}
                                            style={{
                                              ...styles.btnStatusOpt,
                                              background: isPendente ? "#dbeafe" : "#f3f4f6",
                                              color: isPendente ? "#1d4ed8" : "#4b5563",
                                              borderColor: isPendente ? "#93c5fd" : "#d1d5db",
                                              fontWeight: isPendente ? 800 : 500
                                            }}
                                          >
                                            <Clock size={14} /> PENDENTE
                                          </button>
                                          <button
                                            onClick={() => mudarStatusCenario(c, "OK")}
                                            style={{
                                              ...styles.btnStatusOpt,
                                              background: isOk ? "#dcfce7" : "#f3f4f6",
                                              color: isOk ? "#15803d" : "#4b5563",
                                              borderColor: isOk ? "#86efac" : "#d1d5db",
                                              fontWeight: isOk ? 800 : 500
                                            }}
                                          >
                                            <CheckCircle2 size={14} /> OK
                                          </button>
                                          <button
                                            onClick={() => mudarStatusCenario(c, "ERRO")}
                                            style={{
                                              ...styles.btnStatusOpt,
                                              background: isErro ? "#fee2e2" : "#f3f4f6",
                                              color: isErro ? "#b91c1c" : "#4b5563",
                                              borderColor: isErro ? "#fca5a5" : "#d1d5db",
                                              fontWeight: isErro ? 800 : 500
                                            }}
                                          >
                                            <XCircle size={14} /> ERRO
                                          </button>
                                        </div>

                                        <div style={{ display: "flex", gap: 6 }}>
                                          <button
                                            onClick={() => abrirModalEditarCenario(c)}
                                            style={styles.btnIconAction}
                                            title="Editar Cenário"
                                          >
                                            <Edit3 size={15} color="#4b5563" />
                                          </button>
                                          <button
                                            onClick={() => excluirCenario(c.id)}
                                            style={styles.btnIconActionDanger}
                                            title="Excluir Cenário"
                                          >
                                            <Trash2 size={15} color="#dc2626" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* MODAL ADICIONAR / EDITAR CENÁRIO */}
        {modalCenario && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalCard}>
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>
                  {modalCenario.cenarioId ? "Editar Cenário de Teste" : "Novo Cenário de Teste"}
                </h3>
                <span style={styles.modalSubHeader}>Tela: <strong>{modalCenario.tela}</strong></span>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    O que será testado? (Título / Objetivo) <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    style={styles.inputModal}
                    placeholder="Ex: Validar salvamento de cliente com CNPJ duplicado"
                    value={tituloCenario}
                    onChange={(e) => setTituloCenario(e.target.value)}
                    autoFocus
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    Regra de Negócio / Detalhes do Teste (Opcional)
                  </label>
                  <textarea
                    style={styles.textareaModal}
                    placeholder="Ex: Passos: 1. Acessar tela; 2. Preencher formulário com CNPJ já cadastrado; 3. Clicar em Salvar. Resultado esperado: Deve exibir alerta de duplicidade impedindo a gravação."
                    value={descricaoCenario}
                    onChange={(e) => setDescricaoCenario(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={styles.btnModalCancel}
                  onClick={() => setModalCenario(null)}
                  disabled={salvandoCenario}
                >
                  Cancelar
                </button>
                <button
                  style={styles.btnModalSave}
                  onClick={salvarCenario}
                  disabled={salvandoCenario}
                >
                  {salvandoCenario ? "Salvando..." : "Salvar Cenário"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL REGISTRAR ERRO PELO QA */}
        {modalErro && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalCard, maxWidth: 560 }}>
              <div style={{ ...styles.modalHeader, borderBottomColor: "#fee2e2" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#dc2626" }}>
                  <AlertTriangle size={20} />
                  <h3 style={{ ...styles.modalTitle, color: "#991b1b" }}>
                    Apontar Erro / Falha de QA
                  </h3>
                </div>
                <span style={styles.modalSubHeader}>
                  Cenário: <strong>{modalErro.cenario.titulo}</strong>
                </span>
              </div>

              <div style={styles.modalBody}>
                <p style={{ fontSize: 13, color: "#4b5563", margin: 0 }}>
                  Ao marcar como <strong>ERRO</strong>, esta tela será automaticamente marcada como{" "}
                  <strong style={{ color: "#dc2626" }}>Reprovada</strong> e retornará para a fila de{" "}
                  <strong>Minhas Tarefas</strong> do técnico responsável (
                  <strong>{modalErro.cenario.tecnico_nome || "Técnico"}</strong>).
                </p>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    Descrição detalhada do erro encontrado: <span style={{ color: "red" }}>*</span>
                  </label>
                  <textarea
                    style={{ ...styles.textareaModal, borderColor: "#fca5a5" }}
                    placeholder="Ex: Ao clicar no botão Salvar com os campos obrigatórios preenchidos, a requisição retornou status 500 no endpoint /rest/v1/cliente e não gravou o registro. Dica: você pode colar um print aqui direto usando Ctrl+V!"
                    value={textoErro}
                    onChange={(e) => setTextoErro(e.target.value)}
                    onPaste={(e) => {
                      const items = (e.clipboardData || window.clipboardData)?.items;
                      if (items) {
                        for (let item of items) {
                          if (item.type.indexOf("image") === 0) {
                            const file = item.getAsFile();
                            processarImagem(file, (dataUrl) => {
                              setImagemErro(dataUrl);
                            });
                            break;
                          }
                        }
                      }
                    }}
                    rows={4}
                    autoFocus
                  />
                </div>

                {/* ANEXO DE PRINT DO ERRO */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>
                    📸 Print / Evidência Visual do Erro (PrintScreen / Captura de Tela)
                  </label>
                  
                  {imagemErro ? (
                    <div style={styles.imageUploadedCard}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <img
                          src={imagemErro}
                          alt="Print do Erro"
                          style={styles.imageUploadedThumb}
                          onClick={() => setModalZoomImagem(imagemErro)}
                          title="Clique para ampliar"
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#16a34a" }}>
                            ✅ Print colado / anexado com sucesso!
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>
                            O técnico verá esta captura em Minhas Tarefas para agilizar a correção.
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          style={styles.btnVerPrintMini}
                          onClick={() => setModalZoomImagem(imagemErro)}
                        >
                          <Maximize2 size={13} /> Visualizar
                        </button>
                        <button
                          type="button"
                          style={styles.btnRemoveImg}
                          onClick={() => setImagemErro(null)}
                        >
                          <X size={13} /> Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={styles.uploadContainer}>
                      <div style={styles.pasteHintBox}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 18 }}>💡</span>
                          <span style={{ fontSize: 12, color: "#374151" }}>
                            Tirou print da tela com <strong>PrintScreen</strong> ou <strong>Win + Shift + S</strong>? Basta pressionar <strong>Ctrl + V</strong> agora!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={colarDoClipboard}
                          style={styles.btnColarClipboard}
                        >
                          📋 Colar Print (Ctrl+V)
                        </button>
                      </div>

                      <div style={styles.uploadArea}>
                        <input
                          type="file"
                          id="file-print-qa"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              processarImagem(file, (dataUrl) => {
                                setImagemErro(dataUrl);
                              });
                            }
                          }}
                        />
                        <label htmlFor="file-print-qa" style={styles.uploadBtnLabel}>
                          <Camera size={16} color="#6b7280" />
                          <span>Ou clique aqui para selecionar um arquivo de imagem do computador</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  style={styles.btnModalCancel}
                  onClick={() => {
                    setModalErro(null);
                    setImagemErro(null);
                  }}
                  disabled={salvandoErro}
                >
                  Cancelar
                </button>
                <button
                  style={{ ...styles.btnModalSave, background: "#dc2626" }}
                  onClick={confirmarErro}
                  disabled={salvandoErro}
                >
                  {salvandoErro ? "Salvando..." : "Confirmar e Reprovar Tela"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE LIGHTBOX / ZOOM DE IMAGEM */}
        {modalZoomImagem && (
          <div style={styles.lightboxOverlay} onClick={() => setModalZoomImagem(null)}>
            <div style={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
              <div style={styles.lightboxHeader}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                  <ImageIcon size={16} /> Print / Evidência do Erro
                </span>
                <button style={styles.btnLightboxClose} onClick={() => setModalZoomImagem(null)}>
                  <X size={20} color="#fff" />
                </button>
              </div>
              <div style={styles.lightboxImgWrap}>
                <img src={modalZoomImagem} alt="Print Ampliado" style={styles.lightboxImage} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 16
  },
  headerTitleRow: {
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 12,
    marginBottom: 4
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#b91c1c",
    margin: 0,
    letterSpacing: "0.02em"
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    margin: "4px 0 0 0"
  },
  tableWarning: {
    background: "#fef3c7",
    border: "1px solid #fde68a",
    borderRadius: 10,
    padding: "12px 16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap"
  },
  btnCopySql: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#fff",
    border: "1px solid #d97706",
    color: "#92400e",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  loading: {
    textAlign: "center",
    padding: 30,
    color: "#6b7280"
  },
  err: {
    background: "#fee2e2",
    color: "#991b1b",
    padding: 12,
    borderRadius: 8,
    fontSize: 13
  },
  gridStats: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 12
  },
  statCard: {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    padding: "12px 16px",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase"
  },
  statValue: {
    fontSize: 22,
    fontWeight: 900,
    color: "#111827",
    marginTop: 4
  },
  filterBar: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    padding: "12px 16px",
    display: "flex",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap"
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "6px 10px",
    background: "#fff",
    flex: "1 1 200px"
  },
  inputSearch: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: 13
  },
  selectFilter: {
    border: "none",
    outline: "none",
    width: "100%",
    fontSize: 13,
    background: "transparent",
    cursor: "pointer"
  },
  clearBtn: {
    background: "#f3f4f6",
    border: "1px solid #d1d5db",
    color: "#4b5563",
    borderRadius: 8,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer"
  },
  screenList: {
    display: "flex",
    flexDirection: "column",
    gap: 12
  },
  empty: {
    background: "#fff",
    padding: 30,
    borderRadius: 10,
    textAlign: "center",
    color: "#6b7280",
    border: "1px solid #e5e7eb"
  },
  screenCard: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    overflow: "hidden",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
  },
  screenHeader: {
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    background: "#ffffff",
    transition: "background 0.2s"
  },
  screenTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#111827"
  },
  moduleTag: {
    fontSize: 11,
    background: "#f1f5f9",
    color: "#475569",
    padding: "2px 8px",
    borderRadius: 6,
    fontWeight: 600
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    border: "1px solid"
  },
  screenMeta: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center"
  },
  countersBox: {
    fontSize: 12,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    padding: "4px 10px",
    borderRadius: 8,
    display: "flex",
    gap: 6
  },
  btnExpand: {
    background: "transparent",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center"
  },
  screenBody: {
    borderTop: "1px solid #f1f5f9",
    padding: "16px 18px",
    background: "#fafafa"
  },
  bodyTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8
  },
  cenariosTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#1e293b",
    margin: 0
  },
  cenariosSub: {
    fontSize: 12,
    color: "#64748b",
    margin: "2px 0 0 0"
  },
  btnAddCenario: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "#b91c1c",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer"
  },
  emptyCenarios: {
    background: "#fff",
    border: "1px dashed #cbd5e1",
    borderRadius: 10,
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    color: "#64748b",
    fontSize: 13
  },
  btnStartTesting: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 4
  },
  cenariosList: {
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  cenarioCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    padding: "12px 14px",
    boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.03)"
  },
  cenarioMain: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap"
  },
  cenarioHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  cenarioIndex: {
    fontSize: 11,
    fontWeight: 800,
    color: "#94a3b8",
    background: "#f1f5f9",
    padding: "2px 6px",
    borderRadius: 4
  },
  cenarioTitulo: {
    fontSize: 14,
    color: "#0f172a"
  },
  cenarioDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap"
  },
  erroBox: {
    marginTop: 8,
    background: "#fef2f2",
    border: "1px solid #fee2e2",
    borderRadius: 6,
    padding: "8px 10px"
  },
  erroBoxTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  erroBoxContent: {
    fontSize: 12,
    color: "#991b1b",
    marginTop: 3,
    whiteSpace: "pre-wrap"
  },
  correcaoBox: {
    marginTop: 8,
    background: "#f0fdf4",
    border: "1px solid #dcfce7",
    borderRadius: 6,
    padding: "8px 10px"
  },
  correcaoBoxTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#15803d",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  correcaoBoxContent: {
    fontSize: 12,
    color: "#166534",
    marginTop: 3,
    whiteSpace: "pre-wrap"
  },
  cenarioActions: {
    display: "flex",
    alignItems: "center",
    gap: 10
  },
  statusButtonsGroup: {
    display: "flex",
    border: "1px solid #e2e8f0",
    borderRadius: 8,
    overflow: "hidden"
  },
  btnStatusOpt: {
    border: "none",
    borderRight: "1px solid #e2e8f0",
    padding: "6px 10px",
    fontSize: 11,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
    transition: "all 0.15s"
  },
  btnIconAction: {
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    padding: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  btnIconActionDanger: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 6,
    padding: 6,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  /* MODAL */
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.45)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    padding: 16
  },
  modalCard: {
    background: "#fff",
    borderRadius: 14,
    width: "100%",
    maxWidth: 560,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  modalHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid #e2e8f0"
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0
  },
  modalSubHeader: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    display: "block"
  },
  modalBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 14
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: 700,
    color: "#334155"
  },
  inputModal: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none"
  },
  textareaModal: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 13,
    outline: "none",
    resize: "vertical"
  },
  modalFooter: {
    padding: "14px 20px",
    borderTop: "1px solid #f1f5f9",
    background: "#f8fafc",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10
  },
  btnModalCancel: {
    background: "#fff",
    border: "1px solid #cbd5e1",
    color: "#475569",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer"
  },
  btnModalSave: {
    background: "#b91c1c",
    border: "none",
    color: "#fff",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer"
  },

  /* ESTILOS DE PRINT / EVIDÊNCIA */
  printPreviewWrap: {
    marginTop: 8,
    padding: "8px 10px",
    background: "#fff",
    border: "1px solid #fecaca",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 6
  },
  printHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6
  },
  btnVerPrint: {
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    color: "#b91c1c",
    borderRadius: 6,
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  printThumb: {
    maxHeight: 140,
    maxWidth: 240,
    objectFit: "contain",
    borderRadius: 6,
    border: "1px solid #e2e8f0",
    cursor: "pointer",
    transition: "transform 0.2s",
    background: "#f8fafc"
  },
  imageUploadedCard: {
    padding: "8px 12px",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  imageUploadedThumb: {
    width: 48,
    height: 48,
    objectFit: "cover",
    borderRadius: 6,
    border: "1px solid #86efac",
    cursor: "pointer"
  },
  btnRemoveImg: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    color: "#dc2626",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  uploadContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 8
  },
  pasteHintBox: {
    background: "#fffbeb",
    border: "1px solid #fde68a",
    borderRadius: 8,
    padding: "8px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8
  },
  btnColarClipboard: {
    background: "#b91c1c",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  btnVerPrintMini: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4
  },
  uploadArea: {
    border: "2px dashed #cbd5e1",
    borderRadius: 8,
    padding: "10px",
    textAlign: "center",
    background: "#f8fafc",
    cursor: "pointer",
    transition: "all 0.2s"
  },
  uploadBtnLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: "#475569",
    fontSize: 12,
    cursor: "pointer"
  },
  lightboxOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.85)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    padding: 20
  },
  lightboxContent: {
    maxWidth: "90vw",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    gap: 10
  },
  lightboxHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  btnLightboxClose: {
    background: "rgba(255, 255, 255, 0.2)",
    border: "none",
    borderRadius: "50%",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer"
  },
  lightboxImgWrap: {
    overflow: "auto",
    maxHeight: "82vh",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.2)",
    background: "#0f172a",
    display: "flex",
    justifyContent: "center"
  },
  lightboxImage: {
    maxWidth: "100%",
    maxHeight: "80vh",
    objectFit: "contain",
    borderRadius: 6
  }
};
