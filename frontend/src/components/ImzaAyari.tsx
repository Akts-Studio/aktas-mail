import { useEffect, useState } from "react";
import { api, ApiError, type Imza } from "../lib/api.js";
import { MailOnizleme } from "./MailOnizleme.js";

/** İmza rengi seçenekleri — mail istemcilerinde iki temada da okunan tonlar. */
const RENKLER = ["#1a73e8", "#0b8043", "#d93025", "#e37400", "#8430ce", "#12808c", "#202124"];

const ORNEK_METIN =
  "Merhaba,\n\nİmzam her mailin altında bu şekilde görünecek.\n\nİyi çalışmalar.";

/**
 * Kişisel imza: her kullanıcının kendi hesabında saklanıyor, giden
 * maillerin altına sunucu ekliyor. Önizleme kaydedilmemiş hâli gösteriyor.
 */
export function ImzaAyari() {
  const [imza, setImza] = useState<Imza | null>(null);
  const [onizleme, setOnizleme] = useState<{ html: string; gonderen: string; email: string } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    api
      .profile()
      .then((r) => setImza(r.profile?.settings?.imza ?? {}))
      .catch(() => setImza({}));
  }, []);

  // Yazarken her tuşta istek atmasın
  useEffect(() => {
    if (!imza) return;
    setYukleniyor(true);
    const z = setTimeout(() => {
      api
        .preview(ORNEK_METIN, imza)
        .then((r) => {
          setOnizleme(r);
          setHata(null);
        })
        .catch((e) => setHata(e instanceof ApiError ? e.message : "Önizleme alınamadı"))
        .finally(() => setYukleniyor(false));
    }, 300);
    return () => clearTimeout(z);
  }, [imza]);

  function degistir(alan: keyof Imza, deger: string | boolean) {
    setMesaj(null);
    setImza((i) => ({ ...i, [alan]: deger }));
  }

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!imza) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      await api.saveSettings({ imza });
      setMesaj("İmza kaydedildi. Bundan sonraki maillerinde kullanılacak.");
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : "Kaydedilemedi");
    } finally {
      setKaydediliyor(false);
    }
  }

  if (!imza) return <p className="modal-empty">Yükleniyor…</p>;
  const acik = imza.acik !== false;

  return (
    <form className="imza" onSubmit={(e) => void kaydet(e)}>
      <label className="imza-ac">
        <input type="checkbox" checked={acik} onChange={(e) => degistir("acik", e.target.checked)} />
        <span>Giden maillerime imza ekle</span>
      </label>

      <fieldset className="imza-alanlar" disabled={!acik}>
        <label className="field">
          <span>Ad</span>
          <input value={imza.ad ?? ""} maxLength={80} placeholder={onizleme?.gonderen}
                 onChange={(e) => degistir("ad", e.target.value)} />
        </label>
        <label className="field">
          <span>Unvan</span>
          <input value={imza.unvan ?? ""} maxLength={80} placeholder="Ör. Kurucu, Akts Studio"
                 onChange={(e) => degistir("unvan", e.target.value)} />
        </label>
        <label className="field">
          <span>Telefon</span>
          <input value={imza.telefon ?? ""} maxLength={40} inputMode="tel" placeholder="+90 5xx xxx xx xx"
                 onChange={(e) => degistir("telefon", e.target.value)} />
        </label>
        <label className="field">
          <span>Web sitesi</span>
          <input value={imza.web ?? ""} maxLength={120} inputMode="url" placeholder="akts.tr"
                 onChange={(e) => degistir("web", e.target.value)} />
        </label>
        <label className="field imza-genis">
          <span>Kısa not</span>
          <input value={imza.not ?? ""} maxLength={200} placeholder="Ör. Genelde 24 saat içinde dönüyorum."
                 onChange={(e) => degistir("not", e.target.value)} />
        </label>
        <div className="imza-genis">
          <span className="imza-etiket">Renk</span>
          <div className="imza-renkler" role="radiogroup" aria-label="İmza rengi">
            {RENKLER.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={(imza.renk ?? RENKLER[0]) === r}
                aria-label={r}
                className={`imza-renk ${(imza.renk ?? RENKLER[0]) === r ? "is-secili" : ""}`}
                style={{ background: r }}
                onClick={() => degistir("renk", r)}
              />
            ))}
          </div>
        </div>
      </fieldset>

      <MailOnizleme
        html={onizleme?.html ?? null}
        {...(onizleme ? { gonderen: onizleme.gonderen, email: onizleme.email } : {})}
        yukleniyor={yukleniyor}
      />

      <div className="pp-satir">
        <button className="btn btn-primary" disabled={kaydediliyor}>
          {kaydediliyor ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
      {mesaj && <p className="modal-ok">{mesaj}</p>}
      {hata && <p className="modal-error">{hata}</p>}
    </form>
  );
}
