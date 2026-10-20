// Función de Vercel: botón «Pedir información».
// Recibe nombre, empresa, correo y (opcional) la cesta, y envía:
//   1) al cliente, un correo personalizado con la información de la cesta
//   2) al buzón de Tu Cesta Solidaria, un aviso con sus datos
// Variables de entorno (Vercel → Settings → Environment Variables):
//   SMTP_USER  → cuenta Gmail que envía (p. ej. tucestasolidaria.navidad@gmail.com)
//   SMTP_PASS  → contraseña de aplicación de esa cuenta (16 letras)
//   NOTIFY_TO  → (opcional) buzón donde recibir los avisos; por defecto SMTP_USER
//   SMTP_HOST / SMTP_PORT → (opcional) por defecto smtp.gmail.com / 465
import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";
import { renderClientEmail, renderNotifyEmail } from "./_email.js";

const CATALOG = JSON.parse(readFileSync(new URL("./_catalog.json", import.meta.url)));
const BY_ID = Object.fromEntries(CATALOG.map((b) => [b.id, b]));
const clean = (s, max = 160) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    if (clean(body.website)) return res.status(200).json({ ok: true }); // bot: campo trampa relleno
    const name = clean(body.name, 80), company = clean(body.company, 120), email = clean(body.email, 160).toLowerCase();
    if (!name || !company) return res.status(400).json({ ok: false, error: "Indica tu nombre y tu empresa." });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: "Revisa tu correo electrónico." });
    const basket = body.basket_id ? BY_ID[body.basket_id] || null : null;

    const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
    if (!user || !pass) return res.status(500).json({ ok: false, error: "El envío automático aún no está activado. Escríbenos a tucestasolidaria.navidad@gmail.com o por WhatsApp al 688 655 283." });
    const port = parseInt(process.env.SMTP_PORT || "465", 10);
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.gmail.com", port, secure: port === 465, auth: { user, pass } });
    const notifyTo = process.env.NOTIFY_TO || user;
    const site = `https://${req.headers["x-forwarded-host"] || req.headers.host || "tucestasolidaria.vercel.app"}`;
    const highlights = ["lote-5", "lote-11", "jamonero-21", "cesta-41"].map((id) => BY_ID[id]).filter(Boolean);

    const client = renderClientEmail({ name, company, basket, site, highlights });
    await transport.sendMail({ from: { name: "Tu Cesta Solidaria", address: user }, to: email, replyTo: notifyTo, subject: client.subject, html: client.html, text: client.text });
    const note = renderNotifyEmail({ name, company, email, basket });
    await transport.sendMail({ from: { name: "Web Tu Cesta Solidaria", address: user }, to: notifyTo, replyTo: email, subject: note.subject, html: note.html, text: note.text });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("info", e);
    return res.status(500).json({ ok: false, error: "No hemos podido enviar el correo. Inténtalo de nuevo o escríbenos a tucestasolidaria.navidad@gmail.com." });
  }
}
