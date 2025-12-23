import { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { apiGet } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

const META_SEMANAL_TELAS = 5;

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.perfil === "Administrador";

  const [rows, setRows] = useState([]);
  const [produtividadeHoras, setProdutividadeHoras] = useState([]);
  const [produtividadeTelas, setProdutividadeTelas] = useState([]);
const [idsEmAndamento, setIdsEmAndamento] = useState([]);

  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(true);
const HORAS_POR_TELA = 8;
const HORAS_POR_DIA = 8;

  

  /* =========================
     BUSCA DADOS
  ========================= */
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        setLoading(true);
        setErro("");

        let filtro = "";
        if (!isAdmin) {
          filtro = `&tecnico_id=eq.${user.id}`;
        }

        // 🔹 Tarefas
        const data = await apiGet(
          `/rest/v1/controle_api` +
            `?select=id,tecnico_id,tecnico_nome,status_api,status_teste,status_documentacao,modulo` +
            filtro
        );
// 🔹 Apontamentos abertos (quem está realmente trabalhando)
const abertos = await apiGet(
  `/rest/v1/apontamento_tempo?select=controle_api_id&fim=is.null`
);

const idsAbertos = (abertos || []).map(
  (a) => a.controle_api_id
);

        let prodHoras = [];
        let media = 0;
        let prodTelas = [];

        if (isAdmin) {
          // 🔹 Produtividade antiga (horas) – usada para previsão
          prodHoras = await apiGet(
            `/rest/v1/vw_horas_tecnico_semana` +
              `?select=tecnico_id,tecnico_nome,meta_semanal,horas_trabalhadas`
          );



          // 🔹 Produtividade NOVA (telas)
          prodTelas = await apiGet(
            `/rest/v1/vw_produtividade_telas_semana?select=tecnico_id,tecnico_nome,telas_finalizadas`
          );
        }

        if (!ativo) return;

        setRows(data || []);
        setProdutividadeHoras(prodHoras || []);
        setProdutividadeTelas(prodTelas || []);
        setIdsEmAndamento(idsAbertos);

      } catch (e) {
        if (ativo) setErro(String(e.message || e));
      } finally {
        if (ativo) setLoading(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [isAdmin, user?.id]);

  /* =========================
     RESUMO GERAL
  ========================= */
  const resumo = useMemo(() => {
    const total = rows.length;

    const pendentes = rows.filter((r) => r.status_api === "Pendente").length;
    const trabalhando = rows.filter(
  (r) => idsEmAndamento.includes(r.id)
).length;


    const concluidas = rows.filter(
      (r) =>
        r.status_api === "Finalizado" &&
        r.status_teste === "Finalizado" &&
        r.status_documentacao === "Finalizado"
    ).length;

    const porTecnico = {};
    if (isAdmin) {
      for (const r of rows) {
        const key = r.tecnico_nome || "Sem Técnico";
        porTecnico[key] ||= {
          total: 0,
          pendentes: 0,
          trabalhando: 0,
          concluidas: 0,
        };

        porTecnico[key].total++;

        if (r.status_api === "Pendente") porTecnico[key].pendentes++;
        if (idsEmAndamento.includes(r.id)) {
  porTecnico[key].trabalhando++;
}


        if (
          r.status_api === "Finalizado" &&
          r.status_teste === "Finalizado" &&
          r.status_documentacao === "Finalizado"
        ) {
          porTecnico[key].concluidas++;
        }
      }
    }

    return { total, pendentes, trabalhando, concluidas, porTecnico };
}, [rows, idsEmAndamento, isAdmin]);

  /* =========================
     PRODUTIVIDADE (TELAS)
  ========================= */
  const produtividadeTelasFormatada = useMemo(() => {
    return produtividadeTelas.map((t) => {
      const finalizadas = t.telas_finalizadas || 0;
      const faltam = Math.max(META_SEMANAL_TELAS - finalizadas, 0);
      const percentual = (finalizadas / META_SEMANAL_TELAS) * 100;

      let status = "verde";
      if (percentual < 60) status = "vermelho";
      else if (percentual < 100) status = "amarelo";

      return {
        ...t,
        finalizadas,
        faltam,
        percentual,
        status,
      };
    });
  }, [produtividadeTelas]);

  /* =========================
     PREVISÃO DE CONCLUSÃO (MANTIDA)
  ========================= */
  const previsao = useMemo(() => {
  if (!isAdmin) return null;

  const telasRestantes = resumo.pendentes + resumo.trabalhando;
  if (telasRestantes === 0) return null;

  const horasRestantes = telasRestantes * HORAS_POR_TELA;
  const diasNecessarios = Math.ceil(horasRestantes / HORAS_POR_DIA);

  let data = new Date();
  let diasUteis = diasNecessarios;

  while (diasUteis > 0) {
    data.setDate(data.getDate() + 1);
    const dia = data.getDay();
    if (dia !== 0 && dia !== 6) diasUteis--;
  }

  return {
    telasRestantes,
    horasRestantes,
    dataPrevista: data,
  };
}, [isAdmin, resumo]);


  return (
    <AppShell title="Dashboard">
      {loading && <div>Carregando...</div>}
      {erro && <div style={styles.err}>{erro}</div>}

      {!loading && !erro && (
        <>
          {/* =========================
              CARDS GERAIS
          ========================= */}
          <div style={styles.grid}>
            <Card title="Total" value={resumo.total} />
            <Card title="Pendentes" value={resumo.pendentes} />
            <Card title="Trabalhando" value={resumo.trabalhando} />
            <Card title="Concluídas" value={resumo.concluidas} />
          </div>

          {/* =========================
              PREVISÃO DE CONCLUSÃO
          ========================= */}
          {isAdmin && previsao && (
            <div style={{ ...styles.card, marginTop: 16 }}>
              <div style={styles.cardTitle}>Previsão de Conclusão</div>
              <div style={{ marginTop: 6 }}>
                Telas restantes: <strong>{previsao.telasRestantes}</strong>
              </div>
              <div>
                Horas estimadas:{" "}
                <strong>{previsao.horasRestantes.toFixed(1)}h</strong>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, marginTop: 8 }}>
                Data prevista:{" "}
                {previsao.dataPrevista.toLocaleDateString("pt-BR")}
              </div>
            </div>
          )}

          {/* =========================
              STATUS + PRODUTIVIDADE
          ========================= */}
          {isAdmin && (
            <>
              <h3 style={styles.h3}>Status por Técnico</h3>
              <div style={styles.list}>
                {Object.entries(resumo.porTecnico)
                  .filter(([k]) => k !== "Sem Técnico")
                  .map(([nome, v]) => (
                    <div key={nome} style={styles.row}>
                      <div style={{ fontWeight: 800 }}>{nome}</div>
                      <div style={styles.badges}>
                        <Badge label={`Total: ${v.total}`} />
                        <Badge label={`Trabalhando: ${v.trabalhando}`} />
                        <Badge label={`Concluídas: ${v.concluidas}`} />
                      </div>
                    </div>
                  ))}
              </div>

              <h3 style={styles.h3}>Produtividade Semanal (Telas)</h3>
              <div style={styles.list}>
                {produtividadeTelasFormatada.map((t) => (
                  <div key={t.tecnico_id} style={styles.row}>
                    <div style={{ fontWeight: 800 }}>{t.tecnico_nome}</div>
                    <div style={styles.badges}>
                      <Badge label={`Finalizadas: ${t.finalizadas}`} />
                      <Badge label={`Faltam: ${t.faltam}`} />
                      <Badge label={`Meta: ${META_SEMANAL_TELAS}`} />
                      <span
                        style={{
                          ...styles.percentual,
                          background:
                            t.status === "verde"
                              ? "#dcfce7"
                              : t.status === "amarelo"
                              ? "#fef9c3"
                              : "#fee2e2",
                        }}
                      >
                        {t.percentual.toFixed(0)}%
                      </span>
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

/* =========================
   COMPONENTES
========================= */
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

/* =========================
   STYLES
========================= */
const styles = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  card: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 14,
  },
  cardTitle: { fontSize: 12, color: "#6b7280" },
  cardValue: {
    fontSize: 26,
    fontWeight: 900,
    color: "#111827",
    marginTop: 6,
  },
  h3: { marginTop: 22, marginBottom: 10 },
  list: {
    background: "#fff",
    border: "1px solid #eee",
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 8px",
    borderBottom: "1px solid #f3f4f6",
  },
  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  badge: {
    fontSize: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: 999,
    padding: "6px 10px",
  },
  percentual: {
    fontSize: 12,
    borderRadius: 999,
    padding: "6px 12px",
    fontWeight: 700,
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
