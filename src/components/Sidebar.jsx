import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Sidebar() {
  const { user } = useAuth();

  const links =
    user?.perfil === "Administrador"
      ? [
          { to: "/dashboard", label: "Dashboard" },
          { to: "/pendentes", label: "Tarefas Pendentes" },
          { to: "/minhas-tarefas", label: "Minhas Tarefas" },
          { to: "/finalizadas", label: "Finalizadas" },
        ]
      : [
          { to: "/minhas-tarefas", label: "Minhas Tarefas" },
          { to: "/pendentes", label: "Pendentes" },
          { to: "/finalizadas", label: "Finalizadas" },
        ];

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sectionTitle}>Menu</div>

      <nav style={styles.nav}>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            style={({ isActive }) => ({
              ...styles.link,
              ...(isActive ? styles.active : null),
            })}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles = {
  sidebar: {
    width: 220,
    background: "#ffffff",
    borderRight: "1px solid #eee",
    padding: 12,
  },
  sectionTitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 8,
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  link: {
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "#111827",
    border: "1px solid transparent",
  },
  active: {
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#8B0000",
    fontWeight: 700,
  },
};
