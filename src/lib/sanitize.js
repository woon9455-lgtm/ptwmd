/**
 * 붙여넣은 HTML 정리.
 * 허용한 태그(굵게·목록·표·링크·이미지 등)만 남기고 스타일·스크립트는 제거한다.
 */
import { URL_RE, safeUrl } from './url.js';

const ALLOWED = {
  B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', A: 'a', BR: 'br', P: 'p', DIV: 'p',
  UL: 'ul', OL: 'ol', LI: 'li', IMG: 'img',
  H1: 'h', H2: 'h', H3: 'h', H4: 'h', H5: 'h', H6: 'h',
  TABLE: 'table', THEAD: 'thead', TBODY: 'tbody', TR: 'tr', TD: 'td', TH: 'th',
  BLOCKQUOTE: 'blockquote', SUB: 'sub', SUP: 'sup', MARK: 'mark',
}; // prettier-ignore

const DROP = new Set([
  'SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG',
  'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'NAV', 'HEAD',
]); // prettier-ignore

/** 편집기가 직접 넣는 이미지 크기 스타일만 유지 */
const IMG_STYLE_RE = /^width:\s*\d+%;?(\s*max-height:\s*none;?)?$/;

/** 텍스트를 넣으면서 주소는 자동으로 링크로 바꾼다 */
export function appendText(dst, text, inLink = false) {
  const doc = dst.ownerDocument;
  if (inLink) {
    dst.appendChild(doc.createTextNode(text));
    return;
  }
  let last = 0;
  text.replace(URL_RE, (m, _a, _b, idx) => {
    if (idx > last) dst.appendChild(doc.createTextNode(text.slice(last, idx)));
    const a = doc.createElement('a');
    a.setAttribute('href', m.startsWith('www.') ? 'https://' + m : m);
    a.textContent = m;
    dst.appendChild(a);
    last = idx + m.length;
    return m;
  });
  if (last < text.length) dst.appendChild(doc.createTextNode(text.slice(last)));
}

export function sanitize(html) {
  const src = new DOMParser().parseFromString(html || '', 'text/html').body;
  const out = document.createElement('div');

  (function walk(from, to, inLink) {
    for (const n of from.childNodes) {
      if (n.nodeType === 3) {
        appendText(to, n.nodeValue, inLink);
        continue;
      }
      if (n.nodeType !== 1 || DROP.has(n.tagName)) continue;
      const m = ALLOWED[n.tagName];
      if (!m) {
        walk(n, to, inLink);
        continue;
      }
      if (m === 'img') {
        const s = n.getAttribute('src');
        if (s && /^(https?:|data:image\/)/i.test(s)) {
          const img = document.createElement('img');
          img.setAttribute('src', s);
          const st = n.getAttribute('style');
          if (st && IMG_STYLE_RE.test(st.trim())) img.setAttribute('style', st);
          to.appendChild(img);
        }
        continue;
      }
      if (m === 'br') {
        to.appendChild(document.createElement('br'));
        continue;
      }
      if (m === 'h') {
        const p = document.createElement('p');
        const b = document.createElement('b');
        p.appendChild(b);
        walk(n, b, inLink);
        to.appendChild(p);
        continue;
      }
      if (m === 'a') {
        const h = safeUrl(n.getAttribute('href'));
        if (!h || inLink) {
          walk(n, to, inLink);
          continue;
        }
        const a = document.createElement('a');
        a.setAttribute('href', h);
        walk(n, a, true);
        to.appendChild(a);
        continue;
      }
      const el = document.createElement(m);
      if (m === 'td' || m === 'th') {
        for (const at of ['colspan', 'rowspan']) {
          const v = n.getAttribute(at);
          if (v && /^\d+$/.test(v)) el.setAttribute(at, v);
        }
      }
      walk(n, el, inLink);
      to.appendChild(el);
    }
  })(src, out, false);

  for (const e of out.querySelectorAll('p,b,i,u')) {
    if (!e.textContent.trim() && !e.querySelector('img,br')) e.remove();
  }
  return out.innerHTML.trim();
}

/** 일반 텍스트 → HTML (줄바꿈 유지, 주소 자동 링크) */
export function textToHtml(text) {
  const d = document.createElement('div');
  (text || '')
    .replace(/\r/g, '')
    .split('\n')
    .forEach((line, i) => {
      if (i) d.appendChild(document.createElement('br'));
      appendText(d, line, false);
    });
  return d.innerHTML;
}
