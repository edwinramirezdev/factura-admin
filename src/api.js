import { API_URL } from "./config.js";

const CLAVE = "auth_admin_cfdi";

export function sesionGuardada() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || "null");
  } catch {
    return null;
  }
}

export function guardarSesion(s) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesion dura mientras la pestana este abierta */
  }
}

function textoDeError(cuerpo, status) {
  const d = cuerpo && cuerpo.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => {
        const campo = (e.loc || []).filter((x) => x !== "body").join(" › ");
        return campo ? `${campo}: ${e.msg}` : e.msg;
      })
      .join(" · ");
  }
  return `Error ${status}`;
}

export class ErrorApi extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

// Llamada a la API con el token de la sesion. 401 y 403 avisan a la app para cerrar sesion.
export async function api(ruta, { metodo = "GET", cuerpo } = {}) {
  const s = sesionGuardada();
  const headers = { Accept: "application/json" };
  if (s?.access_token) headers.Authorization = `Bearer ${s.access_token}`;
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  let r;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi("No hay conexión con el servidor. ¿Está encendido el backend?", 0);
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = textoDeError(datos, r.status);
    if (r.status === 401 || (r.status === 403 && ruta.startsWith("/admin") && msg.includes("administrador del servicio"))) {
      window.dispatchEvent(new CustomEvent("admin-sin-acceso", { detail: msg }));
    }
    throw new ErrorApi(msg, r.status);
  }
  return datos;
}

// Inicio de sesion con el mismo endpoint del sistema (acepta JSON o formulario).
export async function iniciarSesion(email, password) {
  const url = `${API_URL}/auth/login`;
  let r;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.status === 422) {
      r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
      });
    }
  } catch {
    throw new ErrorApi("No hay conexión con el servidor. ¿Está encendido el backend?", 0);
  }
  const datos = await r.json().catch(() => null);
  if (!r.ok || !datos?.access_token) throw new ErrorApi(textoDeError(datos, r.status), r.status);
  return datos;
}
