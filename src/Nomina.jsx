import { useCallback, useEffect, useState } from "react";
import { api } from "./api.js";

// Valores oficiales de cada año para el cálculo de nómina de los clientes
// (UMA, tarifas de retención del ISR, subsidio para el empleo, cuotas obreras del IMSS)
const TARIFAS = [
  { clave: "diaria", texto: "Diaria (y periodos sin tarifa propia: diaria × días)" },
  { clave: "7", texto: "Semanal (7 días)" },
  { clave: "10", texto: "Decenal (10 días)" },
  { clave: "15", texto: "Quincenal (15 días)" },
  { clave: "mensual", texto: "Mensual" },
];
const IMSS = [
  { clave: "excedente", texto: "Enfermedad y maternidad, excedente de 3 UMA (%)" },
  { clave: "prestaciones_dinero", texto: "Prestaciones en dinero (%)" },
  { clave: "gastos_medicos", texto: "Gastos médicos de pensionados (%)" },
  { clave: "invalidez_vida", texto: "Invalidez y vida (%)" },
  { clave: "cesantia_vejez", texto: "Cesantía y vejez (%)" },
  { clave: "tope_umas", texto: "Tope del SBC (UMA)" },
];
const ESCALARES = [
  { clave: "uma_diaria", texto: "UMA diaria" },
  { clave: "uma_mensual", texto: "UMA mensual" },
  { clave: "uma_vigente_desde", texto: "UMA vigente desde", tipo: "date" },
  { clave: "uma_anterior_diaria", texto: "UMA anterior diaria (antes de esa fecha)" },
  { clave: "uma_anterior_mensual", texto: "UMA anterior mensual" },
  { clave: "salario_minimo", texto: "Salario mínimo general" },
  { clave: "salario_minimo_frontera", texto: "Salario mínimo zona frontera norte" },
  { clave: "subsidio_porcentaje", texto: "Subsidio para el empleo (% de la UMA mensual)" },
  { clave: "subsidio_porcentaje_enero", texto: "Subsidio de enero (% sobre la UMA anterior)" },
  { clave: "subsidio_limite_mensual", texto: "Límite de ingresos para el subsidio (mensual)" },
];

// Una tarifa se edita como texto: un renglón por línea "inferior superior cuota %"; el último sin superior
const aTexto = (filas) => (filas || []).map((f) => [f[0], f[1] ?? "En adelante", f[2], f[3]].join("  ")).join("\n");
const deTexto = (texto) => texto.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const p = l.replace(/,/g, "").replace(/en adelante/i, "-").split(/\s+/);
  return [p[0], p[1] === "-" ? null : p[1], p[2], p[3]];
});

function aFormulario(p) {
  const f = {};
  ESCALARES.forEach((e) => { f[e.clave] = p[e.clave] ?? ""; });
  IMSS.forEach((e) => { f["imss_" + e.clave] = (p.imss || {})[e.clave] ?? ""; });
  TARIFAS.forEach((t) => { f["tarifa_" + t.clave] = aTexto((p.tarifas || {})[t.clave]); });
  return f;
}

export default function Nomina() {
  const [lista, setLista] = useState(null);
  const [anio, setAnio] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async (elegir) => {
    setError("");
    try {
      const d = await api("/admin/nomina/parametros");
      setLista(d);
      const sel = d.find((x) => x.anio === elegir) || d[0];
      if (sel) { setAnio(sel.anio); setForm(aFormulario(sel)); }
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (a) => {
    const p = lista.find((x) => x.anio === a);
    setAnio(a); setForm(aFormulario(p)); setOk(""); setError("");
  };
  const nuevoAnio = () => {
    const sig = Math.max(...lista.map((x) => x.anio)) + 1;
    if (!window.confirm(`¿Crear ${sig} copiando los valores de ${anio}? Después captura los oficiales de ${sig}.`)) return;
    setAnio(sig); setOk(""); setError("");    // el formulario conserva los valores del año copiado
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    setGuardando(true); setError(""); setOk("");
    try {
      const cuerpo = { tarifas: {}, imss: {} };
      ESCALARES.forEach((e) => {
        const v = form[e.clave];
        cuerpo[e.clave] = e.tipo === "date" ? v : (String(v).trim() === "" ? null : Number(v));
      });
      IMSS.forEach((e) => { cuerpo.imss[e.clave] = Number(form["imss_" + e.clave]); });
      TARIFAS.forEach((t) => { cuerpo.tarifas[t.clave] = deTexto(form["tarifa_" + t.clave]); });
      const r = await api(`/admin/nomina/parametros/${anio}`, { metodo: "PUT", cuerpo });
      setOk(r.mensaje);
      await cargar(anio);
    } catch (e) { setError(e.message); } finally { setGuardando(false); }
  };

  if (!lista || !form) {
    return <section className="panel">{error ? <div className="alerta alerta-error">{error}</div> : <div className="vacio">Cargando…</div>}</section>;
  }
  const existe = lista.some((x) => x.anio === anio);

  return (
    <section className="panel">
      <div className="panel-barra">
        <div className="segmentos">
          {lista.map((x) => (
            <button key={x.anio} type="button" className={x.anio === anio ? "activo" : ""} onClick={() => elegir(x.anio)}>{x.anio}</button>
          ))}
          {!existe && <button type="button" className="activo">{anio} (nuevo)</button>}
        </div>
        <button type="button" className="btn" onClick={nuevoAnio}>+ Nuevo año</button>
      </div>
      <div className="modal-cuerpo">
        <p className="ayuda">
          Valores oficiales para el cálculo automático de los recibos de nómina de {anio}. Fuentes: UMA del INEGI, tarifas del
          Anexo 8 de la RMF (DOF), decreto del subsidio para el empleo y Ley del Seguro Social. Revísalos con el contador antes de guardarlos.
        </p>
        {error && <div className="alerta alerta-error">{error}</div>}
        {ok && <div className="alerta alerta-ok">{ok}</div>}
        <div className="form">
          <h3>UMA, salario mínimo y subsidio</h3>
          <div className="rejilla">
            {ESCALARES.map((e) => (
              <label key={e.clave} className="campo">
                <span>{e.texto}</span>
                <input type={e.tipo || "text"} inputMode={e.tipo ? undefined : "decimal"} value={form[e.clave] ?? ""} onChange={set(e.clave)} />
              </label>
            ))}
          </div>
          <h3>Cuotas obreras del IMSS</h3>
          <div className="rejilla">
            {IMSS.map((e) => (
              <label key={e.clave} className="campo">
                <span>{e.texto}</span>
                <input inputMode="decimal" value={form["imss_" + e.clave]} onChange={set("imss_" + e.clave)} />
              </label>
            ))}
          </div>
          <h3>Tarifas de retención del ISR (art. 96)</h3>
          <p className="ayuda">Un renglón por línea: límite inferior, límite superior, cuota fija y porcentaje, separados por espacios. El último renglón lleva «En adelante».</p>
          <div className="rejilla">
            {TARIFAS.map((t) => (
              <label key={t.clave} className="campo">
                <span>{t.texto}</span>
                <textarea rows={11} spellCheck={false} style={{ fontFamily: "Consolas, monospace", fontSize: 12 }}
                  value={form["tarifa_" + t.clave]} onChange={set("tarifa_" + t.clave)} />
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="modal-pie">
        <button type="button" className="btn btn-primario" onClick={guardar} disabled={guardando}>{guardando ? "Guardando…" : `Guardar ${anio}`}</button>
      </div>
    </section>
  );
}
