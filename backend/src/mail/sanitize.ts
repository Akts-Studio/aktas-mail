import sanitizeHtml from "sanitize-html";

/**
 * Gelen mailin gövdesi SALDIRGANIN YAZDIĞI HTML'dir.
 * Bir posta istemcisinde en büyük risk SQL injection değil, budur.
 *
 * Buradan çıkan HTML yine de doğrudan sayfaya basılmaz — istemci onu
 * `sandbox` iframe içinde gösterir (allow-scripts YOK). Bu modül
 * sunucu tarafındaki ilk savunma katmanı.
 */

/** Uzak görsel = takip pikseli. Gönderen; mailin okunduğunu, IP'yi ve saati öğrenir. */
const PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export interface SanitizeResult {
  html: string;
  /** Engellenen uzak görsel sayısı — arayüzde "Görselleri göster" için */
  blockedImages: number;
  /** Dışarıya giden link sayısı — phishing uyarısı için */
  externalLinks: number;
}

/**
 * Bir href'in dışarıya taşınmasının güvenli olup olmadığı.
 * allowedSchemes ile aynı listeyi tutar; ikisi ayrışırsa açık doğar.
 */
function isSafeHref(href: string): boolean {
  return /^(https?|mailto|tel):/i.test(href.trim());
}

/**
 * Mail tasarımlarının dayandığı düzen stilleri. Önceden yalnız renk, yazı
 * ve padding/margin geçiyordu; genişlik, kenarlık, köşe, arka plan ve
 * display silindiği için pazarlama mailleri dağılıyor, gizli önizleme
 * metinleri görünüyor, düğmeler düz yazıya dönüyordu. Gmail bunların
 * hepsini geçiriyor.
 *
 * Değer süzgeci: url(), expression(), javascript:, @import ve CSS'ten
 * çıkmaya yarayan karakterler yasak. Arka plan görselleri ayrı: yalnız
 * https/cid/data:image. Yüklenip yüklenmediğine yine iframe'in CSP'si
 * karar veriyor (görseller kapalıyken img-src yalnız data:).
 */
const DEGER = /^(?![\s\S]*(url\s*\(|expression|javascript:|vbscript:|behavior|binding|@import))[^;{}<>\\]+$/i;
const GORSELLI = /^(?![\s\S]*(expression|javascript:|vbscript:|behavior|binding|@import))(?:[^;{}<>\\()]|url\(\s*['"]?(?:https:|cid:|data:image\/)[^'")\s]*['"]?\s*\)|\([^()]*\))+$/i;

const SERBEST_STILLER = [
  "color", "background-color", "opacity",
  "font", "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-decoration",
  "text-decoration-color", "text-transform", "text-indent", "text-shadow", "white-space",
  "word-break", "word-wrap", "overflow-wrap", "vertical-align", "direction",
  "display", "visibility", "overflow", "overflow-x", "overflow-y", "box-sizing", "float", "clear",
  "width", "min-width", "max-width", "height", "min-height", "max-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-width", "border-style", "border-color", "border-radius",
  "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius",
  "border-top-color", "border-bottom-color", "border-left-color", "border-right-color",
  "border-top-width", "border-bottom-width", "border-left-width", "border-right-width",
  "border-top-style", "border-bottom-style", "border-left-style", "border-right-style",
  "border-collapse", "border-spacing", "table-layout", "list-style", "list-style-type",
  "outline", "box-shadow", "object-fit", "background-size", "background-position",
  "background-repeat", "mso-hide", "gap",
];

const STIL_KURALLARI: Record<string, RegExp[]> = Object.fromEntries([
  ...SERBEST_STILLER.map((ad) => [ad, [DEGER]]),
  ["background", [GORSELLI]],
  ["background-image", [GORSELLI]],
]);

/**
 * <style> bloğunun içi. Mail yalıtılmış çerçevede açılıyor, yani bu CSS
 * yalnız mailin kendisini etkiliyor; yine de dış kaynak yükleyen ve
 * bindirme yapan her şey çıkarılıyor.
 */
function stilBlogunuTemizle(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(/@font-face\s*\{[^}]*\}/gi, "")
    .replace(/url\(\s*['"]?(?!https:|cid:|data:image\/)[^)]*\)/gi, "none")
    .replace(/expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding/gi, "")
    .replace(/(position|z-index)\s*:[^;}]*/gi, "");
}

export function sanitizeEmailHtml(
  dirty: string,
  opts: { allowRemoteImages?: boolean } = {},
): SanitizeResult {
  const allowRemoteImages = opts.allowRemoteImages ?? false;

  let blockedImages = 0;
  let externalLinks = 0;

  const html = sanitizeHtml(dirty, {
    allowedTags: [
      "p", "div", "span", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "strong", "b", "em", "i", "u", "s", "sub", "sup", "small",
      "ul", "ol", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code",
      "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
      "a", "img", "center", "font", "style",
      // script, iframe, form, object, embed, link, base BİLEREK YOK.
      // <style> var: içi aşağıda stilBlogunuTemizle'den geçiyor.
    ],
    allowVulnerableTags: true,

    // DİKKAT: transformTags'in eklediği öznitelikler de burada izinli olmalı —
    // filtre transform'dan SONRA çalışıyor, aksi halde rel/noopener sessizce düşer.
    // Tablo düzenli maillerin eski öznitelikleri (bgcolor, align, width…)
    allowedAttributes: {
      a: ["href", "title", "rel", "target", "data-external-href"],
      img: ["src", "alt", "title", "width", "height", "border", "align", "data-blocked-src"],
      td: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "nowrap"],
      th: ["colspan", "rowspan", "align", "valign", "width", "height", "bgcolor", "nowrap"],
      tr: ["align", "valign", "bgcolor", "height"],
      table: ["width", "height", "border", "cellpadding", "cellspacing", "align", "bgcolor", "role"],
      font: ["color", "size", "face"],
      "*": ["style", "class", "dir", "align", "lang"], // style aşağıda allowedStyles ile süzülüyor
    },

    // javascript:, data: (görsel hariç), vbscript: hepsi eler
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
    allowProtocolRelative: false,

    // Sadece görünüm etkileyen, davranış değiştirmeyen özellikler
    // position/z-index/transform listede YOK: sayfa üstüne bindirme engeli
    allowedStyles: { "*": STIL_KURALLARI },

    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs["href"] ?? "";
        if (/^https?:\/\//i.test(href)) externalLinks += 1;
        return {
          tagName: "a",
          attribs: {
            ...attribs,
            // noopener: açılan sayfa window.opener ile bize erişemesin
            rel: "noopener noreferrer nofollow",
            target: "_blank",
            // İstemci bunu okuyup phishing uyarı ekranı gösterir. ŞEMAYI BURADA DA
            // doğrulamak şart: allowedSchemes yalnızca href'i temizler, bu kopyayı
            // değil — kontrolsüz bırakılırsa javascript:/data: URL'i geri sızar.
            ...(isSafeHref(href) ? { "data-external-href": href } : {}),
          },
        };
      },

      img: (tagName, attribs) => {
        const src = attribs["src"] ?? "";
        const isRemote = /^https?:\/\//i.test(src);
        if (isRemote && !allowRemoteImages) {
          blockedImages += 1;
          return {
            tagName: "img",
            attribs: {
              src: PLACEHOLDER,
              alt: attribs["alt"] ?? "",
              "data-blocked-src": src, // kullanıcı isterse istemci geri yükler
              style: "opacity:.35",
            },
          };
        }
        return { tagName: "img", attribs };
      },
    },

    // <script>/<style> içeriği metin olarak bile sızmasın
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "title"],
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  });

  return {
    html: html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_t, a, css, b) => a + stilBlogunuTemizle(css) + b),
    blockedImages,
    externalLinks,
  };
}

/**
 * Düz metin gövdeler için: HTML kaçışı + linkleri güvenli <a>'ya çevirme.
 * text/plain mailler HTML yolundan geçmemeli, o yüzden ayrı.
 */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return escaped
    .replace(
      /\b(https?:\/\/[^\s<]+)/g,
      '<a href="$1" rel="noopener noreferrer nofollow" target="_blank" data-external-href="$1">$1</a>',
    )
    .replace(/\n/g, "<br>");
}
