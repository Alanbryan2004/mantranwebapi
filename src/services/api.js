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

export function apiPatch(path, body) {
  return request(path, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });
}

export function apiPost(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* =======================
   RPC (Supabase Functions)
======================= */

export function rpc(functionName, payload = {}) {
  return apiPost(`/rest/v1/rpc/${functionName}`, payload);
}
