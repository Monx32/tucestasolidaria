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
 *  - se añade una fila en «Solicitudes» (fecha, nombre, empresa, correo, cesta, precio, estado…)
 *  - se le envía el correo personalizado desde esta cuenta de Gmail
 *  - os llega un aviso a NOTIFY_TO
 */

const SITE = "https://tucestasolidaria.vercel.app";
const NOTIFY_TO = "tucestasolidaria.navidad@gmail.com";
const SHEET = "Solicitudes";
const HEADERS = ["Fecha", "Nombre", "Empresa", "Correo", "Cesta", "Precio (IVA incl.)", "Correo automático", "Estado", "Responsable", "Notas"];
const ESTADOS = ["Pendiente", "Contactado", "Presupuesto enviado", "Pedido cerrado", "Descartado"];
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
const first = (name) => name.split(" ")[0];
const isParticular = (company) => /^particular$/i.test(company.trim());

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
  const subject = encodeURIComponent(b ? `Presupuesto ${b.name}` : "Presupuesto cestas de Navidad");
  const wa = encodeURIComponent(b ? `Hola, me gustaría un presupuesto del ${b.name}.` : "Hola, me gustaría un presupuesto de cestas de Navidad.");
  return `
  <tr><td style="padding:26px 6px 0">
    <h2 style="margin:0 0 8px;font-family:${SERIF};font-weight:normal;font-size:24px;color:${C.navy}">¿Te preparamos un presupuesto?</h2>
    <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.muted}">Responde a este correo y cuéntanos <strong style="color:${C.navy}">cuántas cestas</strong> necesitas, la <strong style="color:${C.navy}">fecha</strong> y el <strong style="color:${C.navy}">lugar de entrega</strong>, y si quieres <strong style="color:${C.navy}">tarjeta o personalización</strong>. Te contestamos en 24–48 h laborables, sin compromiso.</p>
    ${button(`mailto:${CONTACT.email}?subject=${subject}`, "Pedir presupuesto", C.goldBg, C.navy)}
    ${button(`https://wa.me/${CONTACT.wa}?text=${wa}`, "Escribir por WhatsApp", C.card, C.green, C.green)}
  </td></tr>`;
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

function renderClientEmail({ name, company, basket, site, highlights }) {
  const hi = esc(first(name));
  const intro = basket
    ? `Gracias por interesarte por el <strong style="color:${C.navy}">${esc(basket.name)}</strong>${isParticular(company) ? "" : ` para <strong style="color:${C.navy}">${esc(company)}</strong>`}. Aquí tienes todo lo que lleva, con su precio final.`
    : `Gracias por tu interés en nuestras cestas de Navidad${isParticular(company) ? "" : ` para <strong style="color:${C.navy}">${esc(company)}</strong>`}. Tenemos 85 cestas y lotes, desde detalles para todo el equipo hasta grandes cestas con jamón ibérico. Te dejamos algunas de las más pedidas.`;
  const body = `
  <tr><td style="padding:0 6px 20px">
    <h1 style="margin:0;font-family:${SERIF};font-weight:normal;font-size:34px;line-height:1.15;color:${C.navy}">Hola, ${hi}</h1>
    <p style="margin:12px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.muted}">${intro}</p>
  </td></tr>
  ${basket ? basketBlock(basket, site) : highlightsBlock(highlights, site)}
  ${afeam(basket ? "de nuestro beneficio con esta cesta va a la Fundación AFEAM, que acompaña a personas con Alzheimer y a sus familias." : "de nuestro beneficio en cada cesta va a la Fundación AFEAM, que acompaña a personas con Alzheimer y a sus familias.")}
  ${nextSteps(basket)}`;
  const subject = basket ? `${first(name)}, aquí tienes el ${basket.name} · Tu Cesta Solidaria` : `${first(name)}, aquí tienes nuestras cestas de Navidad · Tu Cesta Solidaria`;
  const preheader = basket ? `${basket.name}: ${basket.tagline || ""} · ${eur(basket.price)} IVA incluido` : "85 cestas y lotes de Navidad. El 10% de nuestro beneficio va a la Fundación AFEAM.";
  const text = [
    `Hola, ${first(name)}:`,
    "",
    basket ? `Gracias por interesarte por el ${basket.name}. ${basket.tagline || ""}` : "Gracias por tu interés en nuestras cestas de Navidad.",
    basket ? `Precio: ${eur(basket.price)} (IVA incluido)` : "",
    ...(basket ? (basket.categories || []).filter((c) => c.name !== "Embalaje").flatMap((c) => ["", c.name.toUpperCase(), ...c.items.map((i) => `${i.qty} x ${i.name}`)]) : []),
    "",
    "El 10% de nuestro beneficio va a la Fundación AFEAM.",
    "",
    "¿Te preparamos un presupuesto? Responde a este correo con el número de cestas, la fecha y el lugar de entrega.",
    `WhatsApp: ${CONTACT.phone} · ${site}`,
    "",
    "Un abrazo,",
    "El equipo de Tu Cesta Solidaria",
    "",
    LEGAL,
  ].join("\n");
  return { subject, html: shell({ preheader, body }), text };
}

function renderNotifyEmail({ name, company, email, basket }) {
  const rows = [["Nombre", name], ["Empresa", company], ["Correo", email], ["Cesta", basket ? `${basket.name} · ${eur(basket.price)}` : "Catálogo general"]];
  const body = `
  <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:14px;padding:24px 26px">
    <h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:normal;font-size:26px;color:${C.navy}">Nueva petición de información</h1>
    <table role="presentation" cellpadding="0" cellspacing="0" style="font-family:${SANS};font-size:15px;line-height:1.8;color:${C.navy}">
      ${rows.map(([k, v]) => `<tr><td style="padding-right:18px;color:${C.muted}">${k}</td><td>${esc(v)}</td></tr>`).join("")}
    </table>
    <p style="margin:16px 0 0;font-family:${SANS};font-size:13px;color:${C.muted}">Ya le hemos enviado el correo automático. Si respondes a este mensaje, le escribes directamente.</p>
  </td></tr>`;
  return {
    subject: `Nueva petición: ${company} · ${basket ? basket.name : "catálogo"}`,
    html: shell({ preheader: `${name} (${company}) ha pedido información`, body }),
    text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
  };
}


// ---------------------------------------------------------------------------

function configurar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.getSheets()[0].getName() === "Hoja 1" || ss.getSheets()[0].getName() === "Sheet1" ? ss.getSheets()[0].setName(SHEET) : ss.insertSheet(SHEET);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#1E3968").setFontColor("#F8F1E3");
  sh.setFrozenRows(1);
  const widths = [140, 160, 190, 230, 150, 120, 130, 160, 120, 300];
  widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).setAllowInvalid(false).build();
  sh.getRange(2, 8, sh.getMaxRows() - 1, 1).setDataValidation(rule);
  sh.getRange(2, 1, sh.getMaxRows() - 1, 1).setNumberFormat("dd/MM/yyyy HH:mm");
  sh.getRange(2, 6, sh.getMaxRows() - 1, 1).setNumberFormat("#,##0.00 €");
  const colors = { "Pendiente": "#FCE8B2", "Contactado": "#D2E3FC", "Presupuesto enviado": "#E8DEF8", "Pedido cerrado": "#CEEAD6", "Descartado": "#E8EAED" };
  const rng = sh.getRange(2, 8, sh.getMaxRows() - 1, 1);
  sh.setConditionalFormatRules(Object.entries(colors).map(([v, c]) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(v).setBackground(c).setRanges([rng]).build()));
  // Pide los permisos de correo y de acceso a la web en esta misma ejecución
  getCatalog_();
  MailApp.getRemainingDailyQuota();
  return "Listo";
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
  const name = clean(body.name, 80), company = clean(body.company, 120), email = clean(body.email, 160).toLowerCase();
  if (!name || !company) return json_({ ok: false, error: "Indica tu nombre y tu empresa." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: "Revisa tu correo electrónico." });

  const catalog = getCatalog_();
  const byId = {}; catalog.forEach((b) => (byId[b.id] = b));
  const basket = body.basket_id ? byId[body.basket_id] || null : null;

  // 1) Guardar en la hoja
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let row;
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(SHEET);
    if (!sh) { configurar(); sh = ss.getSheetByName(SHEET); }
    sh.appendRow([new Date(), name, company, email, basket ? basket.name : "Catálogo general", basket ? basket.price : "", "Enviando…", "Pendiente", "", ""]);
    row = sh.getLastRow();
  } finally {
    lock.releaseLock();
  }
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);

  // 2) Enviar los correos
  try {
    const highlights = HIGHLIGHTS.map((id) => byId[id]).filter(Boolean);
    const client = renderClientEmail({ name, company, basket, site: SITE, highlights });
    MailApp.sendEmail({ to: email, subject: client.subject, htmlBody: client.html, body: client.text, name: "Tu Cesta Solidaria", replyTo: NOTIFY_TO });
    const note = renderNotifyEmail({ name, company, email, basket });
    note.html = note.html.replace("Ya le hemos enviado el correo automático.", "Ya le hemos enviado el correo automático y está guardado en la hoja «" + SHEET + "».");
    MailApp.sendEmail({ to: NOTIFY_TO, subject: note.subject, htmlBody: note.html, body: note.text, name: "Web Tu Cesta Solidaria", replyTo: email });
    sh.getRange(row, 7).setValue("Enviado");
  } catch (err) {
    sh.getRange(row, 7).setValue("Error: " + String(err).slice(0, 80));
    return json_({ ok: true, mail: false });
  }
  return json_({ ok: true });
}
