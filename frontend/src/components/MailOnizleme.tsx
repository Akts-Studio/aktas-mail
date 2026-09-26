/**
 * Giden mailin alıcıda nasıl görüneceği. HTML'i sunucu üretiyor
 * (backend/src/mail/sablon.ts) — gönderilenle birebir aynı.
 *
 * Mail istemcileri beyaz zeminde gösterdiği için önizleme de koyu
 * temada bile beyaz kalıyor. `sandbox=""`: betik yok, form yok,
 * bağlantılar çerçeve içinde açılmıyor.
 */
export function MailOnizleme({
  html,
  gonderen,
  email,
  yukleniyor,
}: {
  html: string | null;
  gonderen?: string;
  email?: string;
  yukleniyor?: boolean;
}) {
  return (
    <div className={`mail-onizleme ${yukleniyor ? "is-yukleniyor" : ""}`}>
      {gonderen && (
        <div className="mail-onizleme-bas">
          <span>Alıcı böyle görecek</span>
          <b>
            {gonderen} <span>&lt;{email}&gt;</span>
          </b>
        </div>
      )}
      {html ? (
        <iframe title="Mail önizlemesi" sandbox="" srcDoc={html} />
      ) : (
        <p className="mail-onizleme-bos">Önizleme hazırlanıyor…</p>
      )}
    </div>
  );
}
