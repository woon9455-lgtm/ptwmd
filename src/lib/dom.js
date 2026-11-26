/** DOM 공용 도우미 */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** HTML 문자열에서 글자만 뽑기 */
export function plain(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent.trim();
}

/** 노드가 속한 요소 (텍스트 노드면 부모) */
export const elOf = (node) => (node && node.nodeType === 1 ? node : node?.parentElement) || null;

export function toast(text) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 1800);
}

export function setStatus(text) {
  const el = $('#status');
  if (el) el.textContent = text;
}
