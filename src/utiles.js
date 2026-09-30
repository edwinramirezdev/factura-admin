// El backend guarda las fechas en UTC; si llegan sin zona horaria se interpretan como UTC.
export function aFecha(iso) {
  if (!iso) return null;
  const tieneZona = /[zZ]$|[+-]\d\d:?\d\d$/.test(iso);
  const d = new Date(tieneZona || iso.length <= 10 ? iso : iso + "Z");
  return isNaN(d) ? null : d;
}

const fmtFecha = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const fmtNum = new Intl.NumberFormat("es-MX");

export const fecha = (iso) => {
  const d = aFecha(iso);
  return d ? fmtFecha.format(d) : "—";
};
export const fechaHora = (iso) => {
  const d = aFecha(iso);
  return d ? fmtFechaHora.format(d) : "—";
};
export const num = (n) => (n === null || n === undefined ? "—" : fmtNum.format(n));

export function diasRestantes(iso) {
  const d = aFecha(iso);
  if (!d) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// Misma regla que el backend: se suman meses respetando el fin de mes
export function sumarMeses(base, meses) {
  const d = new Date(base.getTime());
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d;
}

export function fechaInput(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const PLANES = [
  { nombre: "Uni-RFC", rfcs: 1 },
  { nombre: "Multi-RFC", rfcs: 5 },
  { nombre: "Multi-RFC Plus", rfcs: 25 },
];
export const nombrePlan = (n) => PLANES.find((p) => p.rfcs === n)?.nombre || `Personalizado (${n} RFC)`;

export const REGIMENES = [
  ["601", "General de Ley Personas Morales"],
  ["603", "Personas Morales con Fines no Lucrativos"],
  ["605", "Sueldos y Salarios e Ingresos Asimilados a Salarios"],
  ["606", "Arrendamiento"],
  ["607", "Régimen de Enajenación o Adquisición de Bienes"],
  ["608", "Demás ingresos"],
  ["610", "Residentes en el Extranjero sin Establecimiento Permanente en México"],
  ["611", "Ingresos por Dividendos (socios y accionistas)"],
  ["612", "Personas Físicas con Actividades Empresariales y Profesionales"],
  ["614", "Ingresos por intereses"],
  ["615", "Régimen de los ingresos por obtención de premios"],
  ["616", "Sin obligaciones fiscales"],
  ["620", "Sociedades Cooperativas de Producción que optan por diferir sus ingresos"],
  ["621", "Incorporación Fiscal"],
  ["622", "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras"],
  ["623", "Opcional para Grupos de Sociedades"],
  ["624", "Coordinados"],
  ["625", "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas"],
  ["626", "Régimen Simplificado de Confianza"],
];
