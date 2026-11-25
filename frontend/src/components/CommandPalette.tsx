import { useEffect, useMemo, useRef, useState } from "react";

export interface KomutOgesi {
  id: string;
  etiket: string;
  grup: string;
  kisayol?: string;
  calistir: () => void;
}

export function CommandPalette({
  komutlar,
  onClose,
}: {
  komutlar: KomutOgesi[];
  onClose: () => void;
}) {
  const [sorgu, setSorgu] = useState("");
  const [secili, setSecili] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtreli = useMemo(() => {
    const q = sorgu.trim().toLowerCase();
    if (!q) return komutlar;
    return komutlar.filter(
      (k) =>
        k.etiket.toLowerCase().includes(q) ||
        k.grup.toLowerCase().includes(q),
    );
  }, [komutlar, sorgu]);

  useEffect(() => {
    setSecili(0);
  }, [sorgu]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSecili((s) => (filtreli.length ? (s + 1) % filtreli.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSecili((s) => (filtreli.length ? (s - 1 + filtreli.length) % filtreli.length : 0));
      } else if (e.key === "Enter" && filtreli[secili]) {
        e.preventDefault();
        const k = filtreli[secili];
        onClose();
        k.calistir();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtreli, secili, onClose]);

  return (
    <div
      className="cmd-backdrop"
      role="dialog"
      aria-label="Komut paleti"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmd-box">
        <div className="cmd-head">
          <svg className="cmd-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Komut veya klasör ara…"
            value={sorgu}
            onChange={(e) => setSorgu(e.target.value)}
          />
          <kbd className="cmd-esc">Esc</kbd>
        </div>

        <div className="cmd-list" role="listbox">
          {filtreli.length === 0 ? (
            <div className="cmd-empty">Eşleşen komut yok.</div>
          ) : (
            filtreli.map((k, i) => (
              <button
                key={k.id}
                role="option"
                aria-selected={i === secili}
                className={`cmd-item ${i === secili ? "is-active" : ""}`}
                onMouseEnter={() => setSecili(i)}
                onClick={() => {
                  onClose();
                  k.calistir();
                }}
              >
                <span className="cmd-item-label">{k.etiket}</span>
                <span className="cmd-item-right">
                  <span className="cmd-item-group">{k.grup}</span>
                  {k.kisayol && <kbd className="cmd-key">{k.kisayol}</kbd>}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
