import { useAuth } from "../contexts/AuthContext";

export default function Header({ title = "MantranWebAPI" }) {
  const { user, logout } = useAuth();

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <div style={styles.brand}>Mantran</div>
        <div style={styles.title}>{title}</div>
      </div>

      <div style={styles.right}>
        {user && (
          <>
            <div style={styles.userBox}>
              <div style={styles.userName}>{user.nome}</div>
              <div style={styles.userRole}>{user.perfil}</div>
            </div>
            <button style={styles.btn} onClick={logout}>
              Sair
            </button>
          </>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    background: "linear-gradient(90deg, #8B0000, #000000)",
    color: "#fff",
  },
  left: { display: "flex", alignItems: "baseline", gap: 10 },
  brand: { fontWeight: 800, letterSpacing: 0.5 },
  title: { opacity: 0.9 },
  right: { display: "flex", alignItems: "center", gap: 12 },
  userBox: { textAlign: "right", lineHeight: 1.1 },
  userName: { fontWeight: 700 },
  userRole: { fontSize: 12, opacity: 0.9 },
  btn: {
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
  },
};
