import { z } from "zod";

/**
 * Giden mailin gövdesi ve imzası.
 *
 * Önceden mail yalnızca düz metin gidiyordu ve From'da isim yoktu:
 * alıcı "eymen@akts.tr" ve biçimsiz bir metin görüyordu. Artık her
 * mail bu şablondan HTML + düz metin olarak çıkıyor. Gönderim ve
 * önizleme AYNI fonksiyonu kullanıyor — önizlenen neyse giden o.
 *
 * Kullanıcının yazdığı her şey kaçırılıyor (escape); şablona ham HTML
 * girmiyor. Mail istemcileri <style>'ı sık siliyor, stiller satır içi.
 */

const HEX = /^#[0-9a-f]{6}$/i;

export const imzaSemasi = z.object({
  acik: z.boolean().optional(),
  ad: z.string().max(80).optional(),
  unvan: z.string().max(80).optional(),
  telefon: z.string().max(40).regex(/^[0-9+()\s.-]*$/, "Telefon yalnızca rakam içerebilir").optional(),
  web: z.string().max(120).optional(),
  not: z.string().max(200).optional(),
  renk: z.string().regex(HEX).optional(),
});

export type Imza = z.infer<typeof imzaSemasi>;

export const VARSAYILAN_RENK = "#1a73e8";

function kacir(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Kaçırılmış metindeki http(s) adreslerini bağlantı yapar. */
function baglantila(kacik: string, renk: string): string {
  return kacik.replace(
    /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,
    (url) => `<a href="${url}" style="color:${renk};">${url}</a>`,
  );
}

/** "akts.tr" → "https://akts.tr"; yalnızca http(s). */
function webAdresi(web: string): string | null {
  const ham = web.trim();
  if (!ham) return null;
  const url = /^https?:\/\//i.test(ham) ? ham : `https://${ham}`;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Yanıt ve iletmede eklenen alıntı işaretleri. Bu satırdan sonrası
 * gri, girintili bir alıntı bloğu olarak basılıyor.
 */
const ALINTI_BASI = /^(-{3} .+ yazdı -{3}|-{10} İletilen mesaj -{10})$/;

function paragraflar(metin: string, renk: string): string {
  return metin
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const satirlar = p.split("\n").map((s) => baglantila(kacir(s), renk));
      return `<p style="margin:0 0 14px;">${satirlar.join("<br>")}</p>`;
    })
    .join("");
}

/** Yazılan kısım ve alıntı. İmza ikisinin arasına giriyor, alıntının altına değil. */
function parcala(metin: string): { ust: string; alinti: string } {
  const satirlar = metin.replace(/\r\n/g, "\n").split("\n");
  const i = satirlar.findIndex((s) => ALINTI_BASI.test(s.trim()));
  return i === -1
    ? { ust: metin, alinti: "" }
    : { ust: satirlar.slice(0, i).join("\n"), alinti: satirlar.slice(i).join("\n") };
}

function alintiHtml(alinti: string, renk: string): string {
  if (!alinti.trim()) return "";
  return (
    `<div style="margin:24px 0 0;padding:2px 0 2px 14px;border-left:3px solid #dadce0;color:#5f6368;">` +
    paragraflar(alinti, renk) +
    `</div>`
  );
}

export interface Gonderen {
  email: string;
  /** users.displayName — imzada ad yoksa bu kullanılıyor */
  displayName: string | null;
}

/** İmzadaki ad, yoksa profil adı, o da yoksa adresin yerel kısmı. */
export function gonderenAdi(g: Gonderen, imza: Imza | undefined): string {
  return imza?.ad?.trim() || g.displayName?.trim() || g.email.split("@")[0] || g.email;
}

function imzaHtml(g: Gonderen, imza: Imza, renk: string): string {
  const ad = gonderenAdi(g, imza);
  const web = imza.web ? webAdresi(imza.web) : null;
  const iletisim = [
    `<a href="mailto:${kacir(g.email)}" style="color:${renk};text-decoration:none;">${kacir(g.email)}</a>`,
    ...(imza.telefon?.trim()
      ? [`<a href="tel:${kacir(imza.telefon.replace(/[^0-9+]/g, ""))}" style="color:#5f6368;text-decoration:none;">${kacir(imza.telefon.trim())}</a>`]
      : []),
  ].join(` <span style="color:#bdc1c6;">·</span> `);

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="margin-top:28px;padding-top:16px;border-top:1px solid #e8eaed;border-collapse:separate;">` +
    `<tr><td style="vertical-align:top;padding-right:14px;">` +
    `<div style="width:44px;height:44px;border-radius:22px;background:${renk};color:#ffffff;` +
    `font-size:18px;font-weight:600;line-height:44px;text-align:center;">` +
    `${kacir(ad.charAt(0).toLocaleUpperCase("tr-TR"))}</div></td>` +
    `<td style="vertical-align:top;font-size:13px;line-height:1.55;color:#5f6368;">` +
    `<div style="font-size:15px;font-weight:600;color:#1f1f1f;">${kacir(ad)}</div>` +
    (imza.unvan?.trim() ? `<div>${kacir(imza.unvan.trim())}</div>` : "") +
    `<div>${iletisim}</div>` +
    (web
      ? `<div><a href="${kacir(web)}" style="color:${renk};text-decoration:none;">` +
        `${kacir(web.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a></div>`
      : "") +
    (imza.not?.trim()
      ? `<div style="margin-top:6px;font-size:12px;color:#80868b;">${kacir(imza.not.trim())}</div>`
      : "") +
    `</td></tr></table>`
  );
}

function imzaMetni(g: Gonderen, imza: Imza): string {
  const web = imza.web ? webAdresi(imza.web) : null;
  return [
    "-- ",
    gonderenAdi(g, imza),
    imza.unvan?.trim(),
    [g.email, imza.telefon?.trim()].filter(Boolean).join(" · "),
    web,
    imza.not?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

/** İmza kapalı değilse (varsayılan açık) gövdenin altına eklenir. */
export function mailOlustur(
  metin: string,
  g: Gonderen,
  imza: Imza | undefined,
): { html: string; text: string } {
  const i = imza ?? {};
  const renk = i.renk && HEX.test(i.renk) ? i.renk : VARSAYILAN_RENK;
  const imzaVar = i.acik !== false;
  const { ust, alinti } = parcala(metin);

  const html =
    `<!doctype html><html lang="tr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light only"></head>` +
    `<body style="margin:0;padding:0;background:#ffffff;">` +
    `<div style="max-width:640px;padding:4px 2px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;` +
    `font-size:15px;line-height:1.6;color:#1f1f1f;">` +
    paragraflar(ust, renk) +
    (imzaVar ? imzaHtml(g, i, renk) : "") +
    alintiHtml(alinti, renk) +
    `</div></body></html>`;

  const text = imzaVar
    ? `${ust.trimEnd()}\n\n${imzaMetni(g, i)}\n${alinti.trim() ? `\n${alinti.trim()}\n` : ""}`
    : metin;
  return { html, text };
}
