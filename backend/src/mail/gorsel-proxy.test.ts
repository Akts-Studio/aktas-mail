/**
 * Görsel vekili testleri.
 * Çalıştır: npx tsx src/mail/gorsel-proxy.test.ts
 */
process.env.DATABASE_URL ??= "postgres://x@127.0.0.1/x";
process.env.COOKIE_SECRET ??= "t".repeat(32);
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32).toString("base64url");

const { vekilAdresi, vekilAdresiniCoz, icAgAdresi, gorseliGetir } = await import("./gorsel-proxy.js");

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

console.log("\nGörsel vekili\n");

{
  const adres = "https://img.euromsg.net/x/images/hande%2Dyener%2D.jpg";
  const q = new URLSearchParams(vekilAdresi(adres).split("?")[1]);
  check("imzalı adres geri çözülüyor", vekilAdresiniCoz(q.get("u")!, q.get("s")!) === adres);
  check("başka adrese taşınan imza reddediliyor",
    vekilAdresiniCoz(Buffer.from("http://127.0.0.1/").toString("base64url"), q.get("s")!) === null);
  check("bozuk imza reddediliyor", vekilAdresiniCoz(q.get("u")!, "x") === null);
}

for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
  check(`iç ağ engelleniyor: ${ip}`, icAgAdresi(ip));
}
for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) {
  check(`dış adres geçiyor: ${ip}`, !icAgAdresi(ip));
}

check("localhost'a istek atılmıyor", (await gorseliGetir("http://localhost/a.png")) === null);
check("metadata adresine istek atılmıyor", (await gorseliGetir("http://169.254.169.254/latest/meta-data")) === null);
check("standart dışı port reddediliyor", (await gorseliGetir("https://example.com:8443/a.png")) === null);

console.log(`\nSonuç: ${passed} geçti, ${failed} kaldı\n`);
process.exit(failed === 0 ? 0 : 1);
