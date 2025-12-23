import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "Administrador";

  const [rows, setRows] = useState([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ok = true;

    (async () => {
      try {
        setErro("");
        setLoading(true);

        let filtro = "";
        if (!isAdmin) {
          // Técnico vê apenas as tarefas dele
          filtro = `&tecnico_id=eq.${user.id}`;
        }

        const data = await apiGet(
          `/rest/v1/controle_api?select=id,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,modulo${filtro}`
        );

        if (ok) setRows(data || []);
      } catch (e) {
        if (ok) setErro(String(e.message || e));
      } finally {
        if (ok) setLoading(false);
      }
    })();

    return () => {
      ok = false;
    };
  }, [isAdmin, user?.id]);

  const resumo = useMemo(() => {
    const total = rows.length;

    const pendentes = rows.filter((r) => r.status_api === "Pendente").length;
    const trabalhando = rows.filter((r) => r.status_api === "Trabalhando").length;

    const ok = rows.filter(
      (r) =>
        r.status_api === "OK" &&
        r.status_teste === "OK" &&
        r.status_documentacao === "OK"
    ).length;

    const porTecnico = {};
    if (isAdmin) {
      for (const r of rows) {
        const key = r.tecnico_nome || "Sem Técnico";
        porTecnico[key] ||= { total: 0, pendentes: 0, trabalhando: 0, ok: 0 };
        porTecnico[key].total += 1;

        if (r.status_api === "Pendente") porTecnico[key].pendentes += 1;
        else if (r.status_api === "Trabalhando") porTecnico[key].trabalhando += 1;

        if (
          r.status_api === "OK" &&
          r.status_teste === "OK" &&
          r.status_documentacao === "OK"
        )
          porTecnico[key].ok += 1;
      }
    }

    return { total, pendentes, trabalhando, ok, porTecnico };
  }, [rows, isAdmin]);

  return (
    <AppShell title="Dashboard">
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <>
          <div style={styles.grid}>
            <Card title="Total" value={resumo.total} />
            <Card title="Pendentes" value={resumo.pendentes} />
            <Card title="Trabalhando" value={resumo.trabalhando} />
            <Card title="Concluídas (OK)" value={resumo.ok} />
          </div>

          {isAdmin && (
            <>
              <h3 style={styles.h3}>Por Técnico</h3>
              <div style={styles.list}>
                {Object.entries(resumo.porTecnico)
                  .filter(([k]) => k !== "Sem Técnico")
                  .map(([nome, v]) => (
                    <div key={nome} style={styles.row}>
                      <div style={{ fontWeight: 800 }}>{nome}</div>
                      <div style={styles.badges}>
                        <Badge label={`Total: ${v.total}`} />
                        <Badge label={`Trabalhando: ${v.trabalhando}`} />
                        <Badge label={`OK: ${v.ok}`} />
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
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

function Badge({ label }) {
  return <span style={styles.badge}>{label}</span>;
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 },
  card: { background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 14 },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: { fontSize: 26, fontWeight: 900, color: "#111827", marginTop: 6 },
  h3: { marginTop: 18, marginBottom: 10 },
  list: { background: "#fff", border: "1px solid #eee", borderRadius: 14, padding: 10 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
  },
  badges: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  badge: {
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: 999,
    padding: "6px 10px",
  },
  err: {
    marginTop: 10,
    background: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: 12,
    padding: 10,
  },
};
