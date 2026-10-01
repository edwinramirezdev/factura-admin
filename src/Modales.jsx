import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import {
  EMAIL_RE, PLANES, REGIMENES, RFC_RE, aFecha, fecha, fechaHora, fechaInput, nombrePlan, num, sumarMeses,
} from "./utiles.js";

// ───────────────────────────── base ─────────────────────────────
function Modal({ titulo, subtitulo, onCerrar, children, pie, ancho }) {
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" style={ancho ? { maxWidth: ancho } : undefined} role="dialog" aria-modal="true">
        <div className="modal-cabeza">
          <div>
            <h2>{titulo}</h2>
            {subtitulo && <div className="sub">{subtitulo}</div>}
          </div>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}

function Campo({ etiqueta, ayuda, children, ancho }) {
  return (
    <label className={`campo ${ancho || ""}`}>
      <span>{etiqueta}</span>
      {children}
      {ayuda && <small className="ayuda">{ayuda}</small>}
    </label>
  );
}

function Opciones({ valor, opciones, onCambio }) {
  return (
    <div className="segmentos">
      {opciones.map(([v, t]) => (
        <button type="button" key={String(v)} className={valor === v ? "activo" : ""} onClick={() => onCambio(v)}>{t}</button>
      ))}
    </div>
  );
}

function SaldoActual({ saldo }) {
  if (!saldo) return <div className="alerta">Este cliente no tiene subcuenta en SW.</div>;
  if (saldo.error) return <div className="alerta alerta-aviso">SW no respondió al consultar el saldo: {saldo.error}</div>;
  return (
    <div className="saldo-fila">
      <div><span className="sub">Asignados</span><b>{num(saldo.asignados)}</b></div>
      <div><span className="sub">Usados</span><b>{num(saldo.usados)}</b></div>
      <div><span className="sub">Disponibles</span><b>{num(saldo.disponibles)}</b></div>
    </div>
  );
}

// ───────────────────────────── alta de cliente ─────────────────────────────
const MESES = [[1, "1 mes"], [3, "3 meses"], [6, "6 meses"], [12, "12 meses"]];

export function ModalAlta({ bolsa, onCerrar, onCreado }) {
  const [f, setF] = useState({
    nombre: "", email: "", telefono: "", plan: 1, rfcsPersonalizado: 2,
    modoVigencia: "meses", meses: 1, fecha: "", timbres: 0, notas: "",
    rfc: "", razon: "", regimen: "612", cp: "",
  });
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }));

  const rfc = f.rfc.trim().toUpperCase();
  const maxRfcs = f.plan === "otro" ? Number(f.rfcsPersonalizado) : f.plan;
  const vence = f.modoVigencia === "meses" ? sumarMeses(new Date(), f.meses) : f.fecha ? new Date(f.fecha + "T12:00:00") : null;
  const disponiblesBolsa = bolsa && !bolsa.error && !bolsa.ilimitado ? bolsa.disponibles : null;

  const problemas = [];
  if (!f.nombre.trim()) problemas.push("el nombre del cliente");
  if (!EMAIL_RE.test(f.email.trim())) problemas.push("un correo válido");
  if (!RFC_RE.test(rfc)) problemas.push("un RFC válido");
  if (!f.razon.trim()) problemas.push("la razón social");
  if (!/^\d{5}$/.test(f.cp)) problemas.push("el código postal (5 dígitos)");
  if (!(maxRfcs >= 1 && maxRfcs <= 500)) problemas.push("un número de RFC entre 1 y 500");
  if (f.modoVigencia === "fecha" && !f.fecha) problemas.push("la fecha de vencimiento");
  if (Number(f.timbres) < 0) problemas.push("timbres iniciales en 0 o más");

  useEffect(() => {
    if (error.startsWith("Falta") && problemas.length === 0) setError("");
  }, [problemas.length, error]);

  const tipoPersona = rfc.length === 12 ? "Persona moral" : rfc.length === 13 ? "Persona física" : "";

  const enviar = async (e) => {
    e.preventDefault();
    if (problemas.length) {
      setError("Falta " + problemas.join(", ") + ".");
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const cuerpo = {
        nombre: f.nombre.trim(), email: f.email.trim(), telefono: f.telefono.trim() || null,
        max_rfcs: maxRfcs, timbres_iniciales: Number(f.timbres) || 0, notas: f.notas.trim() || null,
        empresa: { rfc, razon_social: f.razon.trim(), regimen_fiscal: f.regimen, codigo_postal: f.cp },
      };
      if (f.modoVigencia === "meses") cuerpo.meses = f.meses;
      else cuerpo.vigencia_hasta = f.fecha;
      const datos = await api("/admin/cuentas", { metodo: "POST", cuerpo });
      onCreado(datos);
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Nuevo cliente" subtitulo="Se crea su cuenta, su usuario, su primera empresa y su subcuenta en SW"
      onCerrar={onCerrar} ancho={760}
      pie={<>
        <button className="btn" onClick={onCerrar} disabled={enviando}>Cancelar</button>
        <button className="btn btn-primario" form="form-alta" disabled={enviando}>
          {enviando ? "Creando cliente…" : "Dar de alta"}
        </button>
      </>}>
      <form id="form-alta" onSubmit={enviar} className="form">
        <h3>Cliente y acceso</h3>
        <div className="rejilla">
          <Campo etiqueta="Nombre del cliente" ancho="doble">
            <input value={f.nombre} onChange={set("nombre")} placeholder="Ej. Ferretería Pérez" autoFocus />
          </Campo>
          <Campo etiqueta="Correo (será su usuario)" ayuda="Aquí le llegará su contraseña temporal">
            <input type="email" value={f.email} onChange={set("email")} placeholder="cliente@correo.com" />
          </Campo>
          <Campo etiqueta="Teléfono (opcional)">
            <input value={f.telefono} onChange={set("telefono")} inputMode="tel" maxLength={20} />
          </Campo>
        </div>

        <h3>Plan y vigencia</h3>
        <div className="rejilla">
          <Campo etiqueta="Plan" ancho="doble">
            <Opciones valor={f.plan} onCambio={set("plan")}
              opciones={[...PLANES.map((p) => [p.rfcs, `${p.nombre} · ${p.rfcs} RFC`]), ["otro", "Personalizado"]]} />
          </Campo>
          {f.plan === "otro" && (
            <Campo etiqueta="RFC permitidos">
              <input type="number" min={1} max={500} value={f.rfcsPersonalizado} onChange={set("rfcsPersonalizado")} />
            </Campo>
          )}
          <Campo etiqueta="Vigencia de la renta" ancho="doble">
            <Opciones valor={f.modoVigencia} onCambio={set("modoVigencia")}
              opciones={[["meses", "Por meses"], ["fecha", "Fecha exacta"]]} />
          </Campo>
          {f.modoVigencia === "meses" ? (
            <Campo etiqueta="Meses" ayuda={vence ? `Vence el ${fecha(vence.toISOString())}` : ""} ancho="doble">
              <Opciones valor={f.meses} onCambio={set("meses")} opciones={MESES} />
            </Campo>
          ) : (
            <Campo etiqueta="Vence el" ayuda="Tendrá acceso hasta el final de ese día">
              <input type="date" value={f.fecha} min={fechaInput(new Date())} onChange={set("fecha")} />
            </Campo>
          )}
          <Campo etiqueta="Timbres iniciales"
            ayuda={Number(f.timbres) === 0
              ? "Sin timbres el cliente no podrá entrar hasta que se los asignes"
              : disponiblesBolsa !== null ? `Tu bolsa en SW tiene ${num(disponiblesBolsa)} disponibles` : ""}>
            <input type="number" min={0} value={f.timbres} onChange={set("timbres")} />
          </Campo>
        </div>

        <h3>Primera empresa (RFC)</h3>
        <div className="rejilla">
          <Campo etiqueta="RFC" ayuda={tipoPersona}>
            <input value={f.rfc} onChange={(e) => setF((x) => ({ ...x, rfc: e.target.value.toUpperCase().replace(/[^A-ZÑ&0-9]/g, "").slice(0, 13) }))}
              placeholder="XAXX010101000" className="mayus" />
          </Campo>
          <Campo etiqueta="Código postal fiscal">
            <input value={f.cp} onChange={(e) => setF((x) => ({ ...x, cp: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
              inputMode="numeric" />
          </Campo>
          <Campo etiqueta="Razón social (como aparece en la constancia)" ancho="doble">
            <input value={f.razon} onChange={set("razon")} className="mayus" />
          </Campo>
          <Campo etiqueta="Régimen fiscal" ancho="doble">
            <select value={f.regimen} onChange={set("regimen")}>
              {REGIMENES.map(([c, t]) => <option key={c} value={c}>{c} · {t}</option>)}
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Notas internas (solo las ves tú)">
          <textarea rows={2} value={f.notas} onChange={set("notas")} placeholder="Ej. pagó paquete anual el 29/09" />
        </Campo>

        {error && <div className="alerta alerta-error">{error}</div>}
      </form>
    </Modal>
  );
}

// ───────────────────────────── credenciales (tras alta o restablecer) ─────────────────────────────
export function ModalCredenciales({ datos, onCerrar }) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Usuario: ${datos.usuario}\nContraseña temporal: ${datos.password_temporal}`;
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* el portapapeles puede estar bloqueado; el texto sigue visible */ }
  };
  return (
    <Modal titulo={datos.titulo} onCerrar={onCerrar} ancho={520}
      pie={<button className="btn btn-primario" onClick={onCerrar}>Listo</button>}>
      {datos.nombre && <p><b>{datos.nombre}</b> ya puede entrar al sistema.</p>}
      <div className="credenciales">
        <div><span className="sub">Usuario</span><code>{datos.usuario}</code></div>
        <div><span className="sub">Contraseña temporal</span><code>{datos.password_temporal}</code></div>
        <button className="btn btn-chico" onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</button>
      </div>
      {datos.correo_enviado
        ? <div className="alerta alerta-ok">Se le envió por correo a {datos.usuario}.</div>
        : <div className="alerta alerta-aviso">No se pudo enviar el correo. Compártele estos datos por otro medio; esta contraseña no se volverá a mostrar.</div>}
      {datos.aviso && <div className="alerta alerta-aviso">{datos.aviso}</div>}
    </Modal>
  );
}

// ───────────────────────────── timbres ─────────────────────────────
export function ModalTimbres({ cuenta, bolsa, onCerrar, onListo }) {
  const [tipo, setTipo] = useState("abono");
  const [cantidad, setCantidad] = useState("");
  const [comentario, setComentario] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const saldo = cuenta.saldo;
  const n = Number(cantidad);
  const valido = Number.isInteger(n) && n > 0;
  const bolsaDisp = bolsa && !bolsa.error && !bolsa.ilimitado ? bolsa.disponibles : null;
  const clienteDisp = saldo && !saldo.error ? saldo.disponibles : null;
  let advertencia = "";
  if (valido && tipo === "abono" && bolsaDisp !== null && n > bolsaDisp) advertencia = `Tu bolsa en SW solo tiene ${num(bolsaDisp)} disponibles.`;
  if (valido && tipo === "retiro" && clienteDisp !== null && n > clienteDisp) advertencia = `El cliente solo tiene ${num(clienteDisp)} disponibles.`;

  const enviar = async (e) => {
    e.preventDefault();
    if (!valido) { setError("Escribe una cantidad entera mayor a 0."); return; }
    setError("");
    setEnviando(true);
    try {
      const r = await api(`/admin/cuentas/${cuenta.id}/timbres`, {
        metodo: "POST", cuerpo: { tipo, cantidad: n, comentario: comentario.trim() || null },
      });
      setResultado(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (resultado) {
    return (
      <Modal titulo="Movimiento registrado" subtitulo={cuenta.nombre} onCerrar={onListo} ancho={480}
        pie={<button className="btn btn-primario" onClick={onListo}>Listo</button>}>
        <div className="alerta alerta-ok">
          Se {tipo === "abono" ? "abonaron" : "retiraron"} <b>{num(n)}</b> timbres. Saldo del cliente en SW: <b>{num(resultado.saldo_resultante)}</b>.
        </div>
        {resultado.saldo && <SaldoActual saldo={resultado.saldo} />}
      </Modal>
    );
  }

  return (
    <Modal titulo="Timbres" subtitulo={cuenta.nombre} onCerrar={onCerrar} ancho={520}
      pie={<>
        <button className="btn" onClick={onCerrar} disabled={enviando}>Cancelar</button>
        <button className="btn btn-primario" form="form-timbres" disabled={enviando || !valido}>
          {enviando ? "Enviando a SW…" : tipo === "abono" ? `Abonar ${valido ? num(n) : ""}` : `Retirar ${valido ? num(n) : ""}`}
        </button>
      </>}>
      <SaldoActual saldo={saldo} />
      <form id="form-timbres" className="form" onSubmit={enviar}>
        <Campo etiqueta="Movimiento">
          <Opciones valor={tipo} onCambio={setTipo} opciones={[["abono", "Abonar (dar timbres)"], ["retiro", "Retirar (quitar timbres)"]]} />
        </Campo>
        <Campo etiqueta="Cantidad"
          ayuda={tipo === "abono" && bolsaDisp !== null ? `Salen de tu bolsa en SW (${num(bolsaDisp)} disponibles)` : tipo === "retiro" ? "Regresan a tu bolsa en SW" : ""}>
          <input type="number" min={1} step={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus />
        </Campo>
        <Campo etiqueta="Comentario (queda en el historial)">
          <input value={comentario} onChange={(e) => setComentario(e.target.value)}
            placeholder={tipo === "abono" ? "Ej. paquete de 100 timbres, pago 29/09" : "Ej. corrección de asignación"} />
        </Campo>
        {advertencia && <div className="alerta alerta-aviso">{advertencia}</div>}
        {error && <div className="alerta alerta-error">{error}</div>}
      </form>
    </Modal>
  );
}

// ───────────────────────────── vigencia ─────────────────────────────
export function ModalVigencia({ cuenta, onCerrar, onListo }) {
  const [modo, setModo] = useState("meses");
  const [meses, setMeses] = useState(1);
  const [fechaExacta, setFechaExacta] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const actual = aFecha(cuenta.vigencia_hasta);
  const ahora = new Date();
  const base = actual && actual > ahora ? actual : ahora;
  const nueva = modo === "meses" ? sumarMeses(base, meses) : fechaExacta ? new Date(fechaExacta + "T12:00:00") : null;

  const enviar = async (e) => {
    e.preventDefault();
    if (modo === "fecha" && !fechaExacta) { setError("Elige la fecha."); return; }
    setError("");
    setEnviando(true);
    try {
      await api(`/admin/cuentas/${cuenta.id}/vigencia`, {
        metodo: "POST", cuerpo: modo === "meses" ? { meses } : { fecha: fechaExacta },
      });
      onListo();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Vigencia de la renta" subtitulo={cuenta.nombre} onCerrar={onCerrar} ancho={520}
      pie={<>
        <button className="btn" onClick={onCerrar} disabled={enviando}>Cancelar</button>
        <button className="btn btn-primario" form="form-vigencia" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button>
      </>}>
      <div className="saldo-fila">
        <div><span className="sub">Vence actualmente</span><b>{actual ? fecha(cuenta.vigencia_hasta) : "Sin vencimiento"}</b></div>
        <div><span className="sub">Nueva fecha</span><b className="txt-ok">{nueva ? fecha(nueva.toISOString()) : "—"}</b></div>
      </div>
      <form id="form-vigencia" className="form" onSubmit={enviar}>
        <Opciones valor={modo} onCambio={setModo} opciones={[["meses", "Renovar por meses"], ["fecha", "Fecha exacta"]]} />
        {modo === "meses" ? (
          <Campo etiqueta="Meses a sumar"
            ayuda={actual && actual > ahora ? "Se suman a partir del vencimiento actual" : "Como ya venció (o no tenía fecha), se cuentan desde hoy"}>
            <Opciones valor={meses} onCambio={setMeses} opciones={MESES} />
          </Campo>
        ) : (
          <Campo etiqueta="Vence el" ayuda="Tendrá acceso hasta el final de ese día. Una fecha pasada bloquea la cuenta de inmediato.">
            <input type="date" value={fechaExacta} onChange={(e) => setFechaExacta(e.target.value)} />
          </Campo>
        )}
        {error && <div className="alerta alerta-error">{error}</div>}
      </form>
    </Modal>
  );
}

// ───────────────────────────── historial ─────────────────────────────
export function ModalHistorial({ cuenta, onCerrar }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api(`/admin/cuentas/${cuenta.id}/historial`).then(setFilas).catch((e) => setError(e.message));
  }, [cuenta.id]);

  const totales = useMemo(() => {
    if (!filas) return null;
    return filas.reduce((t, a) => {
      t[a.tipo] += a.cantidad;
      return t;
    }, { abono: 0, retiro: 0 });
  }, [filas]);

  return (
    <Modal titulo="Historial de asignaciones" subtitulo={cuenta.nombre} onCerrar={onCerrar} ancho={820}
      pie={<button className="btn" onClick={onCerrar}>Cerrar</button>}>
      {error && <div className="alerta alerta-error">{error}</div>}
      {!filas && !error && <div className="vacio">Cargando…</div>}
      {filas && filas.length === 0 && <div className="vacio">Aún no hay movimientos de timbres para este cliente.</div>}
      {filas && filas.length > 0 && (
        <>
          <div className="saldo-fila">
            <div><span className="sub">Movimientos</span><b>{num(filas.length)}</b></div>
            <div><span className="sub">Total abonado</span><b className="txt-ok">+{num(totales.abono)}</b></div>
            <div><span className="sub">Total retirado</span><b className="txt-error">−{num(totales.retiro)}</b></div>
          </div>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead>
                <tr><th>Fecha</th><th>Movimiento</th><th className="der">Cantidad</th><th className="der">Saldo después</th><th>Comentario</th><th>Hecho por</th></tr>
              </thead>
              <tbody>
                {filas.map((a) => (
                  <tr key={a.id}>
                    <td>{fechaHora(a.fecha)}</td>
                    <td><span className={`insignia ${a.tipo === "abono" ? "insignia-activa" : "insignia-vencida"}`}>{a.tipo === "abono" ? "Abono" : "Retiro"}</span></td>
                    <td className={`der ${a.tipo === "abono" ? "txt-ok" : "txt-error"}`}><b>{a.tipo === "abono" ? "+" : "−"}{num(a.cantidad)}</b></td>
                    <td className="der">{num(a.saldo_resultante)}</td>
                    <td>{a.comentario || <span className="tenue">—</span>}</td>
                    <td className="sub">{a.realizado_por || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

// ───────────────────────────── usuarios del cliente (roles) ─────────────────────────────
const ROLES_CUENTA = [["admin", "Administrador"], ["escritura", "Facturista"], ["lectura", "Solo consulta"]];
const INSIGNIA_ROL = { admin: "insignia-activa", escritura: "insignia-aviso", lectura: "insignia-suspendida" };
const NOMBRE_ROL = Object.fromEntries(ROLES_CUENTA);

function FormUsuarioCliente({ cuenta, empresas, inicial, onListo, onCancelar, onCredenciales }) {
  const editando = !!inicial;
  const [f, setF] = useState(() => ({
    email: inicial?.email || "", nombre: inicial?.nombre || "", rol: inicial?.rol || "escritura",
    todas: inicial ? inicial.todas_empresas : true, empresas: inicial?.empresas || [],
  }));
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const alternarEmpresa = (id) => setF((x) => ({
    ...x, empresas: x.empresas.includes(id) ? x.empresas.filter((i) => i !== id) : [...x.empresas, id],
  }));

  const guardar = async (e) => {
    e.preventDefault();
    const todas = f.rol === "admin" || f.todas;
    if (!editando && !EMAIL_RE.test(f.email.trim())) { setError("Escribe un correo válido."); return; }
    if (!todas && f.empresas.length === 0) { setError("Elige al menos una empresa, o marca todas."); return; }
    setError("");
    setOcupado(true);
    const cuerpo = { nombre: f.nombre.trim() || null, rol: f.rol, todas_empresas: todas, empresas: todas ? [] : f.empresas };
    try {
      if (editando) {
        await api(`/admin/cuentas/${cuenta.id}/usuarios/${inicial.id}`, { metodo: "PUT", cuerpo });
        onListo();
      } else {
        const r = await api(`/admin/cuentas/${cuenta.id}/usuarios`, { metodo: "POST", cuerpo: { ...cuerpo, email: f.email.trim() } });
        onListo();
        onCredenciales({ usuario: r.email, password_temporal: r.password_temporal, correo_enviado: r.correo_enviado,
          nombre: r.nombre || r.email, titulo: "Usuario agregado" });
      }
    } catch (err) {
      setError(err.message);
      setOcupado(false);
    }
  };

  return (
    <form className="form panel-usuario" onSubmit={guardar}>
      <h3>{editando ? `Editar a ${inicial.email}` : "Nuevo usuario"}</h3>
      <div className="rejilla">
        {!editando && (
          <Campo etiqueta="Correo (será su usuario)" ayuda="Le llegará una contraseña temporal">
            <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoFocus />
          </Campo>
        )}
        <Campo etiqueta="Nombre">
          <input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        </Campo>
        <Campo etiqueta="Rol" ancho="doble">
          <Opciones valor={f.rol} onCambio={(rol) => setF({ ...f, rol })} opciones={ROLES_CUENTA} />
        </Campo>
      </div>
      {f.rol === "admin" ? (
        <p className="sub">El administrador tiene acceso a todas las empresas de la cuenta.</p>
      ) : (
        <Campo etiqueta="Empresas que puede usar">
          <label className="check">
            <input type="checkbox" checked={f.todas} onChange={(e) => setF({ ...f, todas: e.target.checked })} />
            Todas las empresas
          </label>
          {!f.todas && (
            <div className="lista-check">
              {empresas.map((em) => (
                <label key={em.id} className="check">
                  <input type="checkbox" checked={f.empresas.includes(em.id)} onChange={() => alternarEmpresa(em.id)} />
                  <code>{em.rfc}</code> {em.razon_social}
                </label>
              ))}
            </div>
          )}
        </Campo>
      )}
      {error && <div className="alerta alerta-error">{error}</div>}
      <div className="confirmar-botones">
        <button type="button" className="btn" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button className="btn btn-primario" disabled={ocupado}>{ocupado ? "Guardando…" : editando ? "Guardar" : "Agregar usuario"}</button>
      </div>
    </form>
  );
}

function UsuariosCliente({ cuenta, detalle, onCambio, onCredenciales }) {
  const [form, setForm] = useState(null); // "nuevo" | usuario
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const rfcDe = (id) => (detalle.empresas.find((e) => e.id === id) || {}).rfc || `#${id}`;

  const accion = async (u, fn) => {
    setOcupado(u.id);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(null);
    }
  };
  const alternar = (u) => accion(u, async () => {
    await api(`/admin/cuentas/${cuenta.id}/usuarios/${u.id}`, { metodo: "PUT", cuerpo: { activo: !u.activo } });
    onCambio();
  });
  const restablecer = (u) => accion(u, async () => {
    const r = await api(`/admin/cuentas/${cuenta.id}/usuarios/${u.id}/restablecer`, { metodo: "POST" });
    onCredenciales({ ...r, nombre: u.nombre || u.email, titulo: "Contraseña restablecida" });
  });

  return (
    <>
      <div className="detalle-cabeza">
        <h3>Usuarios ({detalle.usuarios.length})</h3>
        {!form && <button className="btn btn-chico" onClick={() => setForm("nuevo")}>+ Agregar usuario</button>}
      </div>
      {form && (
        <FormUsuarioCliente cuenta={cuenta} empresas={detalle.empresas.filter((e) => e.activo)}
          inicial={form === "nuevo" ? null : form} onCancelar={() => setForm(null)}
          onListo={() => { setForm(null); onCambio(); }} onCredenciales={onCredenciales} />
      )}
      {error && <div className="alerta alerta-error">{error}</div>}
      <div className="tabla-envoltura">
        <table className="tabla tabla-usuarios">
          <thead><tr><th>Usuario</th><th>Rol</th><th>Empresas</th><th className="der">Acciones</th></tr></thead>
          <tbody>
            {detalle.usuarios.map((u) => (
              <tr key={u.id}>
                <td>
                  <div>{u.email}{!u.activo && <span className="insignia insignia-suspendida">Inactivo</span>}</div>
                  <div className="sub">{u.nombre ? `${u.nombre} · ` : ""}{u.ultimo_acceso ? `Último acceso ${fechaHora(u.ultimo_acceso)}` : "Nunca ha entrado"}</div>
                </td>
                <td><span className={`insignia ${INSIGNIA_ROL[u.rol] || "insignia-suspendida"}`}>{NOMBRE_ROL[u.rol] || u.rol}</span></td>
                <td className="sub">{u.todas_empresas ? "Todas" : u.empresas.map(rfcDe).join(", ")}</td>
                <td className="der">
                  <div className="acciones">
                    <button className="btn btn-chico" onClick={() => setForm(u)} disabled={!!form}>Editar</button>
                    <button className="btn btn-chico" onClick={() => restablecer(u)} disabled={ocupado === u.id}>Contraseña</button>
                    <button className={`btn btn-chico ${u.activo ? "btn-peligro" : ""}`} onClick={() => alternar(u)} disabled={ocupado === u.id}>
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ───────────────────────────── detalle ─────────────────────────────
export function ModalDetalle({ cuenta, onCerrar, onCambio, onCredenciales }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [confirmar, setConfirmar] = useState(null); // "suspender" | "reactivar" | "restablecer"
  const [ocupado, setOcupado] = useState(false);

  const cargar = () => api(`/admin/cuentas/${cuenta.id}`).then(setD).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [cuenta.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const empezarEdicion = () => {
    setForm({ nombre: d.nombre, email_contacto: d.email_contacto || "", telefono: d.telefono || "", max_rfcs: d.max_rfcs, notas: d.notas || "" });
    setEditando(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    const max = Number(form.max_rfcs);
    if (!form.nombre.trim()) { setError("El nombre no puede quedar vacío."); return; }
    if (!(max >= 1 && max <= 500)) { setError("Los RFC permitidos deben estar entre 1 y 500."); return; }
    setOcupado(true);
    setError("");
    try {
      await api(`/admin/cuentas/${cuenta.id}`, {
        metodo: "PUT",
        cuerpo: { nombre: form.nombre.trim(), email_contacto: form.email_contacto.trim() || null,
          telefono: form.telefono.trim() || null, max_rfcs: max, notas: form.notas.trim() || null },
      });
      setEditando(false);
      await cargar();
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const ejecutar = async () => {
    setOcupado(true);
    setError("");
    try {
      if (confirmar === "restablecer") {
        const r = await api(`/admin/cuentas/${cuenta.id}/restablecer-acceso`, { metodo: "POST" });
        onCambio();
        onCredenciales({ ...r, nombre: d.nombre });
        return;
      }
      await api(`/admin/cuentas/${cuenta.id}/estado`, { metodo: "POST", cuerpo: { activo: confirmar === "reactivar" } });
      setConfirmar(null);
      await cargar();
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  const TEXTO_CONFIRMAR = {
    suspender: "El cliente no podrá entrar al sistema y su subcuenta en SW quedará desactivada hasta que lo reactives.",
    reactivar: "El cliente podrá volver a entrar (si su vigencia está al corriente) y su subcuenta en SW se reactivará.",
    restablecer: "Se generará una nueva contraseña temporal y la anterior dejará de funcionar.",
  };

  return (
    <Modal titulo={d?.nombre || cuenta.nombre} subtitulo={d ? `${nombrePlan(d.max_rfcs)} · cliente desde ${fecha(d.creado_en)}` : ""}
      onCerrar={onCerrar} ancho={820}
      pie={d && !editando && !confirmar && <>
        <button className="btn" onClick={() => setConfirmar("restablecer")}>Restablecer acceso</button>
        {d.activo
          ? <button className="btn btn-peligro" onClick={() => setConfirmar("suspender")}>Suspender</button>
          : <button className="btn btn-primario" onClick={() => setConfirmar("reactivar")}>Reactivar</button>}
        <button className="btn" onClick={onCerrar}>Cerrar</button>
      </>}>
      {error && <div className="alerta alerta-error">{error}</div>}
      {!d && !error && <div className="vacio">Cargando…</div>}

      {d && confirmar && (
        <div className={`confirmar ${confirmar === "suspender" ? "confirmar-peligro" : ""}`}>
          <p><b>{confirmar === "suspender" ? "¿Suspender a este cliente?" : confirmar === "reactivar" ? "¿Reactivar a este cliente?" : "¿Restablecer su acceso?"}</b></p>
          <p>{TEXTO_CONFIRMAR[confirmar]}</p>
          <div className="confirmar-botones">
            <button className="btn" onClick={() => setConfirmar(null)} disabled={ocupado}>Cancelar</button>
            <button className={`btn ${confirmar === "suspender" ? "btn-peligro" : "btn-primario"}`} onClick={ejecutar} disabled={ocupado}>
              {ocupado ? "Un momento…" : "Sí, continuar"}
            </button>
          </div>
        </div>
      )}

      {d && d.motivo_bloqueo && !confirmar && <div className="alerta alerta-aviso">Bloqueado: {d.motivo_bloqueo}</div>}

      {d && !editando && (
        <div className="detalle">
          <div className="detalle-cabeza">
            <h3>Datos del cliente</h3>
            <button className="btn btn-chico" onClick={empezarEdicion}>Editar</button>
          </div>
          <dl className="datos">
            <dt>Usuario de acceso</dt><dd>{d.usuario || "—"}</dd>
            <dt>Correo de contacto</dt><dd>{d.email_contacto || "—"}</dd>
            <dt>Teléfono</dt><dd>{d.telefono || "—"}</dd>
            <dt>RFC</dt><dd>{d.rfcs_usados} de {d.max_rfcs} permitidos</dd>
            <dt>Vigencia</dt><dd>{d.vigencia_hasta ? fecha(d.vigencia_hasta) : "Sin vencimiento"}</dd>
            <dt>Subcuenta SW</dt><dd className="sub">{d.sw_user_id || "—"}</dd>
            <dt>Notas</dt><dd>{d.notas || <span className="tenue">—</span>}</dd>
          </dl>
          <h3>Timbres</h3>
          <SaldoActual saldo={d.saldo} />
          <h3>Empresas ({d.empresas.length})</h3>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>RFC</th><th>Razón social</th><th>Certificado (CSD)</th></tr></thead>
              <tbody>
                {d.empresas.map((e) => (
                  <tr key={e.id}>
                    <td><code>{e.rfc}</code>{!e.activo && <span className="insignia insignia-suspendida">Inactiva</span>}</td>
                    <td>{e.razon_social}</td>
                    <td>{e.tiene_csd ? `Vence ${fecha(e.csd_valido_hasta)}` : <span className="txt-aviso">Sin cargar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <UsuariosCliente cuenta={cuenta} detalle={d} onCredenciales={onCredenciales}
            onCambio={() => { cargar(); onCambio(); }} />
        </div>
      )}

      {d && editando && (
        <form className="form" onSubmit={guardar}>
          <div className="rejilla">
            <Campo etiqueta="Nombre del cliente" ancho="doble">
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            </Campo>
            <Campo etiqueta="Correo de contacto" ayuda="No cambia su usuario de acceso">
              <input type="email" value={form.email_contacto} onChange={(e) => setForm({ ...form, email_contacto: e.target.value })} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            </Campo>
            <Campo etiqueta="RFC permitidos" ayuda={`Plan: ${nombrePlan(Number(form.max_rfcs))}. Ya usa ${d.rfcs_usados}.`}>
              <input type="number" min={1} max={500} value={form.max_rfcs} onChange={(e) => setForm({ ...form, max_rfcs: e.target.value })} />
            </Campo>
          </div>
          <Campo etiqueta="Notas internas">
            <textarea rows={3} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </Campo>
          <div className="confirmar-botones">
            <button type="button" className="btn" onClick={() => setEditando(false)} disabled={ocupado}>Cancelar</button>
            <button className="btn btn-primario" disabled={ocupado}>{ocupado ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
