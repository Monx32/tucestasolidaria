// Plantillas de los correos automáticos de «Pedir información».
// Diseño en tablas con estilos en línea para que se vea bien en Gmail, Outlook y móvil.

const C = { cream: "#FBF6EC", card: "#FFFFFF", navy: "#1E3968", muted: "#56627F", gold: "#96722C", goldBg: "#CBA960", line: "#EDE3CF", green: "#48613B", greenBg: "#EEF1E6", rasp: "#B84362" };
const SERIF = "Georgia,'Times New Roman',serif";
const SANS = "Helvetica,Arial,sans-serif";
const CONTACT = { email: "tucestasolidaria.navidad@gmail.com", phone: "688 655 283", wa: "34688655283" };
const LEGAL = "Asociación Jóven Empresa Imperia TC · NIF G05739461 (provisional) · Plaza de San Martín, 1, 28013 Madrid";

const eur = (n) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
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

export function renderClientEmail({ name, company, basket, site, highlights }) {
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

export function renderNotifyEmail({ name, company, email, basket }) {
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
