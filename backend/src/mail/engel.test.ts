/**
 * Engel betiği testleri.
 * Çalıştır: npx tsx src/mail/engel.test.ts
 *
 * Betiğe kullanıcının girdiği adresler giriyor ve teslimatta Dovecot
 * çalıştırıyor. Kaçırma bozulursa bir adres betiğe komut ekleyebilir.
 */
import { sieveBetigi, engelGirdisi } from "./engel.js";

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

console.log("\nBetik");
{
  const bos = sieveBetigi([]);
  check("boş listede kural yok", !/require|discard/.test(bos), bos);
  const b = sieveBetigi(["spam@kotu.com", "@reklam.com"]);
  check("adres kuralı", b.includes('address :all :is "from" ["spam@kotu.com"]'), b);
  check("alan adı kuralı", b.includes('address :domain :is "from" ["reklam.com"]'), b);
  check("vacation 30 gün, Engellendiniz", /vacation :days 30 :subject "Engellendiniz"/.test(b), b);
  check("mail atılıyor", /discard;\s*stop;/.test(b), b);
  check("vacation eklentisi isteniyor", b.includes('require ["vacation"];'), b);
  const k = sieveBetigi(["a@b.co"], 'x"; discard; keep; "\\');
  check("mesajdaki tırnak ve ters bölü kaçırılıyor", k.includes('"x\\"; discard; keep; \\"\\\\"'), k);
}

console.log("\nGirdi doğrulama");
{
  check("adres kabul", engelGirdisi.safeParse("Kisi@Site.com").success);
  check("adres küçük harfe iniyor", engelGirdisi.parse(" Kisi@Site.com ") === "kisi@site.com");
  check("alan adı kabul", engelGirdisi.safeParse("@site.com").success);
  check("tırnaklı girdi reddediliyor", !engelGirdisi.safeParse('a"]; discard; #@x.com').success);
  check("çıplak alan adı reddediliyor", !engelGirdisi.safeParse("site.com").success);
}

console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı`);
if (failed > 0) process.exit(1);
