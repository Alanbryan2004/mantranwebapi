import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function HomeRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (user.perfil === "Administrador") {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.perfil === "Suporte") {
    return <Navigate to="/qa-testes" replace />;
  }

  return <Navigate to="/minhas-tarefas" replace />;
}
