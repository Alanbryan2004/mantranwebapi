import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// 👉 imagem dentro da pasta pages
import LogoMantran from "./logo_mantran.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ login: "", senha: "" });
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErro("");
    setLoading(true);

    try {
      const u = await login(form);

      // Regras de redirecionamento:
      if (u.perfil === "Administrador") navigate("/dashboard");
      else navigate("/minhas");
    } catch (err) {
      setErro(String(err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {/* LOGO */}
        <div style={styles.logoContainer}>
          <img src={LogoMantran} alt="Mantran" style={styles.logo} />
        </div>

        <div style={styles.title}>MantranWebAPI</div>
        <div style={styles.subtitle}>
          Controle de desenvolvimento (API, Testes, Documentação)
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 18 }}>
          <label style={styles.label}>Login</label>
          <input
            style={styles.input}
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
            placeholder="ex: alan"
            autoFocus
          />

          <label style={{ ...styles.label, marginTop: 10 }}>Senha</label>
          <input
            style={styles.input}
            type="password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            placeholder="••••••••"
          />

          {erro && <div style={styles.error}>{erro}</div>}

          <button style={styles.btn} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div style={styles.hint}>
          Dica: o login foi gerado como o nome em minúsculo sem espaços (ex:{" "}
          <b>alan</b>).
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "linear-gradient(180deg, #111827, #000000)",
    padding: 16,
  },
  card: {
    width: "min(420px, 100%)",
    background: "#fff",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    boxSizing: "border-box", // 🔒 garante que nada vaze
  },

  /* LOGO */
  logoContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 10,
  },
  logo: {
    maxWidth: 180,
    width: "100%",
    height: "auto",
  },

  title: { fontSize: 22, fontWeight: 800, color: "#8B0000", textAlign: "center" },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },

  label: {
    display: "block",
    fontSize: 12,
    color: "#374151",
    marginTop: 8,
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
    marginTop: 6,
    boxSizing: "border-box", // 🔒 correção definitiva
  },

  btn: {
    width: "100%",
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "#8B0000",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },

  error: {
    marginTop: 10,
    background: "#FEF2F2",
    color: "#991B1B",
    border: "1px solid #FECACA",
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
  },

  hint: { marginTop: 12, fontSize: 12, color: "#6b7280", textAlign: "center" },
};
