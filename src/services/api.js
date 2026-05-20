// src/services/api.js
const BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function defaultHeaders(extra = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...defaultHeaders(), ...(options.headers || {}) },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new Error(
      (data && (data.message || data.error || data.error_description)) ||
      text ||
      `HTTP ${res.status}`
    );
  }

  return data;
}

/* =======================
   MÉTODOS REST PADRÃO
======================= */

export function apiGet(path) {
  return request(path, { method: "GET" });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
}

// 👉 ADIÇÃO NECESSÁRIA
export function apiDelete(path) {
  return request(path, {
    method: "DELETE",
  });
}

/* =======================
   RPC (Supabase Functions)
======================= */

export function rpc(functionName, payload = {}) {
  return apiPost(`/rest/v1/rpc/${functionName}`, payload);
}

/* ========================================================
   AUTO-PAUSA RETROATIVA DE TAREFAS APÓS 18:00
   ======================================================== */
export async function limparApontamentosAntigos() {
  try {
    // 1. Buscar todos os apontamentos ativos (sem data de fim)
    const ativos = await apiGet("/rest/v1/apontamento_tempo?select=tecnico_id,controle_api_id,inicio,fim&fim=is.null");
    if (!ativos || ativos.length === 0) return [];

    const now = new Date();
    const atualizados = [];

    for (const apont of ativos) {
      const inicioDate = new Date(apont.inicio);
      
      // Verifica se a data de início é um dia anterior ao atual
      const isPastDay =
        inicioDate.getFullYear() < now.getFullYear() ||
        (inicioDate.getFullYear() === now.getFullYear() && inicioDate.getMonth() < now.getMonth()) ||
        (inicioDate.getFullYear() === now.getFullYear() && inicioDate.getMonth() === now.getMonth() && inicioDate.getDate() < now.getDate());

      // Verifica se a data de início é hoje
      const isToday =
        inicioDate.getFullYear() === now.getFullYear() &&
        inicioDate.getMonth() === now.getMonth() &&
        inicioDate.getDate() === now.getDate();

      const isAfter18h = now.getHours() >= 18;

      if (isPastDay || (isToday && isAfter18h)) {
        // Calcular o horário de fim (18:00 do dia de início, ou 1 min após o início caso tenha começado depois das 18h)
        const limite18h = new Date(inicioDate);
        limite18h.setHours(18, 0, 0, 0);

        let dataFim = limite18h.toISOString();
        if (inicioDate.getTime() >= limite18h.getTime()) {
          dataFim = new Date(inicioDate.getTime() + 60 * 1000).toISOString();
        }

        // Atualizar no Supabase
        await apiPatch(
          `/rest/v1/apontamento_tempo?controle_api_id=eq.${apont.controle_api_id}&tecnico_id=eq.${apont.tecnico_id}&fim=is.null`,
          { fim: dataFim }
        );
        atualizados.push(apont.controle_api_id);
      }
    }
    return atualizados;
  } catch (err) {
    console.error("Erro ao limpar apontamentos antigos:", err);
    return [];
  }
}

