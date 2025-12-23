import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet, apiPatch } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const TIPOS = ["Cadastro", "Documento"];
const NIVEIS = ["Facil", "Medio", "Dificil", "Senior"];

export default function Pendentes() {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  // filtros
  const [tipo, setTipo] = useState("");
  const [nivel, setNivel] = useState("");
  const [minCampos, setMinCampos] = useState("");
  const [maxCampos, setMaxCampos] = useState("");

  // ordenação
  const [orderBy, setOrderBy] = useState("qtd_campos");
  const [orderDir, setOrderDir] = useState("asc");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tela, setTela] = useState("");
  const [saving, setSaving] = useState(false);

  function montarQuery() {
    let q =
      `/rest/v1/controle_api` +
      `?select=id,nome_tabela,tipo_tabela,nivel_api,qtd_campos,modulo,created_at` +
      `&tecnico_id=is.null` +
      `&status_api=eq.Pendente`;

    if (tipo) q += `&tipo_tabela=eq.${tipo}`;
    if (nivel) q += `&nivel_api=eq.${nivel}`;
    if (minCampos) q += `&qtd_campos=gte.${minCampos}`;
    if (maxCampos) q += `&qtd_campos=lte.${maxCampos}`;

    q += `&order=${orderBy}.${orderDir}`;

    return q;
  }

  async function carregar() {
    try {
      setErro("");
      setLoading(true);
      const data = await apiGet(montarQuery());
      setRows(data || []);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirModal(row) {
    setSelected(row);
    setTela("");
    setModalOpen(true);
  }

  async function confirmar() {
    if (!tela.trim()) {
      alert("Informe o nome da Tela.");
      return;
    }

    try {
      setSaving(true);

      const res = await apiPatch(
        `/rest/v1/controle_api?id=eq.${selected.id}&tecnico_id=is.null`,
        {
          tecnico_id: user.id,
          tecnico_nome: user.nome,
          tela: tela.trim(),
          status_api: "Trabalhando",
          data_inicio: new Date().toISOString(),
        }
      );

      if (!res || res.length === 0) {
        alert("Essa tarefa já foi assumida por outro técnico.");
        return;
      }

      setModalOpen(false);
      setSelected(null);
      carregar();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Pendentes">
      {/* FILTROS */}
      <div style={styles.filters}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={styles.input}>
          <option value="">Tipo (Todos)</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select value={nivel} onChange={(e) => setNivel(e.target.value)} style={styles.input}>
          <option value="">Nível (Todos)</option>
          {NIVEIS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <input
          placeholder="Campos mín"
          type="number"
          value={minCampos}
          onChange={(e) => setMinCampos(e.target.value)}
          style={styles.input}
        />

        <input
          placeholder="Campos máx"
          type="number"
          value={maxCampos}
          onChange={(e) => setMaxCampos(e.target.value)}
          style={styles.input}
        />

        <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)} style={styles.input}>
          <option value="tipo_tabela">Ordenar por Tipo</option>
          <option value="nivel_api">Ordenar por Nível</option>
          <option value="qtd_campos">Ordenar por Campos</option>
        </select>

        <select value={orderDir} onChange={(e) => setOrderDir(e.target.value)} style={styles.input}>
          <option value="asc">Crescente</option>
          <option value="desc">Decrescente</option>
        </select>

        <button style={styles.filterBtn} onClick={carregar}>
          Aplicar
        </button>
      </div>

      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <div style={styles.list}>
          {rows.length === 0 && (
            <div style={styles.empty}>Nenhuma tarefa pendente 🎉</div>
          )}

          {rows.map((r) => (
            <div key={r.id} style={styles.card}>
              <div style={styles.title}>{r.nome_tabela}</div>

              <div style={styles.meta}>
                <span>Tipo: {r.tipo_tabela}</span>
                <span>Nível: {r.nivel_api}</span>
                <span>Campos: {r.qtd_campos}</span>
                <span>Módulo: {r.modulo}</span>
              </div>

              <button style={styles.btn} onClick={() => abrirModal(r)}>
                Assumir tarefa
              </button>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {modalOpen && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3>Assumir Tarefa</h3>

            <div style={{ marginBottom: 8 }}>
              <strong>Tabela:</strong> {selected?.nome_tabela}
            </div>

            <label style={styles.label}>
              Tela vinculada *
              <input
                style={styles.input}
                value={tela}
                onChange={(e) => setTela(e.target.value)}
                placeholder="Ex: Cadastro de Agregados"
              />
            </label>

            <div style={styles.actions}>
              <button onClick={() => setModalOpen(false)} disabled={saving}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={saving} style={styles.confirm}>
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const styles = {
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
    marginBottom: 14,
  },
  input: {
    padding: 8,
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 13,
  },
  filterBtn: {
    background: "#111827",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  list: { display: "grid", gap: 12 },
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
  },
  title: { fontSize: 16, fontWeight: 800, marginBottom: 6 },
  meta: {
    display: "flex",
    gap: 14,
    fontSize: 13,
    color: "#374151",
    flexWrap: "wrap",
    marginBottom: 10,
  },
  btn: {
    background: "#16a34a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontWeight: 600,
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
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
  },
  modal: {
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    width: 420,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    fontSize: 13,
    marginBottom: 12,
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
  },
  confirm: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
  },
};
