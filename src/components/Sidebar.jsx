import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function Sidebar() {
  const { user } = useAuth();
  const [openSubmenu, setOpenSubmenu] = useState("");

  const linksAdmin = [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/pendentes", label: "Tarefas Pendentes" },
    { to: "/minhas-tarefas", label: "Minhas Tarefas" },
    { to: "/finalizadas", label: "Finalizadas" },
    { 
      label: "Cronograma", 
      submenu: [
        { to: "/cronograma/incluir", label: "Incluir" },
        { to: "/cronograma/visualizar", label: "Visualizar" },
      ]
    },
    { to: "/cadastro-telas", label: "Cadastro de Telas" },
    { to: "/usuarios", label: "Usuários" },
  ];

  const linksTecnico = [
    { to: "/minhas-tarefas", label: "Minhas Tarefas" },
    { to: "/pendentes", label: "Pendentes" },
    { to: "/finalizadas", label: "Finalizadas" },
    { 
      label: "Cronograma", 
      submenu: [
        { to: "/cronograma/visualizar", label: "Visualizar" },
      ]
    },
  ];

  const links = user?.perfil === "Administrador" ? linksAdmin : linksTecnico;

  const toggleSubmenu = (label) => {
    setOpenSubmenu(openSubmenu === label ? "" : label);
  };

  return (
    <aside style={styles.sidebar}>
      <div style={styles.sectionTitle}>Menu</div>

      <nav style={styles.nav}>
        {links.map((l) => {
          if (l.submenu) {
            const isOpen = openSubmenu === l.label;
            return (
              <div key={l.label}>
                <div 
                  style={{...styles.link, ...styles.submenuHeader}} 
                  onClick={() => toggleSubmenu(l.label)}
                >
                  {l.label}
                  {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                {isOpen && (
                  <div style={styles.submenuContainer}>
                    {l.submenu.map((sub) => (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        style={({ isActive }) => ({
                          ...styles.link,
                          ...styles.sublink,
                          ...(isActive ? styles.active : null),
                        })}
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
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
          );
        })}
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
    cursor: "pointer",
  },
  submenuHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  submenuContainer: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginTop: 4,
  },
  sublink: {
    padding: "8px 12px 8px 32px",
    fontSize: 13,
  },
  active: {
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    color: "#8B0000",
    fontWeight: 700,
  },
};
