import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet } from "../services/api";

export default function Finalizadas() {
  const [telas, setTelas] = useState([]);
  const [mediaHoras, setMediaHoras] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      try {
        setErro("");
        setLoading(true);

        const tarefas = await apiGet(
          `/rest/v1/controle_api` +
            `?select=id,tela,nome_tabela` +
            `&status_api=eq.Finalizado` +
            `&status_teste=eq.Finalizado` +
            `&status_documentacao=eq.Finalizado`
        );

        const horas = await apiGet(
          `/rest/v1/apontamento_tempo` +
            `?select=controle_api_id,inicio,fim` +
            `&fim=not.is.null`
        );

        if (!ativo) return;

        const mapa = {};

        for (const t of tarefas || []) {
          if (!mapa[t.tela]) {
            mapa[t.tela] = {
              tela: t.tela,
              tabelas: [],
              horas: 0,
            };
          }

          mapa[t.tela].tabelas.push(t.nome_tabela);

          const horasTabela = (horas || []).filter(
            (h) => h.controle_api_id === t.id
          );

          for (const h of horasTabela) {
            const inicio = new Date(h.inicio);
            const fim = new Date(h.fim);
            mapa[t.tela].horas += (fim - inicio) / 36e5;
          }
        }

        const lista = Object.values(mapa);
        const totalHoras = lista.reduce((s, t) => s + t.horas, 0);
        const media = lista.length ? totalHoras / lista.length : 0;

        setTelas(lista);
        setMediaHoras(media);
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
          {/* 🔢 CARDS TOPO */}
          <div style={styles.grid}>
            <Card
              title="Total de Telas Finalizadas"
              value={telas.length}
            />
            <Card
              title="Média de Horas por Tela"
              value={`${mediaHoras.toFixed(2)} h`}
            />
          </div>

          {/* 🔴 FIELDSETS POR TELA */}
          <div style={styles.wrapper}>
            {telas.map((t) => (
              <fieldset key={t.tela} style={styles.fieldset}>
                <legend style={styles.legend}>{t.tela}</legend>

                <div style={styles.innerCard}>
                  ⏱️ Horas totais:{" "}
                  <strong>{t.horas.toFixed(1)} h</strong>
                </div>

                <ul style={styles.ul}>
                  {t.tabelas.map((tb, i) => (
                    <li key={i}>{tb}</li>
                  ))}
                </ul>
              </fieldset>
            ))}

            {telas.length === 0 && (
              <div style={styles.empty}>
                Nenhuma tela finalizada
              </div>
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
    gap: 16,
    marginBottom: 24,
  },

  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 16,
  },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900 },

  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  fieldset: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: "14px 16px 16px",
    background: "#fff",
  },

  legend: {
    padding: "0 8px",
    fontWeight: 800,
    color: "#b91c1c", // vermelho-700
    fontSize: 14,
  },

  innerCard: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 10,
    padding: "10px 12px",
    marginBottom: 10,
    fontSize: 13,
  },

  ul: {
    paddingLeft: 18,
    fontSize: 13,
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
};
