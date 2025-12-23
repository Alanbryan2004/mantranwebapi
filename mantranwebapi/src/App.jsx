import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Por enquanto */}
      <Route path="/pendentes" element={<Navigate to="/dashboard" replace />} />
      <Route path="/minhas" element={<Navigate to="/dashboard" replace />} />
      <Route path="/finalizadas" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
