import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiPatch } from "../services/api";

export default function Header({ title = "MantranWebAPI" }) {
  const { user, logout } = useAuth();
  
  // Estados do cabeçalho
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // Estados para controle do Modal de Alteração de Senha
  const [showModal, setShowModal] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Efeito para fechar o dropdown ao clicar fora
  useEffect(() => {
    if (!dropdownOpen) return;
    const fecharDropdown = () => setDropdownOpen(false);
    document.addEventListener("click", fecharDropdown);
    return () => document.removeEventListener("click", fecharDropdown);
  }, [dropdownOpen]);

  const abrirModal = () => {
    setSenhaAtual("");
    setNovaSenha("");
    setConfirmarSenha("");
    setErro("");
    setSucesso("");
    setShowModal(true);
  };

  const fecharModal = () => {
    if (isSaving) return;
    setShowModal(false);
  };

  const handleSalvarSenha = async (e) => {
    e.preventDefault();
    setErro("");
    setSucesso("");

    if (!senhaAtual.trim()) {
      setErro("Informe a senha atual.");
      return;
    }
    if (!novaSenha.trim()) {
      setErro("Informe a nova senha.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro("A nova senha e a confirmação não coincidem.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Validar a senha atual no Supabase
      const rows = await apiGet(
        `/rest/v1/usuario?select=id&id=eq.${user.id}&senha=eq.${encodeURIComponent(senhaAtual.trim())}&limit=1`
      );

      if (!rows || rows.length === 0) {
        setErro("A senha atual informada está incorreta.");
        setIsSaving(false);
        return;
      }

      // 2. Atualizar para a nova senha
      await apiPatch(`/rest/v1/usuario?id=eq.${user.id}`, {
        senha: novaSenha.trim()
      });

      setSucesso("Senha alterada com sucesso!");
      
      // Resetar os inputs
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");

      // Fechar modal após 1.5 segundos
      setTimeout(() => {
        setShowModal(false);
        setSucesso("");
      }, 1500);
    } catch (err) {
      setErro("Erro ao atualizar a senha: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <style>{`
        .header-modal-input:focus {
          border-color: #8B0000 !important;
          box-shadow: 0 0 0 3px rgba(139, 0, 0, 0.15) !important;
        }
        .header-btn-save:hover {
          background-color: #700000 !important;
        }
        .header-btn-cancel:hover {
          background-color: #f3f4f6 !important;
          border-color: #9ca3af !important;
        }
        .header-user-menu-trigger:hover {
          background-color: rgba(255, 255, 255, 0.08);
        }
        .header-dropdown-item:hover {
          background-color: #f3f4f6;
        }
        .header-dropdown-item.logout:hover {
          background-color: #fef2f2;
          color: #ef4444 !important;
        }
        .header-btn-close {
          opacity: 0.8;
          transition: opacity 0.2s;
        }
        .header-btn-close:hover {
          opacity: 1 !important;
        }
        @keyframes dropdownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.left}>
          <div style={styles.brand}>Mantran</div>
          <div style={styles.title}>{title}</div>
        </div>

        <div style={styles.right}>
          {user && (
            <div style={{ position: "relative" }}>
              <div 
                className="header-user-menu-trigger" 
                style={styles.userBoxTrigger} 
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen(!dropdownOpen);
                }}
              >
                <div style={styles.userBox}>
                  <div style={styles.userName}>{user.nome}</div>
                  <div style={styles.userRole}>{user.perfil}</div>
                </div>
                <span style={{ 
                  fontSize: 10, 
                  transition: "transform 0.2s", 
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                  opacity: 0.8
                }}>
                  ▼
                </span>
              </div>
              
              {dropdownOpen && (
                <div style={styles.dropdown} onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="header-dropdown-item" 
                    style={styles.dropdownItem} 
                    onClick={() => {
                      setDropdownOpen(false);
                      abrirModal();
                    }}
                  >
                    <span>🔑</span> Alterar Senha
                  </button>
                  <div style={styles.dropdownDivider} />
                  <button 
                    className="header-dropdown-item logout" 
                    style={{ ...styles.dropdownItem, color: "#ef4444" }} 
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <span>🚪</span> Sair
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Modal de Alteração de Senha */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={fecharModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>
                <span>🔑</span> Alterar Sua Senha
              </h3>
              <button 
                className="header-btn-close" 
                style={styles.modalCloseBtn} 
                onClick={fecharModal}
                disabled={isSaving}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSalvarSenha}>
              <div style={styles.modalBody}>
                {erro && <div style={styles.errorText}>{erro}</div>}
                {sucesso && <div style={styles.successText}>{sucesso}</div>}

                <div style={styles.formGroup}>
                  <label style={styles.label}>Senha Atual</label>
                  <input
                    type="password"
                    className="header-modal-input"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    style={styles.input}
                    placeholder="Digite sua senha atual"
                    disabled={isSaving || sucesso}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Nova Senha</label>
                  <input
                    type="password"
                    className="header-modal-input"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    style={styles.input}
                    placeholder="Digite a nova senha"
                    disabled={isSaving || sucesso}
                    required
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirmar Nova Senha</label>
                  <input
                    type="password"
                    className="header-modal-input"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    style={styles.input}
                    placeholder="Confirme a nova senha"
                    disabled={isSaving || sucesso}
                    required
                  />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  type="button"
                  className="header-btn-cancel"
                  style={styles.btnCancel}
                  onClick={fecharModal}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="header-btn-save"
                  style={styles.btnSave}
                  disabled={isSaving || sucesso}
                >
                  {isSaving ? "Salvando..." : "Salvar Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
  userBoxTrigger: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    padding: "6px 12px",
    borderRadius: 8,
    transition: "background 0.2s",
    userSelect: "none",
  },
  userBox: { textAlign: "right", lineHeight: 1.1 },
  userName: { fontWeight: 700 },
  userRole: { fontSize: 12, opacity: 0.9 },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    background: "#ffffff",
    borderRadius: 12,
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e5e7eb",
    padding: "6px 0",
    minWidth: 160,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    animation: "dropdownFadeIn 0.15s ease-out",
  },
  dropdownItem: {
    background: "none",
    border: "none",
    padding: "10px 16px",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    textAlign: "left",
    cursor: "pointer",
    width: "100%",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: 8,
    outline: "none",
  },
  dropdownDivider: {
    height: 1,
    background: "#f3f4f6",
    margin: "4px 0",
  },
  btn: {
    border: "1px solid rgba(255,255,255,0.35)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.2s",
    outline: "none",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(15, 23, 42, 0.4)",
    backdropFilter: "blur(8px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalContent: {
    background: "#ffffff",
    width: "90%",
    maxWidth: 420,
    borderRadius: 16,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  modalHeader: {
    padding: "16px 20px",
    background: "linear-gradient(90deg, #8B0000, #4a0000)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#ffffff",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    fontSize: 24,
    color: "rgba(255, 255, 255, 0.8)",
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    textAlign: "left",
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #d1d5db",
    fontSize: 14,
    color: "#111827",
    background: "#fff",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: 600,
    background: "#fef2f2",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #fee2e2",
    textAlign: "left",
  },
  successText: {
    color: "#10b981",
    fontSize: 13,
    fontWeight: 600,
    background: "#ecfdf5",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1fae5",
    textAlign: "left",
  },
  modalFooter: {
    padding: "14px 20px",
    borderTop: "1px solid #f3f4f6",
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    background: "#f9fafb",
  },
  btnCancel: {
    background: "#ffffff",
    color: "#4b5563",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnSave: {
    background: "#8B0000",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
