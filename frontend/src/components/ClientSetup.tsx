import { useEffect, useState } from "react";
import { api, type StorageInfo } from "../lib/api.js";

function boyutFormatla(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${(bayt / 1024).toFixed(1)} KB`;
  if (bayt < 1024 * 1024 * 1024) return `${(bayt / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bayt / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ClientSetup({ email }: { email: string }) {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [kopyalandi, setKopyalandi] = useState<string | null>(null);

  useEffect(() => {
    api.storage().then(setInfo).catch(() => {});
  }, []);

  function kopyala(etiket: string, deger: string) {
    navigator.clipboard?.writeText(deger).then(() => {
      setKopyalandi(etiket);
      setTimeout(() => setKopyalandi((k) => (k === etiket ? null : k)), 1800);
    }).catch(() => {});
  }

  const domain = email.split("@")[1] ?? "akts.tr";
  const c = info?.client ?? {
    email,
    imapHost: `mail.${domain}`,
    imapPort: 993,
    imapSecurity: "SSL/TLS",
    smtpHost: `mail.${domain}`,
    smtpPort: 587,
    smtpSecurity: "STARTTLS",
  };

  const yuzde = info && info.quotaBytes > 0
    ? Math.min(100, Math.round((info.usedBytes / info.quotaBytes) * 1000) / 10)
    : 0;

  return (
    <div className="istemci-kart">
      <p className="engel-aciklama">
        Apple Mail, Thunderbird, Outlook veya telefonundaki herhangi bir IMAP istemcisini bu ayarlarla bağlayabilirsin.
      </p>

      {info && (
        <div className="kota-kutu">
          <div className="kota-ust">
            <b>Posta kutusu depolaması</b>
            <span>
              {boyutFormatla(info.usedBytes)} / {boyutFormatla(info.quotaBytes)} (%{yuzde})
            </span>
          </div>
          <div className="kota-ray">
            <div className="kota-dolgu" style={{ width: `${Math.max(yuzde, 2)}%` }} />
          </div>
        </div>
      )}

      <div className="istemci-grid">
        <div className="istemci-blok">
          <h4>Gelen Posta (IMAP)</h4>
          <dl>
            <div>
              <dt>Sunucu</dt>
              <dd>
                <code>{c.imapHost}</code>
                <button type="button" className="kopya-btn" onClick={() => kopyala("imap", c.imapHost)}>
                  {kopyalandi === "imap" ? "Kopyalandı" : "Kopyala"}
                </button>
              </dd>
            </div>
            <div><dt>Port</dt><dd><code>{c.imapPort}</code></dd></div>
            <div><dt>Güvenlik</dt><dd><code>{c.imapSecurity}</code></dd></div>
            <div><dt>Kullanıcı</dt><dd><code>{c.email}</code></dd></div>
          </dl>
        </div>

        <div className="istemci-blok">
          <h4>Giden Posta (SMTP)</h4>
          <dl>
            <div>
              <dt>Sunucu</dt>
              <dd>
                <code>{c.smtpHost}</code>
                <button type="button" className="kopya-btn" onClick={() => kopyala("smtp", c.smtpHost)}>
                  {kopyalandi === "smtp" ? "Kopyalandı" : "Kopyala"}
                </button>
              </dd>
            </div>
            <div><dt>Port</dt><dd><code>{c.smtpPort}</code></dd></div>
            <div><dt>Güvenlik</dt><dd><code>{c.smtpSecurity}</code></dd></div>
            <div><dt>Kullanıcı</dt><dd><code>{c.email}</code></dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
