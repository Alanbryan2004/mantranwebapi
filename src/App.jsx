import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import MinhasTarefas from "./pages/MinhasTarefas";
import Pendentes from "./pages/Pendentes";
import HomeRedirect from "./pages/HomeRedirect";
import Finalizadas from "./pages/Finalizadas";

// 👉 TELA DE CADASTROS EXISTENTES
import CadastroTelas from "./pages/CadastroTelas";
import Usuarios from "./pages/Usuarios";

// 👉 TELA DE CRONOGRAMA
import CronogramaIncluir from "./pages/cronograma/Incluir";
import CronogramaVisualizar from "./pages/cronograma/Visualizar";
import CronogramaArquitetura from "./pages/cronograma/Arquitetura";

export default function App() {
  return (
    <Routes>
      {/* =========================
         Login público
      ========================= */}
      <Route path="/login" element={<Login />} />

      {/* =========================
         Rota raiz decide destino
         (Admin → Dashboard
          Técnico → Minhas Tarefas)
      ========================= */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomeRedirect />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Dashboard (Admin)
      ========================= */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Minhas Tarefas (Técnico)
      ========================= */}
      <Route
        path="/minhas-tarefas"
        element={
          <ProtectedRoute>
            <MinhasTarefas />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Pendentes
         (Admin vê | Técnico assume)
      ========================= */}
      <Route
        path="/pendentes"
        element={
          <ProtectedRoute>
            <Pendentes />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Finalizadas
      ========================= */}
      <Route
        path="/finalizadas"
        element={
          <ProtectedRoute>
            <Finalizadas />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Cadastro de Telas (Admin)
      ========================= */}
      <Route
        path="/cadastro-telas"
        element={
          <ProtectedRoute>
            <CadastroTelas />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Usuários (Admin)
      ========================= */}
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <Usuarios />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Cronograma
      ========================= */}
      <Route
        path="/cronograma/incluir"
        element={
          <ProtectedRoute>
            <CronogramaIncluir />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cronograma/visualizar"
        element={
          <ProtectedRoute>
            <CronogramaVisualizar />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cronograma/arquitetura"
        element={
          <ProtectedRoute>
            <CronogramaArquitetura />
          </ProtectedRoute>
        }
      />

      {/* =========================
         Fallback
      ========================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
