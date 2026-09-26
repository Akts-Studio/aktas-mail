import { useState } from "react";
import { api, ApiError } from "../lib/api.js";
import { MailOnizleme } from "./MailOnizleme.js";

export interface Draft {
  to: string;
  subject: string;
  text: string;
  /** Yanıtsa: Gmail'in konuşmayı gruplaması için */
  inReplyTo?: string;
  references?: string[];
}

export function Compose({
  draft,
  from,
  onClose,
  onSent,
}: {
  draft: Draft;
  from: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [text, setText] = useState(draft.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Alıcının göreceği hâl; null = düzenleme kipi. */
  const [onizleme, setOnizleme] = useState<{ html: string; gonderen: string; email: string } | null>(null);
  /** Kapanış animasyonu oynarken true; bitince asıl `onClose` çağrılıyor. */
  const [kapaniyor, setKapaniyor] = useState(false);

  function kapat() {
    if (kapaniyor) return;
    // Hareket azaltılmışsa animasyon yok, beklemeden kapat
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onClose();
    else setKapaniyor(true);
  }

  /** "a@b.c, d@e.f" → ["a@b.c","d@e.f"] */
  function adresler(s: string): string[] {
    return s
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  async function onizlemeAc() {
    setError(null);
    try {
      setOnizleme(await api.preview(text));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Önizleme alınamadı");
    }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    const alicilar = adresler(to);
    if (alicilar.length === 0) {
      setError("En az bir alıcı gerekiyor.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const cclar = adresler(cc);
      const res = await api.send({
        to: alicilar,
        ...(cclar.length ? { cc: cclar } : {}),
        subject,
        text,
        ...(draft.inReplyTo ? { inReplyTo: draft.inReplyTo } : {}),
        ...(draft.references?.length ? { references: draft.references } : {}),
      });
      if (!res.savedToSent) {
        // Gönderim başarılı ama Sent'e yazılamadı — sessizce geçme
        console.warn("Mail gönderildi ama Gönderilenler klasörüne yazılamadı");
      }
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="compose-wrap" role="dialog" aria-label="Yeni mesaj">
      <form
        className={`compose ${kapaniyor ? "is-kapaniyor" : ""}`}
        onSubmit={(e) => void gonder(e)}
        onAnimationEnd={(e) => {
          if (kapaniyor && e.target === e.currentTarget) onClose();
        }}
      >
        <div className="compose-bar">
          <span>Yeni mesaj</span>
          <button type="button" className="icon-btn" onClick={kapat} title="Kapat">
            ✕
          </button>
        </div>

        <div className="compose-from">
          <span>Kimden</span>
          <b>{from}</b>
        </div>

        <label className="compose-field">
          <span>Kime</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="ornek@site.com, ikinci@site.com"
            autoFocus={!to}
            required
          />
          {!ccOpen && (
            <button type="button" className="btn-link cc-toggle" onClick={() => setCcOpen(true)}>
              Cc
            </button>
          )}
        </label>

        {ccOpen && (
          <label className="compose-field">
            <span>Cc</span>
            <input value={cc} onChange={(e) => setCc(e.target.value)} />
          </label>
        )}

        <label className="compose-field">
          <span>Konu</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            autoFocus={!!to}
          />
        </label>

        {onizleme ? (
          <div className="compose-onizleme">
            <MailOnizleme html={onizleme.html} gonderen={onizleme.gonderen} email={onizleme.email} />
          </div>
        ) : (
          <textarea
            className="compose-body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mesajını yaz… İmzan gönderirken altına eklenir."
          />
        )}

        {error && <p className="compose-error">{error}</p>}

        <div className="compose-foot">
          <button className={`btn btn-primary gonder-dugme ${busy ? "is-gidiyor" : ""}`} disabled={busy}>
            {busy ? "Gönderiliyor…" : "Gönder"}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => (onizleme ? setOnizleme(null) : void onizlemeAc())}
          >
            {onizleme ? "Düzenle" : "Önizle"}
          </button>
          <button type="button" className="btn-link" onClick={kapat}>
            Vazgeç
          </button>
        </div>
      </form>
    </div>
  );
}
