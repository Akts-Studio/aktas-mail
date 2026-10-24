import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import { env } from "../env.js";

/**
 * Uzak görsel vekili. Maildeki her uzak görsel tarayıcıya doğrudan
 * değil, `/api/img` üzerinden gidiyor:
 *  - gönderen kullanıcının IP'sini ve tarayıcısını görmüyor (Gmail gibi),
 *  - iframe'in CSP'si yalnız kendi origin'imize izin veriyor; karar
 *    tek yerde, sunucuda (önce sunucu açıp CSP kapatınca görseller
 *    sessizce kırılıyordu),
 *  - http:// görseller de karışık içerik engeline takılmıyor.
 *
 * İmza ŞART: imzasız bir vekil, sunucumuzu herkesin her adrese istek
 * attırabileceği bir SSRF aracına çevirir.
 */

const ANAHTAR = createHmac("sha256", env.COOKIE_SECRET).update("gorsel-proxy:v1").digest();
const AZAMI_BAYT = 8 * 1024 * 1024;
const ZAMAN_ASIMI_MS = 8000;
const AZAMI_YONLENDIRME = 3;
/** SVG YOK: kendi origin'imizden açılan bir SVG script çalıştırabilir. */
const IZINLI_TURLER = /^image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|vnd\.microsoft\.icon)$/i;

function imza(adres: string): string {
  return createHmac("sha256", ANAHTAR).update(adres).digest("base64url").slice(0, 32);
}

/**
 * Maildeki uzak adresi vekil adresine çevirir. Göreli: srcdoc iframe'i
 * üst belgenin adresini taban alıyor, yerelde de canlıda da aynı origin.
 */
export function vekilAdresi(adres: string): string {
  return `/api/img?u=${Buffer.from(adres).toString("base64url")}&s=${imza(adres)}`;
}

/** İmza doğruysa çözülmüş adresi, değilse null döner. */
export function vekilAdresiniCoz(u: string, s: string): string | null {
  const adres = Buffer.from(u, "base64url").toString("utf8");
  const beklenen = Buffer.from(imza(adres));
  const gelen = Buffer.from(s);
  if (gelen.length !== beklenen.length || !timingSafeEqual(gelen, beklenen)) return null;
  return /^https?:\/\//i.test(adres) ? adres : null;
}

/** Loopback, özel ağ, link-local, CGNAT, çok noktaya yayın… dışarıda olmayan her şey. */
export function icAgAdresi(ip: string): boolean {
  if (isIP(ip) === 6) {
    const k = ip.toLowerCase();
    const v4 = k.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4) return icAgAdresi(v4[1]!);
    return k === "::" || k === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(k) || k.startsWith("64:ff9b:") || k.startsWith("2001:db8");
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

export interface VekilYaniti {
  tur: string;
  govde: Buffer;
}

/**
 * Adresi çeker. DNS bir kez çözülüp doğrulanan IP'ye bağlanılıyor
 * (`lookup` sabitleniyor): kontrol ile bağlantı arasında DNS'in iç ağa
 * dönmesi (DNS rebinding) böylece işe yaramaz. Yönlendirmeler elle,
 * her adımda aynı kontrolle izleniyor.
 */
export async function gorseliGetir(adres: string, kalan = AZAMI_YONLENDIRME): Promise<VekilYaniti | null> {
  const url = new URL(adres);
  if (url.username || url.password) return null;
  if (url.port && !["80", "443"].includes(url.port)) return null;

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ip = isIP(host) ? host : (await lookup(host).catch(() => null))?.address;
  if (!ip || icAgAdresi(ip)) return null;

  const istemci = url.protocol === "https:" ? https : http;
  return new Promise((resolve) => {
    const istek = istemci.get(
      url,
      {
        // Node 20+ autoSelectFamily ile `all: true` ister ve dizi bekler
        lookup: (_h, o, cb) =>
          o.all ? cb(null, [{ address: ip, family: isIP(ip) }] as never, isIP(ip)) : cb(null, ip, isIP(ip)),
        headers: { "user-agent": "AktasMail-ImageProxy/1.0", accept: "image/*" },
        timeout: ZAMAN_ASIMI_MS,
      },
      (yanit) => {
        const kod = yanit.statusCode ?? 0;
        if (kod >= 300 && kod < 400 && yanit.headers.location && kalan > 0) {
          yanit.resume();
          const sonraki = new URL(yanit.headers.location, url).toString();
          resolve(/^https?:/i.test(sonraki) ? gorseliGetir(sonraki, kalan - 1) : null);
          return;
        }
        const tur = (yanit.headers["content-type"] ?? "").split(";")[0]!.trim();
        if (kod !== 200 || !IZINLI_TURLER.test(tur)) {
          yanit.resume();
          resolve(null);
          return;
        }
        const parcalar: Buffer[] = [];
        let toplam = 0;
        yanit.on("data", (p: Buffer) => {
          toplam += p.length;
          if (toplam > AZAMI_BAYT) {
            istek.destroy();
            resolve(null);
            return;
          }
          parcalar.push(p);
        });
        yanit.on("end", () => resolve({ tur, govde: Buffer.concat(parcalar) }));
        yanit.on("error", () => resolve(null));
      },
    );
    istek.on("timeout", () => istek.destroy());
    istek.on("error", () => resolve(null));
  });
}
