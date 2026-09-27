import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api.js";

/**
 * Engellenen hesaplar. Engel teslimatta sunucuda uygulanıyor: mail kutuya
 * hiç düşmüyor, gönderene bir kez "Engellendiniz" yanıtı gidiyor.
 */
export function Engellenenler() {
  const [liste, setListe] = useState<string[] | null>(null);
  const [adres, setAdres] = useState("");
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    api
      .engelListe()
      .then((r) => setListe(r.liste))
      .catch((e: Error) => setHata(e.message));
  }, []);

  async function degistir(hedef: string, kaldir: boolean) {
    setCalisiyor(true);
    setHata(null);
    try {
      const r = await api.engelle(hedef, kaldir);
      setListe(r.liste);
      if (!kaldir) setAdres("");
    } catch (err) {
      setHata(err instanceof ApiError ? err.message : "İşlem yapılamadı");
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div className="engel">
      <p className="engel-aciklama">
        Engellediğin adreslerden gelen mailler gelen kutuna hiç düşmez. Gönderene bir kez
        (30 günde en fazla bir) <b>“Engellendiniz”</b> yanıtı gider; posta listelerine ve
        otomatik gönderimlere yanıt verilmez. Tüm bir alan adı için <code>@site.com</code> yaz.
      </p>

      <form
        className="engel-ekle"
        onSubmit={(e) => {
          e.preventDefault();
          if (adres.trim()) void degistir(adres.trim(), false);
        }}
      >
        <input
          value={adres}
          onChange={(e) => setAdres(e.target.value)}
          placeholder="kisi@site.com ya da @site.com"
          inputMode="email"
          autoCapitalize="none"
          aria-label="Engellenecek adres"
        />
        <button className="btn btn-primary" disabled={calisiyor || !adres.trim()}>
          Engelle
        </button>
      </form>

      {hata && <p className="modal-error">{hata}</p>}

      {liste === null ? (
        <p className="modal-empty">Yükleniyor…</p>
      ) : liste.length === 0 ? (
        <p className="modal-empty">Engellenen hesap yok.</p>
      ) : (
        <ul className="engel-liste">
          {liste.map((a) => (
            <li key={a}>
              <span>{a}</span>
              <button className="btn-link" disabled={calisiyor} onClick={() => void degistir(a, true)}>
                Engeli kaldır
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
