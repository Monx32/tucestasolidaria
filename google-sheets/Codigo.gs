/**
 * TU CESTA SOLIDARIA · Base de datos de solicitudes + correo automático
 * ----------------------------------------------------------------------
 * Cómo instalarlo (una sola vez):
 *  1. Con la cuenta tucestasolidaria.navidad@gmail.com crea una hoja de cálculo nueva en sheets.new
 *     y llámala «Tu Cesta Solidaria · Solicitudes».
 *  2. Menú Extensiones → Apps Script. Borra lo que haya y pega TODO este archivo. Guarda (icono del disquete).
 *  3. Arriba, elige la función «configurar» y pulsa Ejecutar. Acepta los permisos que pide Google
 *     (si avisa de «app no verificada»: Configuración avanzada → Ir a … (no seguro)). Se crea la pestaña «Solicitudes».
 *  4. Implementar → Nueva implementación → tipo «Aplicación web».
 *       Ejecutar como: Yo   ·   Quién tiene acceso: Cualquier usuario   → Implementar.
 *  5. Copia la «URL de la aplicación web» (acaba en /exec) y pásasela a Claude para conectarla a la web.
 *
 * Cada vez que alguien pulsa «Pedir información» en la web:
 *  - se añade una fila en «Solicitudes» (fecha, empresa, correo, cesta, mensaje, estado…)
 *  - os llega un correo a NOTIFY_TO con sus datos y su mensaje, y al cliente una confirmación
 * Cada vez que alguien pulsa «Mandar propuesta»:
 *  - se añade una fila en «Propuestas» (cestas, unidades, total, dirección de envío…)
 *  - os llega un correo a NOTIFY_TO con toda la propuesta, y al cliente un resumen
 */

const SITE = "https://tucestasolidaria.vercel.app";
const NOTIFY_TO = "tucestasolidaria.navidad@gmail.com";
const SHEET = "Solicitudes";
const HEADERS = ["Fecha", "Nombre", "Empresa", "Correo", "Cesta", "Precio (IVA incl.)", "Correo automático", "Estado", "Responsable", "Notas", "Mensaje del cliente"];
const SHEET_P = "Propuestas";
const HEADERS_P = ["Fecha", "Empresa", "Correo", "Cestas", "Unidades", "Total estimado (IVA incl.)", "Dirección de envío", "Población", "CP", "Comentarios", "Correo automático", "Estado", "Responsable", "Notas"];
const ESTADOS = ["Pendiente", "Contactado", "Presupuesto enviado", "Pedido cerrado", "Descartado"];
const FREE_SHIP = 800; // envío gratis desde esta base imponible (sin IVA), un único punto en la península
const HIGHLIGHTS = ["lote-5", "lote-11", "jamonero-21", "cesta-41"];


// Plantillas de los correos automáticos de «Pedir información».
// Diseño en tablas con estilos en línea para que se vea bien en Gmail, Outlook y móvil.

const C = { cream: "#FBF6EC", card: "#FFFFFF", navy: "#1E3968", muted: "#56627F", gold: "#96722C", goldBg: "#CBA960", line: "#EDE3CF", green: "#48613B", greenBg: "#EEF1E6", rasp: "#B84362" };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";
const CONTACT = { email: "tucestasolidaria.navidad@gmail.com", phone: "688 655 283", wa: "34688655283" };
const LEGAL = "Asociación Jóven Empresa Imperia TC · NIF G05739461 (provisional) · Plaza de San Martín, 1, 28013 Madrid";

const eur = (n) => { const [i, d] = Number(n).toFixed(2).split("."); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d + "\u00a0€"; };
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const first = (name) => String(name || "").split(" ")[0];
const greetName = (name, company) => (name ? first(name) : company && !isParticular(company) ? company : "");
const isParticular = (company) => /^particular$/i.test(String(company || "").trim());

const button = (href, label, bg, color, border = bg) =>
  `<a href="${href}" style="display:inline-block;background:${bg};color:${color};border:1px solid ${border};border-radius:999px;padding:13px 26px;font-family:${SANS};font-size:14px;font-weight:bold;text-decoration:none;margin:4px 6px 4px 0">${label}</a>`;

const shell = ({ preheader, body }) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>Tu Cesta Solidaria</title></head>
<body style="margin:0;padding:0;background:${C.cream}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream}"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="padding:0 6px 22px;font-family:${SANS};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold}">
    <span style="color:${C.rasp}">&#10084;</span>&nbsp; Tu Cesta Solidaria · Navidad 2026
  </td></tr>
  ${body}
  <tr><td style="padding:30px 6px 0;font-family:${SERIF};font-style:italic;font-size:20px;color:${C.gold}">Regalar es recordar.</td></tr>
  <tr><td style="padding:6px 6px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.muted}">Un abrazo,<br><strong style="color:${C.navy}">El equipo de Tu Cesta Solidaria</strong><br>${CONTACT.email} · ${CONTACT.phone}</td></tr>
  <tr><td style="padding:28px 6px 0"><div style="border-top:1px solid ${C.line}"></div></td></tr>
  <tr><td style="padding:14px 6px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#8E93A6">
    Has recibido este correo porque lo pediste en nuestra web. No te enviaremos publicidad. Puedes pedirnos que borremos tus datos respondiendo a este mensaje.<br>${LEGAL}
  </td></tr>
</table></td></tr></table></body></html>`;

const afeam = (txt) => `
  <tr><td style="padding:18px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.greenBg};border-radius:10px"><tr>
    <td style="padding:18px 22px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.green}">
      <strong style="font-family:${SERIF};font-size:22px;font-weight:normal">10%</strong>&nbsp; ${txt}
    </td></tr></table></td></tr>`;

const nextSteps = (b) => {
  const opts = [
    ["Quiero un presupuesto", "Hola, quiero un presupuesto.\nNúmero de cestas:\nFecha de entrega:\nLugar de entrega:"],
    ["Busco algo según mi presupuesto", "Hola, busco cestas de unos ___ € por persona para ___ personas."],
    ["Quiero personalizarlas (tarjeta, logo…)", "Hola, nos gustaría personalizar las cestas con:"],
    ["Necesito entregas en varias direcciones", "Hola, necesitaríamos entregar en estas direcciones:"],
    ["Tengo otra pregunta", "Hola, quería preguntaros:"],
  ];
  const opt = ([label, text]) => {
    const subject = encodeURIComponent((b ? b.name + " · " : "") + label);
    return `<a href="mailto:${CONTACT.email}?subject=${subject}&body=${encodeURIComponent(text + "\n\n")}" style="display:block;background:${C.card};border:1px solid ${C.line};border-radius:12px;padding:14px 18px;margin:0 0 10px;font-family:${SANS};font-size:15px;color:${C.navy};text-decoration:none"><span style="color:${C.gold}">&#10148;</span>&nbsp; ${label}</a>`;
  };
  return `
  <tr><td style="padding:26px 6px 0">
    <h2 style="margin:0 0 8px;font-family:${SERIF};font-weight:normal;font-size:26px;color:${C.navy}">¿Qué te interesaría saber?</h2>
    <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted}">Pulsa la opción que más se acerque y se abrirá un correo para contestarnos en un momento. Te respondemos en 24–48 h laborables, sin compromiso.</p>
  </td></tr>
  <tr><td style="padding:0">${opts.map(opt).join("")}</td></tr>
  <tr><td style="padding:6px 6px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted}">O escríbenos por <a href="https://wa.me/${CONTACT.wa}?text=${encodeURIComponent(b ? "Hola, me interesa el " + b.name + "." : "Hola, me interesan vuestras cestas.")}" style="color:${C.green};font-weight:bold">WhatsApp</a> o llámanos al ${CONTACT.phone}.</td></tr>`;
};

function basketBlock(b, site) {
  const img = `${site}/img/email/${b.id}.jpg`;
  const cats = (b.categories || []).filter((c) => c.name !== "Embalaje");
  const pack = (b.categories || []).find((c) => c.name === "Embalaje");
  const list = cats.map((c) => `
      <tr><td style="padding:14px 0 4px;font-family:${SANS};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.gold}">${esc(c.name)}</td></tr>
      ${c.items.map((i) => `<tr><td style="padding:3px 0;font-family:${SANS};font-size:14px;line-height:1.45;color:${C.navy}"><span style="color:${C.gold}">${i.qty}&times;</span>&nbsp; ${esc(i.name)}</td></tr>`).join("")}`).join("");
  return `
  <tr><td style="background:${C.card};border-radius:14px;padding:0;border:1px solid ${C.line}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:22px 22px 6px"><img src="${img}" width="440" alt="${esc(b.name)}" style="display:block;width:100%;max-width:440px;height:auto;border:0"></td></tr>
      <tr><td style="padding:10px 26px 0;font-family:${SERIF};font-size:30px;color:${C.navy}">${esc(b.name)}</td></tr>
      <tr><td style="padding:2px 26px 0;font-family:${SERIF};font-style:italic;font-size:17px;color:${C.muted}">${esc(b.tagline || "")}</td></tr>
      <tr><td style="padding:14px 26px 0;font-family:'Courier New',monospace;font-size:28px;font-weight:bold;color:${C.gold}">${eur(b.price)}</td></tr>
      <tr><td style="padding:2px 26px 0;font-family:${SANS};font-size:12px;color:${C.muted}">IVA incluido · ${eur(b.base)} + ${eur(b.iva)} de IVA</td></tr>
      <tr><td style="padding:16px 26px 0"><div style="border-top:1px solid ${C.line}"></div></td></tr>
      <tr><td style="padding:2px 26px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list}</table></td></tr>
      ${pack ? `<tr><td style="padding:14px 26px 0;font-family:${SANS};font-size:13px;color:${C.muted}">Presentación: ${esc(pack.items.map((i) => i.name).join(" · "))}</td></tr>` : ""}
      <tr><td style="padding:20px 26px 24px">${button(`${site}/#catalogo`, "Ver más cestas", C.navy, "#F8F1E3")}</td></tr>
    </table>
  </td></tr>`;
}

function highlightsBlock(list, site) {
  const cell = (b) => `<td width="50%" valign="top" style="padding:6px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-radius:12px"><tr><td style="padding:12px">
        <img src="${site}/img/email/${b.id}.jpg" width="240" alt="${esc(b.name)}" style="display:block;width:100%;height:auto;border:0">
        <p style="margin:10px 0 0;font-family:${SERIF};font-size:18px;color:${C.navy}">${esc(b.name)}</p>
        <p style="margin:2px 0 0;font-family:'Courier New',monospace;font-size:14px;font-weight:bold;color:${C.gold}">${eur(b.price)}</p>
      </td></tr></table></td>`;
  const rows = [];
  for (let i = 0; i < list.length; i += 2) rows.push(`<tr>${cell(list[i])}${list[i + 1] ? cell(list[i + 1]) : "<td></td>"}</tr>`);
  return `
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table></td></tr>
  <tr><td style="padding:14px 6px 0">${button(`${site}/#catalogo`, "Ver las 85 cestas", C.navy, "#F8F1E3")}</td></tr>`;
}

function renderClientEmail({ name, company, basket, site, highlights, questions }) {
  const hi = esc(greetName(name, company));
  const intro = basket
    ? `Gracias por interesarte por el <strong style="color:${C.navy}">${esc(basket.name)}</strong>${isParticular(company) ? "" : ` para <strong style="color:${C.navy}">${esc(company)}</strong>`}. Aquí tienes todo lo que lleva, con su precio final.`
    : `Gracias por tu interés en nuestras cestas de Navidad${isParticular(company) ? "" : ` para <strong style="color:${C.navy}">${esc(company)}</strong>`}. Tenemos 85 cestas y lotes, desde detalles para todo el equipo hasta grandes cestas con jamón ibérico. Te dejamos algunas de las más pedidas.`;
  const body = `
  <tr><td style="padding:0 6px 20px">
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:34px;line-height:1.15;color:${C.navy}">Hola${hi ? ", " + hi : ""}</h1>
    <p style="margin:12px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.muted}">${intro}</p>
  </td></tr>
  ${questions ? `<tr><td style="padding:0 0 18px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line};border-left:4px solid ${C.goldBg};border-radius:10px"><tr><td style="padding:16px 20px;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.muted}"><strong style="color:${C.navy}">Hemos recibido tu mensaje</strong> y te responderemos personalmente en 24–48 h laborables:<br><span style="display:block;margin-top:8px;color:${C.navy};font-style:italic">«${esc(questions).replace(/\n/g, "<br>")}»</span></td></tr></table></td></tr>` : ""}
  ${basket ? basketBlock(basket, site) : highlightsBlock(highlights, site)}
  ${afeam(basket ? "de nuestro beneficio con esta cesta va a la Fundación AFEAM, que acompaña a personas con Alzheimer y a sus familias." : "de nuestro beneficio en cada cesta va a la Fundación AFEAM, que acompaña a personas con Alzheimer y a sus familias.")}
  ${nextSteps(basket)}`;
  const subject = basket ? `Tu consulta sobre el ${basket.name} · Tu Cesta Solidaria` : "Hemos recibido tu mensaje · Tu Cesta Solidaria";
  const preheader = basket ? `${basket.name}: ${basket.tagline || ""} · ${eur(basket.price)} IVA incluido` : "85 cestas y lotes de Navidad. El 10% de nuestro beneficio va a la Fundación AFEAM.";
  const text = [
    `Hola${greetName(name, company) ? ", " + greetName(name, company) : ""}:`,
    ...(questions ? ["", "Hemos recibido tu mensaje y te responderemos en 24–48 h laborables:", questions] : []),
    "",
    basket ? `Gracias por interesarte por el ${basket.name}. ${basket.tagline || ""}` : "Gracias por tu interés en nuestras cestas de Navidad.",
    basket ? `Precio: ${eur(basket.price)} (IVA incluido)` : "",
    ...(basket ? (basket.categories || []).filter((c) => c.name !== "Embalaje").flatMap((c) => ["", c.name.toUpperCase(), ...c.items.map((i) => `${i.qty} x ${i.name}`)]) : []),
    "",
    "El 10% de nuestro beneficio va a la Fundación AFEAM.",
    "",
    "¿Qué te interesaría saber? Responde a este correo: presupuesto, personalización, entregas en varias direcciones u otra pregunta.",
    `WhatsApp: ${CONTACT.phone} · ${site}`,
    "",
    "Un abrazo,",
    "El equipo de Tu Cesta Solidaria",
    "",
    LEGAL,
  ].join("\n");
  return { subject, html: shell({ preheader, body }), text };
}

function renderNotifyEmail({ name, company, email, basket, questions }) {
  const rows = [...(name ? [["Nombre", name]] : []), ["Empresa", company], ["Correo", email], ["Cesta", basket ? `${basket.name} · ${eur(basket.price)}` : "Catálogo general"], ...(questions ? [["Mensaje", questions]] : [])];
  const body = `
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:24px 26px">
    <h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:normal;font-size:26px;color:${C.navy}">Nuevo mensaje · Pedir información</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${SANS};font-size:15px;line-height:1.8;color:${C.navy}">
      ${rows.map(([k, v]) => `<tr><td valign="top" style="padding-right:18px;color:${C.muted}">${k}</td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}
    </table>
    <p style="margin:16px 0 0;font-family:${SANS};font-size:13px;color:${C.muted}">Ya le hemos enviado el correo automático. Si respondes a este mensaje, le escribes directamente.</p>
  </td></tr>`;
  return {
    subject: `✉️ Pedir información: ${company} · ${basket ? basket.name : "catálogo"}`,
    html: shell({ preheader: `${company} (${email}) ha escrito desde la web`, body }),
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}


// «Mandar propuesta»: resumen del carrito (para vosotros y para el cliente)
function linesTable(lines, total) {
  const td = `font-family:${SANS};font-size:14px;line-height:1.5;color:${C.navy};padding:8px 0;border-bottom:1px solid ${C.line}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${lines.map((l) => `<tr><td style="${td}"><span style="color:${C.gold}">${l.qty}&times;</span>&nbsp; ${esc(l.b.name)}</td><td align="right" style="${td};font-family:'Courier New',monospace;white-space:nowrap">${eur(l.b.price)} · <strong>${eur(l.qty * l.b.price)}</strong></td></tr>`).join("")}
    <tr><td style="font-family:${SANS};font-size:14px;color:${C.muted};padding:12px 0 0">Total estimado (IVA incluido)</td><td align="right" style="font-family:'Courier New',monospace;font-size:22px;font-weight:bold;color:${C.gold};padding:12px 0 0">${eur(total)}</td></tr>
  </table>`;
}

function renderProposalEmails(p) {
  const where = `${p.address}, ${p.postal_code} ${p.city}`;
  const units = p.lines.reduce((n, l) => n + l.qty, 0);
  const base = p.lines.reduce((n, l) => n + l.qty * l.b.base, 0);
  const ship = base >= FREE_SHIP ? `Gratis (pedido de ${eur(base)} sin IVA, desde ${eur(FREE_SHIP)})` : `A presupuestar (faltan ${eur(FREE_SHIP - base)} sin IVA para el envío gratis)`;
  const rows = [["Correo", p.email], ["Empresa", p.company || "—"], ["Entrega en", where], ["Envío", ship], ...(p.notes ? [["Comentarios", p.notes]] : [])];
  const dataTable = `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.navy}">
      ${rows.map(([k, v]) => `<tr><td valign="top" style="padding-right:18px;color:${C.muted};white-space:nowrap">${k}</td><td>${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("")}
    </table>`;
  const notify = {
    subject: `🧺 Nueva propuesta: ${p.company || p.email} · ${units} ${units === 1 ? "cesta" : "cestas"} · ${eur(p.total)}`,
    html: shell({ preheader: `${p.company || p.email} propone ${units} cestas para ${p.city}`, body: `
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:24px 26px">
    <h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:normal;font-size:26px;color:${C.navy}">Nueva propuesta de pedido</h1>
    ${linesTable(p.lines, p.total)}
    ${dataTable}
    <p style="margin:16px 0 0;font-family:${SANS};font-size:13px;color:${C.muted}">Guardada en la hoja «${SHEET_P}». Si respondes a este mensaje, le escribes directamente.</p>
  </td></tr>` }),
    text: [...p.lines.map((l) => `${l.qty} x ${l.b.name} (${eur(l.b.price)}) = ${eur(l.qty * l.b.price)}`), `TOTAL estimado: ${eur(p.total)}`, "", ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n"),
  };
  const hi = greetName("", p.company);
  const client = {
    subject: "Hemos recibido tu propuesta · Tu Cesta Solidaria",
    html: shell({ preheader: `${units} ${units === 1 ? "cesta" : "cestas"} · ${eur(p.total)} IVA incluido. Te confirmamos en 24–48 h.`, body: `
  <tr><td style="padding:0 6px 20px">
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:34px;line-height:1.15;color:${C.navy}">Hola${hi ? ", " + esc(hi) : ""}</h1>
    <p style="margin:12px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.muted}">Gracias por tu propuesta. La revisamos y te enviamos en 24–48 h laborables el presupuesto definitivo con disponibilidad y envío. No tienes que pagar nada todavía.</p>
  </td></tr>
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:22px 26px">
    ${linesTable(p.lines, p.total)}
    ${dataTable}
  </td></tr>
  ${afeam("de nuestro beneficio con estas cestas va a la Fundación AFEAM, que acompaña a personas con Alzheimer y a sus familias.")}
  <tr><td style="padding:22px 6px 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted}">¿Quieres cambiar algo? Responde a este correo o escríbenos por <a href="https://wa.me/${CONTACT.wa}" style="color:${C.green};font-weight:bold">WhatsApp</a> al ${CONTACT.phone}.</td></tr>` }),
    text: ["Hola:", "", "Gracias por tu propuesta. Te enviamos el presupuesto definitivo en 24–48 h laborables.", "", notify.text, "", "El 10% de nuestro beneficio va a la Fundación AFEAM.", "", "El equipo de Tu Cesta Solidaria", LEGAL].join("\n"),
  };
  return { notify, client };
}


// ---------------------------------------------------------------------------

function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.getSheets()[0].getName() === "Hoja 1" || ss.getSheets()[0].getName() === "Sheet1" ? ss.getSheets()[0].setName(SHEET) : ss.insertSheet(SHEET);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#1E3968").setFontColor("#F8F1E3");
  sh.setFrozenRows(1);
  const widths = [140, 160, 190, 230, 150, 120, 130, 160, 120, 300, 360];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
  sh.getRange(2, 8, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(2, 6, sh.getMaxRows() - 1, 1).setNumberFormat("#,##0.00 €");
  const colors = { "Pendiente": "#FCE8B2", "Contactado": "#D2E3FC", "Presupuesto enviado": "#E8DEF8", "Pedido cerrado": "#CEEAD6", "Descartado": "#E8EAED" };
  const rng = sh.getRange(2, 8, sh.getMaxRows() - 1, 1);
  sh.setConditionalFormatRules(Object.entries(colors).map(([v, c]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(c).setRanges([rng]).build()));
  configurarPropuestas_(ss);
  // Pide los permisos de correo y de acceso a la web en esta misma ejecución
  getCatalog_();
  MailApp.getRemainingDailyQuota();
  return "Listo";
}

function configurarPropuestas_(ss) {
  let sh = ss.getSheetByName(SHEET_P);
  if (!sh) sh = ss.insertSheet(SHEET_P);
  sh.getRange(1, 1, 1, HEADERS_P.length).setValues([HEADERS_P]).setFontWeight("bold").setBackground("#1E3968").setFontColor("#F8F1E3");
  sh.setFrozenRows(1);
  [140, 190, 230, 340, 90, 150, 260, 140, 80, 300, 130, 160, 120, 300].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(2, 6, sh.getMaxRows() - 1, 1).setNumberFormat("#,##0.00 €");
  const rng = sh.getRange(2, 12, sh.getMaxRows() - 1, 1);
  rng.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build());
  const colors = { "Pendiente": "#FCE8B2", "Contactado": "#D2E3FC", "Presupuesto enviado": "#E8DEF8", "Pedido cerrado": "#CEEAD6", "Descartado": "#E8EAED" };
  sh.setConditionalFormatRules(Object.entries(colors).map(([v, c]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(c).setRanges([rng]).build()));
  return sh;
}

function getCatalog_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get("catalog");
  if (hit) return JSON.parse(hit);
  const res = UrlFetchApp.fetch(SITE + "/catalog.json", { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return [];
  const txt = res.getContentText();
  try { cache.put("catalog", txt, 21600); } catch (e) {}
  return JSON.parse(txt);
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ ok: true, service: "Tu Cesta Solidaria" });
}

function doPost(e) {
  const clean = (s, max) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, max || 160);
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || "{}"); } catch (err) { return json_({ ok: false, error: "Solicitud no válida." }); }
  if (clean(body.website)) return json_({ ok: true });
  const email = clean(body.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: "Revisa tu correo electrónico." });
  const catalog = getCatalog_();
  const byId = {}; catalog.forEach((b) => (byId[b.id] = b));
  return body.type === "propuesta" ? doProposal_(body, email, byId, clean) : doInfo_(body, email, byId, clean);
}

function appendLocked_(sheetName, setup, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(sheetName);
    if (!sh) sh = setup(ss);
    if (sheetName === SHEET && sh.getRange(1, 11).getValue() !== HEADERS[10]) sh.getRange(1, 11).setValue(HEADERS[10]).setFontWeight("bold").setBackground("#1E3968").setFontColor("#F8F1E3");
    sh.appendRow(row);
    return { sh, row: sh.getLastRow() };
  } finally {
    lock.releaseLock();
  }
}

function doInfo_(body, email, byId, clean) {
  const name = clean(body.name, 80), company = clean(body.company, 120);
  const questions = String(body.questions == null ? "" : body.questions).trim().slice(0, 1500);
  if (!company) return json_({ ok: false, error: "Indica el nombre de tu empresa." });
  if (!questions) return json_({ ok: false, error: "Escribe tu mensaje." });
  const basket = body.basket_id ? byId[body.basket_id] || null : null;
  const { sh, row } = appendLocked_(SHEET, (ss) => { configurar(); return ss.getSheetByName(SHEET); },
    [new Date(), name, company, email, basket ? basket.name : "Catálogo general", basket ? basket.price : "", "Enviando…", "Pendiente", "", "", questions]);
  try {
    // Primero el aviso a vuestro Gmail (lo importante); después la confirmación al cliente
    const note = renderNotifyEmail({ name, company, email, basket, questions });
    MailApp.sendEmail({ to: NOTIFY_TO, subject: note.subject, htmlBody: note.html, body: note.text, name: "Web Tu Cesta Solidaria", replyTo: email });
    const highlights = HIGHLIGHTS.map((id) => byId[id]).filter(Boolean);
    const client = renderClientEmail({ name, company, basket, site: SITE, highlights, questions });
    MailApp.sendEmail({ to: email, subject: client.subject, htmlBody: client.html, body: client.text, name: "Tu Cesta Solidaria", replyTo: NOTIFY_TO });
    sh.getRange(row, 7).setValue("Enviado");
  } catch (err) {
    sh.getRange(row, 7).setValue("Error: " + String(err).slice(0, 80));
    return json_({ ok: true, mail: false });
  }
  return json_({ ok: true });
}

function doProposal_(body, email, byId, clean) {
  const company = clean(body.company, 120), address = clean(body.address, 200), city = clean(body.city, 80), postal_code = clean(body.postal_code, 10);
  const notes = String(body.notes == null ? "" : body.notes).trim().slice(0, 1500);
  if (!address || !city || !postal_code) return json_({ ok: false, error: "Indica la dirección, población y código postal de envío." });
  const lines = (Array.isArray(body.items) ? body.items : []).slice(0, 100)
    .map((i) => ({ b: byId[i && i.id], qty: Math.max(1, Math.min(9999, parseInt(i && i.qty, 10) || 1)) }))
    .filter((l) => l.b);
  if (!lines.length) return json_({ ok: false, error: "Añade al menos una cesta a tu propuesta." });
  const total = Math.round(lines.reduce((n, l) => n + l.qty * l.b.price, 0) * 100) / 100;
  const units = lines.reduce((n, l) => n + l.qty, 0);
  const p = { email, company, address, city, postal_code, notes, lines, total };
  const { sh, row } = appendLocked_(SHEET_P, configurarPropuestas_,
    [new Date(), company, email, lines.map((l) => `${l.qty} × ${l.b.name}`).join("\n"), units, total, address, city, postal_code, notes, "Enviando…", "Pendiente", "", ""]);
  try {
    const m = renderProposalEmails(p);
    MailApp.sendEmail({ to: NOTIFY_TO, subject: m.notify.subject, htmlBody: m.notify.html, body: m.notify.text, name: "Web Tu Cesta Solidaria", replyTo: email });
    MailApp.sendEmail({ to: email, subject: m.client.subject, htmlBody: m.client.html, body: m.client.text, name: "Tu Cesta Solidaria", replyTo: NOTIFY_TO });
    sh.getRange(row, 11).setValue("Enviado");
  } catch (err) {
    sh.getRange(row, 11).setValue("Error: " + String(err).slice(0, 80));
    return json_({ ok: true, mail: false });
  }
  return json_({ ok: true });
}
