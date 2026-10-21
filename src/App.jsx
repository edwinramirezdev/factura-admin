import { useCallback, useEffect, useMemo, useState } from "react";
import { api, guardarSesion, iniciarSesion, sesionGuardada } from "./api.js";
import { diasRestantes, fecha, num, nombrePlan } from "./utiles.js";
import {
  ModalAlta, ModalCredenciales, ModalDetalle, ModalHistorial, ModalMisEmpresas, ModalTimbres, ModalVigencia,
} from "./Modales.jsx";
import Prospectos from "./Prospectos.jsx";
import Nomina from "./Nomina.jsx";

// ───────────────────────────── inicio de sesión ─────────────────────────────
function Login({ onEntrar, aviso }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(aviso || "");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      const datos = await iniciarSesion(email.trim(), password);
      guardarSesion(datos);
      await api("/admin/resumen"); // confirma que es el superadministrador
      onEntrar(datos);
    } catch (err) {
      guardarSesion(null);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="login-fondo">
      <form className="login-caja" onSubmit={enviar}>
        <div className="marca marca-grande">
          <span className="marca-icono">✓</span>
          <div>
            <div className="marca-titulo">Portal de administración</div>
            <div className="marca-sub">Sistema de Facturación CFDI</div>
          </div>
        </div>
        <label className="campo">
          <span>Correo</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="alerta alerta-error">{error}</div>}
        <button className="btn btn-primario btn-bloque" disabled={cargando}>
          {cargando ? "Entrando…" : "Entrar"}
        </button>
        <p className="nota-login">Acceso exclusivo del administrador del servicio.</p>
      </form>
    </div>
  );
}

// ───────────────────────────── piezas del tablero ─────────────────────────────
function Tarjeta({ titulo, valor, detalle, tono, onClick, activa }) {
  return (
    <button type="button" className={`tarjeta tono-${tono || "neutro"} ${activa ? "activa" : ""}`}
      onClick={onClick} disabled={!onClick}>
      <span className="tarjeta-titulo">{titulo}</span>
      <span className="tarjeta-valor">{valor}</span>
      {detalle && <span className="tarjeta-detalle">{detalle}</span>}
    </button>
  );
}

const ETIQUETA_ESTADO = { activa: "Activa", vencida: "Vencida", suspendida: "Suspendida" };

function Estado({ estado, dias, sinTimbres }) {
  if (estado === "activa" && sinTimbres) {
    return <span className="insignia insignia-vencida" title="Bloqueado hasta que le asignes timbres">Sin timbres</span>;
  }
  if (estado === "activa" && dias !== null && dias <= 15) {
    return <span className="insignia insignia-aviso">Vence pronto</span>;
  }
  return <span className={`insignia insignia-${estado}`}>{ETIQUETA_ESTADO[estado] || estado}</span>;
}

function Vigencia({ iso }) {
  if (!iso) return <span className="tenue">Sin vencimiento</span>;
  const dias = diasRestantes(iso);
  let texto = dias < 0 ? `venció hace ${-dias} día${dias === -1 ? "" : "s"}` : dias === 0 ? "vence hoy" : `${dias} día${dias === 1 ? "" : "s"}`;
  return (
    <div>
      <div>{fecha(iso)}</div>
      <div className={`sub ${dias < 0 ? "txt-error" : dias <= 15 ? "txt-aviso" : ""}`}>{texto}</div>
    </div>
  );
}

function Timbres({ saldo }) {
  if (!saldo) return <span className="tenue">Sin subcuenta SW</span>;
  if (saldo.error) return <span className="txt-aviso" title={saldo.error}>SW no respondió</span>;
  if (saldo.ilimitado) return <span>Ilimitado</span>;
  const pct = saldo.asignados > 0 ? Math.round((saldo.usados / saldo.asignados) * 100) : 0;
  const bajo = saldo.disponibles <= Math.max(5, saldo.asignados * 0.1);
  return (
    <div className="timbres">
      <div className="timbres-cifra">
        <b className={saldo.disponibles === 0 ? "txt-error" : bajo ? "txt-aviso" : ""}>{num(saldo.disponibles)}</b>
        <span className="sub"> disponibles</span>
      </div>
      <div className="barra"><div style={{ width: `${pct}%` }} /></div>
      <div className="sub">{num(saldo.usados)} usados de {num(saldo.asignados)}</div>
    </div>
  );
}

function UltimaAsignacion({ a }) {
  if (!a) return <span className="tenue">—</span>;
  const signo = a.tipo === "abono" ? "+" : "−";
  return (
    <div>
      <div className={a.tipo === "abono" ? "txt-ok" : "txt-error"}><b>{signo}{num(a.cantidad)}</b></div>
      <div className="sub">{fecha(a.fecha)}</div>
    </div>
  );
}

// ───────────────────────────── tablero ─────────────────────────────
function Tablero({ sesion, onSalir }) {
  const [resumen, setResumen] = useState(null);
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [modal, setModal] = useState(null); // { tipo, cuenta, datos }
  const [seccion, setSeccion] = useState("clientes"); // "clientes" | "prospectos" | "nomina"
  const [pendientes, setPendientes] = useState(null); // prospectos sin atender

  const contarPendientes = useCallback((lista) => setPendientes(lista.filter((p) => !p.atendido).length), []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    api("/admin/prospectos").then(contarPendientes).catch(() => {});
    try {
      const [r, c] = await Promise.all([api("/admin/resumen"), api("/admin/cuentas")]);
      setResumen(r);
      setCuentas(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [contarPendientes]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => {
    if (!cuentas) return [];
    const q = busqueda.trim().toLowerCase();
    return cuentas.filter((c) => {
      const dias = diasRestantes(c.vigencia_hasta);
      if (filtro === "por_vencer" && !(c.estado === "activa" && dias !== null && dias <= 15)) return false;
      if (["activa", "vencida", "suspendida"].includes(filtro) && c.estado !== filtro) return false;
      if (filtro === "sin_timbres" && !(c.saldo && !c.saldo.error && !c.saldo.ilimitado && c.saldo.disponibles <= 0)) return false;
      if (!q) return true;
      return [c.nombre, c.usuario, c.email_contacto, c.telefono].some((x) => (x || "").toLowerCase().includes(q));
    });
  }, [cuentas, busqueda, filtro]);

  const sinTimbres = cuentas ? cuentas.filter((c) => c.saldo && !c.saldo.error && !c.saldo.ilimitado && c.saldo.disponibles <= 0).length : 0;
  const bolsa = resumen?.bolsa_sw;
  const alternar = (f) => setFiltro((actual) => (actual === f ? "todos" : f));
  const abrir = (tipo, cuenta, datos) => setModal({ tipo, cuenta, datos });
  const cerrar = () => setModal(null);
  const alTerminar = () => { cerrar(); cargar(); };

  return (
    <div className="app">
      <header className="barra-sup">
        <div className="marca">
          <span className="marca-icono">✓</span>
          <div>
            <div className="marca-titulo">Portal de administración</div>
            <div className="marca-sub">Sistema de Facturación CFDI</div>
          </div>
        </div>
        <nav className="pestanas" aria-label="Secciones">
          <button type="button" className={seccion === "clientes" ? "activa" : ""} aria-current={seccion === "clientes" ? "page" : undefined}
            onClick={() => setSeccion("clientes")}>Clientes</button>
          <button type="button" className={seccion === "prospectos" ? "activa" : ""} aria-current={seccion === "prospectos" ? "page" : undefined}
            onClick={() => setSeccion("prospectos")}>
            Prospectos{pendientes > 0 && <span className="pestana-cuenta" aria-label={`${pendientes} pendientes`}>{pendientes}</span>}
          </button>
          <button type="button" className={seccion === "nomina" ? "activa" : ""} aria-current={seccion === "nomina" ? "page" : undefined}
            onClick={() => setSeccion("nomina")}>Nómina</button>
        </nav>
        <div className="barra-usuario">
          <span className="tenue">{sesion?.usuario?.email || ""}</span>
          <button className="btn btn-fantasma" onClick={onSalir}>Salir</button>
        </div>
      </header>

      {seccion === "prospectos" && (
        <main className="contenido">
          <Prospectos onCambio={contarPendientes} />
        </main>
      )}

      {seccion === "nomina" && (
        <main className="contenido">
          <Nomina />
        </main>
      )}

      {seccion === "clientes" && <main className="contenido">
        <section className="tarjetas">
          <Tarjeta titulo="Clientes" valor={resumen ? num(resumen.clientes) : "…"}
            onClick={() => setFiltro("todos")} activa={filtro === "todos"} />
          <Tarjeta titulo="Activos" valor={resumen ? num(resumen.estados.activa) : "…"} tono="ok"
            onClick={() => alternar("activa")} activa={filtro === "activa"} />
          <Tarjeta titulo="Vencen en 15 días" valor={resumen ? num(resumen.por_vencer_15_dias) : "…"} tono="aviso"
            onClick={() => alternar("por_vencer")} activa={filtro === "por_vencer"} />
          <Tarjeta titulo="Vencidos" valor={resumen ? num(resumen.estados.vencida) : "…"} tono="error"
            onClick={() => alternar("vencida")} activa={filtro === "vencida"} />
          <Tarjeta titulo="Suspendidos" valor={resumen ? num(resumen.estados.suspendida) : "…"} tono="neutro"
            onClick={() => alternar("suspendida")} activa={filtro === "suspendida"} />
          <Tarjeta titulo="Sin timbres" valor={cuentas ? num(sinTimbres) : "…"} tono="error"
            onClick={() => alternar("sin_timbres")} activa={filtro === "sin_timbres"} />
          <Tarjeta titulo="Tu bolsa en SW" tono="info"
            valor={!bolsa ? "…" : bolsa.error ? "—" : bolsa.ilimitado ? "Ilimitado" : num(bolsa.disponibles)}
            detalle={!bolsa ? "" : bolsa.error ? "SW no respondió" : `disponibles · ${num(bolsa.usados)} usados de ${num(bolsa.asignados)}`} />
        </section>

        <section className="panel">
          <div className="panel-barra">
            <input className="buscador" placeholder="Buscar por nombre, correo o teléfono…"
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <button className="btn" onClick={cargar} disabled={cargando}>{cargando ? "Actualizando…" : "Actualizar"}</button>
            <button className="btn" onClick={() => abrir("mis-empresas")}>Mis empresas</button>
            <button className="btn btn-primario" onClick={() => abrir("alta")}>+ Nuevo cliente</button>
          </div>

          {error && <div className="alerta alerta-error">{error}</div>}

          {!cuentas && !error && <div className="vacio">Cargando clientes…</div>}
          {cuentas && cuentas.length === 0 && (
            <div className="vacio">
              <p>Todavía no tienes clientes.</p>
              <button className="btn btn-primario" onClick={() => abrir("alta")}>Dar de alta el primero</button>
            </div>
          )}
          {cuentas && cuentas.length > 0 && visibles.length === 0 && (
            <div className="vacio">Ningún cliente coincide con el filtro.</div>
          )}

          {visibles.length > 0 && (
            <div className="tabla-envoltura">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Plan / RFC</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th>Timbres</th>
                    <th>Última asignación</th>
                    <th className="der">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <button className="enlace" onClick={() => abrir("detalle", c)}>{c.nombre}</button>
                        <div className="sub">{c.usuario || c.email_contacto}</div>
                      </td>
                      <td>
                        <div>{nombrePlan(c.max_rfcs)}</div>
                        <div className="sub">{c.rfcs_usados} de {c.max_rfcs} RFC</div>
                      </td>
                      <td><Vigencia iso={c.vigencia_hasta} /></td>
                      <td><Estado estado={c.estado} dias={diasRestantes(c.vigencia_hasta)} sinTimbres={c.sin_timbres} /></td>
                      <td><Timbres saldo={c.saldo} /></td>
                      <td><UltimaAsignacion a={c.ultima_asignacion} /></td>
                      <td className="der">
                        <div className="acciones">
                          <button className="btn btn-chico" onClick={() => abrir("timbres", c)}>Timbres</button>
                          <button className="btn btn-chico" onClick={() => abrir("historial", c)}>Historial</button>
                          <button className="btn btn-chico" onClick={() => abrir("vigencia", c)}>Vigencia</button>
                          <button className="btn btn-chico" onClick={() => abrir("detalle", c)}>Detalle</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>}

      {modal?.tipo === "alta" && (
        <ModalAlta bolsa={bolsa} onCerrar={cerrar}
          onCreado={(datos) => { cargar(); abrir("credenciales", null, { ...datos, titulo: "Cliente dado de alta" }); }} />
      )}
      {modal?.tipo === "credenciales" && <ModalCredenciales datos={modal.datos} onCerrar={cerrar} />}
      {modal?.tipo === "mis-empresas" && <ModalMisEmpresas onCerrar={cerrar} />}
      {modal?.tipo === "timbres" && <ModalTimbres cuenta={modal.cuenta} bolsa={bolsa} onCerrar={cerrar} onListo={alTerminar} />}
      {modal?.tipo === "vigencia" && <ModalVigencia cuenta={modal.cuenta} onCerrar={cerrar} onListo={alTerminar} />}
      {modal?.tipo === "historial" && <ModalHistorial cuenta={modal.cuenta} onCerrar={cerrar} />}
      {modal?.tipo === "detalle" && (
        <ModalDetalle cuenta={modal.cuenta} onCerrar={cerrar} onCambio={cargar}
          onCredenciales={(datos) => abrir("credenciales", null, { titulo: "Acceso restablecido", ...datos })} />
      )}
    </div>
  );
}

// ───────────────────────────── app ─────────────────────────────
export default function App() {
  const [sesion, setSesion] = useState(() => sesionGuardada());
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    const alPerderAcceso = (e) => {
      guardarSesion(null);
      setSesion(null);
      setAviso(e.detail || "Tu sesión terminó. Vuelve a entrar.");
    };
    window.addEventListener("admin-sin-acceso", alPerderAcceso);
    return () => window.removeEventListener("admin-sin-acceso", alPerderAcceso);
  }, []);

  const salir = () => {
    guardarSesion(null);
    setSesion(null);
    setAviso("");
  };

  if (!sesion) return <Login aviso={aviso} onEntrar={(s) => { setAviso(""); setSesion(s); }} />;
  return <Tablero sesion={sesion} onSalir={salir} />;
}
