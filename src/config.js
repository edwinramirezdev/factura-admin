// Direccion del backend. En produccion se define VITE_API_URL en el .env del portal
// (por ejemplo https://api.midominio.com); sin ella se usa http://localhost:8000.
const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const API_URL = `${BASE}/api/v1`;
