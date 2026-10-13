import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { fechaHora } from "./utiles.js";

// Solicitudes de cuenta de prueba que llegan desde la página pública
const FILTROS = [
  { id: "pendientes", texto: "Pendientes" },
  { id: "atendidos", texto: "Atendidos" },
  { id: "todos", texto: "Todos" },
];

function Contacto({ valor }) {
  if (valor.includes("@")) return <a className="enlace" href={`mailto:${valor}`}>{valor}</a>;
  let digitos = valor.replace(/\D/g, "");
  if (digitos.length === 10) digitos = "52" + digitos;
  return (
    <div>
      <div>{valor}</div>
      <a className="enlace sub" href={`https://wa.me/${digitos}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
    </div>
  );
}

export default function Prospectos({ onCambio }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState("pendientes");
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(null); // id del prospecto que se está marcando

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const datos = await api("/admin/prospectos");
      setLista(datos);
      onCambio?.(datos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [onCambio]);

  useEffect(() => { cargar(); }, [cargar]);

  const marcar = async (p, atendido) => {
    setGuardando(p.id);
    setError("");
    try {
      const nuevo = await api(`/admin/prospectos/${p.id}`, { metodo: "PATCH", cuerpo: { atendido } });
      const siguiente = lista.map((x) => (x.id === nuevo.id ? nuevo : x));
      setLista(siguiente);
      onCambio?.(siguiente);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  };

  const visibles = useMemo(() => {
    if (!lista) return [];
    const q = busqueda.trim().toLowerCase();
    return lista.filter((p) => {
      if (filtro === "pendientes" && p.atendido) return false;
      if (filtro === "atendidos" && !p.atendido) return false;
      if (!q) return true;
      return [p.nombre, p.negocio, p.contacto].some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [lista, filtro, busqueda]);

  return (
    <section className="panel">
      <div className="panel-barra">
        <div className="segmentos">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" className={filtro === f.id ? "activo" : ""} onClick={() => setFiltro(f.id)}>
              {f.texto}
            </button>
          ))}
        </div>
        <input className="buscador" placeholder="Buscar por nombre, negocio o contacto…"
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <button className="btn" onClick={cargar} disabled={cargando}>{cargando ? "Actualizando…" : "Actualizar"}</button>
      </div>

      {error && <div className="alerta alerta-error">{error}</div>}

      {!lista && !error && <div className="vacio">Cargando prospectos…</div>}
      {lista && lista.length === 0 && (
        <div className="vacio">Todavía no llegan solicitudes desde la página pública.</div>
      )}
      {lista && lista.length > 0 && visibles.length === 0 && (
        <div className="vacio">{filtro === "pendientes" && !busqueda ? "No tienes prospectos pendientes." : "Ningún prospecto coincide con el filtro."}</div>
      )}

      {visibles.length > 0 && (
        <div className="tabla-envoltura">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Nombre</th>
                <th>Negocio</th>
                <th>Contacto</th>
                <th>Estado</th>
                <th className="der">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr key={p.id}>
                  <td>{fechaHora(p.fecha)}</td>
                  <td>{p.nombre}</td>
                  <td>{p.negocio || <span className="tenue">—</span>}</td>
                  <td><Contacto valor={p.contacto} /></td>
                  <td>
                    <span className={`insignia ${p.atendido ? "insignia-activa" : "insignia-aviso"}`}>
                      {p.atendido ? "Atendido" : "Pendiente"}
                    </span>
                  </td>
                  <td className="der">
                    <div className="acciones">
                      <button className={`btn btn-chico ${p.atendido ? "" : "btn-primario"}`} disabled={guardando === p.id}
                        onClick={() => marcar(p, !p.atendido)}>
                        {guardando === p.id ? "Guardando…" : p.atendido ? "Marcar pendiente" : "Marcar atendido"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
