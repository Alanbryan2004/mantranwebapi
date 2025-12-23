import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet } from "../services/api";

export default function Finalizadas() {
  const [rows, setRows] = useState([]);
  const [mediaHoras, setMediaHoras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setErro("");
        setLoading(true);

        // 1️⃣ Tarefas finalizadas
        const tarefas = await apiGet(
          `/rest/v1/controle_api` +
            `?select=id,nome_tabela,tela,tecnico_nome` +
            `&status_api=eq.OK` +
            `&status_teste=eq.OK` +
            `&status_documentacao=eq.OK`
        );

        // 2️⃣ Média de horas por tela
        const media = await apiGet(
          `/rest/v1/vw_media_horas_por_tela?select=media_horas_por_tela&limit=1`
        );

        if (!ativo) return;

        setRows(tarefas || []);
        setMediaHoras(media?.[0]?.media_horas_por_tela || 0);
      } catch (e) {
        if (ativo) setErro(e.message || String(e));
      } finally {
        if (ativo) setLoading(false);
      }
    }

    carregar();
    return () => (ativo = false);
  }, []);

  return (
    <AppShell title="Finalizadas">
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <>
          {/* 🔢 CARDS */}
          <div style={styles.grid}>
            <Card title="Total Finalizadas" value={rows.length} />
            <Card
              title="Média de Horas por Tela"
              value={`${mediaHoras.toFixed(2)} h`}
            />
          </div>

          {/* 📋 LISTA */}
          <div style={styles.list}>
            {rows.map((r) => (
              <div key={r.id} style={styles.row}>
                <div>
                  <strong>{r.nome_tabela}</strong>
                  <div style={styles.sub}>
                    Tela: {r.tela} • Técnico: {r.tecnico_nome}
                  </div>
                </div>
              </div>
            ))}

            {rows.length === 0 && (
              <div style={styles.empty}>Nenhuma tarefa finalizada</div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function Card({ title, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div style={styles.cardValue}>{value}</div>
    </div>
  );
}

const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900 },
  list: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 12,
  },
  row: {
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
  },
  sub: { fontSize: 12, color: "#6b7280" },
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
};
