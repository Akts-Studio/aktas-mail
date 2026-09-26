/**
 * Giden mail şablonu testleri.
 * Çalıştır: npx tsx src/mail/sablon.test.ts
 *
 * Şablona kullanıcının yazdığı metin ve imza alanları giriyor; bunlar
 * alıcının mail istemcisinde HTML olarak açılıyor. Kaçırma bozulursa
 * herkesin gönderdiği mail başkasına HTML enjekte eder.
 */
import { mailOlustur, gonderenAdi, imzaSemasi } from "./sablon.js";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const g = { email: "eymen@akts.tr", displayName: "Eymen" };

console.log("\nKaçırma");
{
  const { html } = mailOlustur('<script>alert(1)</script> "x" & y', g, { acik: false });
  check("<script> kaçırılıyor", !html.includes("<script>") && html.includes("&lt;script&gt;"));
  check("& kaçırılıyor", html.includes("&amp; y"));
  const imzali = mailOlustur("selam", g, { ad: '<img src=x onerror=alert(1)>', unvan: "<b>", not: '"><svg>' });
  check("imza adı kaçırılıyor", !imzali.html.includes("<img") && !imzali.html.includes("<svg"));
  const web = mailOlustur("selam", g, { web: "javascript:alert(1)" });
  check("javascript: web adresi bağlantı olmuyor", !web.html.includes("javascript:"));
}

console.log("\nGövde");
{
  const { html } = mailOlustur("Merhaba\nnasılsın\n\nİkinci paragraf https://akts.tr/a?b=1&c=2.", g, { acik: false });
  check("paragraflar ayrılıyor", (html.match(/<p /g) ?? []).length === 2);
  check("tek satır sonu <br> oluyor", html.includes("Merhaba<br>nasılsın"));
  check("adres bağlantı oluyor, sondaki nokta dışarıda",
    html.includes('href="https://akts.tr/a?b=1&amp;c=2"') && html.includes("c=2</a>."));
  const yanit = mailOlustur("Tamam\n\nAli <ali@ornek.com>, 26 Eyl 2026 Cmt 14:30 tarihinde şunu yazdı:\n> Eski metin\n>\n> İkinci", g, { acik: false });
  check("yanıt Gmail blockquote'unda", /<blockquote class="gmail_quote"[^>]*>.*Eski metin/.test(yanit.html));
  check("tarih satırı alıntının üstünde, kaçırılmış", yanit.html.includes('class="gmail_attr">Ali &lt;ali@ornek.com&gt;, 26 Eyl 2026 Cmt 14:30 tarihinde şunu yazdı:'));
  check("> önekleri soyuluyor", !yanit.html.includes("&gt; Eski") && yanit.html.includes(">Eski metin</p>"));
  const ilet = mailOlustur("Bak\n\n---------- İletilen ileti ---------\nKimden: Ali\nKonu: X\n\nGövde", g, { acik: false });
  check("iletmede çizgi yok, başlıklar var", !ilet.html.includes("<blockquote") && ilet.html.includes("Kimden: Ali<br>Konu: X") && ilet.html.includes(">Gövde</p>"));
}

console.log("\nİmza");
{
  const varsayilan = mailOlustur("selam", g, undefined);
  check("imza varsayılan açık, profil adı kullanılıyor", varsayilan.html.includes(">Eymen</div>"));
  check("düz metinde imza ayracı var", varsayilan.text.includes("\n-- \nEymen\neymen@akts.tr"));
  const kapali = mailOlustur("selam", g, { acik: false });
  check("kapalıyken imza yok", !kapali.html.includes("mailto:") && kapali.text === "selam");
  const tam = mailOlustur("selam", g, { ad: "Eymen Aktaş", unvan: "Kurucu", telefon: "+90 555 000 00 00", web: "akts.tr", renk: "#0b8043" });
  check("unvan, telefon ve web imzada", tam.html.includes("Kurucu") && tam.html.includes('href="tel:+905550000000"') && tam.html.includes('href="https://akts.tr/"'));
  check("kişisel renk kullanılıyor", tam.html.includes("background:#0b8043"));
  check("gönderen adı imzadan", gonderenAdi(g, { ad: "Eymen Aktaş" }) === "Eymen Aktaş");
  check("ad yoksa adresin yerel kısmı", gonderenAdi({ email: "yeliz@akts.tr", displayName: null }, undefined) === "yeliz");
  const yanitli = mailOlustur("Tamam\n\nAli, 26 Eyl 2026 Cmt 14:30 tarihinde şunu yazdı:\n> Eski metin", g, {});
  check("imza alıntının üstünde (HTML)", yanitli.html.indexOf("mailto:") < yanitli.html.indexOf("Eski metin"));
  check("imza alıntının üstünde (metin)", yanitli.text.indexOf("\n-- \n") < yanitli.text.indexOf("Eski metin"));
  check("geçersiz renk reddediliyor", !imzaSemasi.safeParse({ renk: "red;background:url(x)" }).success);
}

console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı`);
if (failed > 0) process.exit(1);
