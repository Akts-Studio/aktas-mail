import net from "node:net";
import { z } from "zod";

/**
 * Hesap engelleme.
 *
 * Uygulama posta kutusuna yalnızca kullanıcı oturumdayken erişebiliyor
 * (parola istemcideki anahtarla şifreli), yani gelen maili arka planda
 * süzemez. Engelleme bu yüzden TESLİMATTA, Dovecot'un Sieve filtresiyle
 * yapılıyor: engellenen adresten gelen mail kutuya hiç düşmüyor.
 *
 * Betik kullanıcının KENDİ parolasıyla ManageSieve (127.0.0.1:4190)
 * üzerinden yazılıyor — uygulamanın ayrı bir yetkisi yok.
 *
 * Otomatik yanıt Sieve'in `vacation` eylemi: aynı kişiye 30 günde bir,
 * posta listelerine / noreply adreslerine / otomatik maillere hiç yanıt
 * vermiyor. Spam gönderenler başkasının adresini taklit ettiği için her
 * maile körlemesine yanıt vermek masum kişilere mail yağdırır ve
 * sunucunun gönderim itibarını yakar.
 */

const BETIK_ADI = "akts-engel";
const YANIT_GUN = 30;
export const ENGEL_SINIRI = 500;

export const VARSAYILAN_ENGEL_MESAJI =
  "Bu adrese gönderdiğiniz mailler engellenmiştir ve alıcıya ulaşmamaktadır.";

/** "kisi@site.com" ya da tüm alan adı için "@site.com" */
export const engelGirdisi = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .refine(
    (v) => z.string().email().safeParse(v).success || /^@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(v),
    "Geçerli bir e-posta adresi ya da @alanadi.com girin",
  );

/** Sieve dizesi: yalnız " ve \ kaçırılır; satır sonu olamaz. */
function sieveDizesi(s: string): string {
  return `"${s.replace(/[\r\n]/g, " ").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function sieveBetigi(liste: string[], mesaj = VARSAYILAN_ENGEL_MESAJI): string {
  const adresler = liste.filter((g) => !g.startsWith("@"));
  const alanlar = liste.filter((g) => g.startsWith("@")).map((g) => g.slice(1));
  if (adresler.length === 0 && alanlar.length === 0) {
    return "# Aktaş Mail — engellenen hesap yok\n";
  }

  const kosullar = [
    ...(adresler.length ? [`address :all :is "from" [${adresler.map(sieveDizesi).join(", ")}]`] : []),
    ...(alanlar.length ? [`address :domain :is "from" [${alanlar.map(sieveDizesi).join(", ")}]`] : []),
  ];

  return [
    "# Aktaş Mail — engellenen hesaplar. Uygulama üretiyor, elle düzenleme.",
    'require ["vacation"];',
    "",
    `if anyof (${kosullar.join(", ")}) {`,
    `  vacation :days ${YANIT_GUN} :subject ${sieveDizesi("Engellendiniz")} ${sieveDizesi(mesaj)};`,
    "  discard;",
    "  stop;",
    "}",
    "",
  ].join("\n");
}

/**
 * En küçük ManageSieve istemcisi (RFC 5804): yalnız AUTHENTICATE PLAIN,
 * PUTSCRIPT, SETACTIVE ve LOGOUT. Bağlantı yerel; Dovecot localhost'u
 * güvenli sayıyor, düz metin kimlik doğrulamaya izin veriyor.
 */
class ManageSieve {
  private tampon = "";
  private bekleyen: ((satir: string) => void) | null = null;
  private soket: net.Socket;
  private hata: Error | null = null;

  constructor(host: string, port: number) {
    this.soket = net.connect({ host, port });
    this.soket.setEncoding("utf8");
    this.soket.setTimeout(10_000, () => this.soket.destroy(new Error("ManageSieve zaman aşımı")));
    this.soket.on("data", (d: string) => {
      this.tampon += d;
      this.bosalt();
    });
    this.soket.on("error", (e) => {
      this.hata = e;
      this.bosalt();
    });
  }

  private bosalt() {
    // Sonuç satırı OK / NO / BYE ile başlar; öncesindeki bilgi satırları atlanır.
    const satirlar = this.tampon.split("\r\n");
    for (let i = 0; i < satirlar.length - 1; i++) {
      const s = satirlar[i]!;
      if (/^(OK|NO|BYE)\b/i.test(s)) {
        this.tampon = satirlar.slice(i + 1).join("\r\n");
        const b = this.bekleyen;
        this.bekleyen = null;
        b?.(s);
        return;
      }
    }
    if (this.hata && this.bekleyen) {
      const b = this.bekleyen;
      this.bekleyen = null;
      b(`NO ${this.hata.message}`);
    }
  }

  private sonuc(): Promise<string> {
    return new Promise((resolve) => {
      this.bekleyen = resolve;
      this.bosalt();
    });
  }

  async komut(metin: string): Promise<void> {
    if (metin) this.soket.write(metin);
    const s = await this.sonuc();
    if (!/^OK\b/i.test(s)) throw new Error(`ManageSieve: ${s}`);
  }

  kapat() {
    this.soket.write("LOGOUT\r\n");
    this.soket.end();
  }
}

export async function betigiYukle(
  kimlik: { user: string; pass: string },
  betik: string,
  host = "127.0.0.1",
  port = 4190,
): Promise<void> {
  const ms = new ManageSieve(host, port);
  try {
    await ms.komut(""); // karşılama
    const plain = Buffer.from(`\0${kimlik.user}\0${kimlik.pass}`).toString("base64");
    await ms.komut(`AUTHENTICATE "PLAIN" "${plain}"\r\n`);
    const bayt = Buffer.byteLength(betik, "utf8");
    await ms.komut(`PUTSCRIPT "${BETIK_ADI}" {${bayt}+}\r\n${betik}\r\n`);
    await ms.komut(`SETACTIVE "${BETIK_ADI}"\r\n`);
  } finally {
    ms.kapat();
  }
}
