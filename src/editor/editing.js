/** 글 칸 편집 · 붙여넣기 · 드롭 · 자동 저장 */
import { S, curSlide } from '../state.js';
import { putDoc } from '../core/storage.js';
import { esc, plain, setStatus } from '../lib/dom.js';
import { sanitize, textToHtml } from '../lib/sanitize.js';
import { normalizeUrl, prettyUrl, isImgUrl } from '../lib/url.js';
import { dtImages } from '../lib/images.js';
import { fit } from './render.js';
import { updateThumb } from './slides.js';

/* ---------- 자동 저장 ---------- */
let saveTimer = null;

export function save() {
  setStatus('저장 중…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 300);
}

/** 대기 중인 저장을 지금 바로 실행 */
export async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!S.doc) return;
  try {
    await putDoc(S.doc);
    setStatus('✓ 자동 저장됨');
  } catch (err) {
    console.error(err);
    setStatus('⚠ 저장 실패 — 파일로 저장을 이용하세요');
  }
}

export const hasPendingSave = () => saveTimer !== null;

/* ---------- 편집 ---------- */
let thumbTimer;
export function refreshThumb() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => updateThumb(S.cur), 250);
}

export function onEdit(region) {
  if (!region.textContent.trim() && !region.querySelector('img,table')) region.innerHTML = '';
  curSlide().fields[region.dataset.k] = region.innerHTML;
  fit(region);
  save();
  refreshThumb();
}

/** 붙여넣기·드롭 데이터를 글 칸에 넣을 HTML로 바꾼다 */
export async function dtToHtml(dt, region, selectedText) {
  const html = dt.getData('text/html');
  const text = dt.getData('text/plain');
  const single = (text || '').trim();

  // 주소 하나만 → 링크 (글자를 선택해 둔 상태면 그 글자에 링크)
  if (single && !/\s/.test(single) && /^(https?:\/\/|www\.)/i.test(single) && !isImgUrl(single)) {
    const href = normalizeUrl(single);
    const label = selectedText || (region.matches('.r-link,.r-source') ? prettyUrl(href) : single);
    return `<a href="${esc(href)}">${esc(label)}</a>${selectedText ? '' : '&nbsp;'}`;
  }
  let out = html ? sanitize(html) : text ? textToHtml(text) : '';
  if (!plain(out) && !/<img/.test(out)) {
    const imgs = await dtImages(dt);
    out = imgs.map((s) => `<img src="${esc(s)}">`).join('');
  }
  return out;
}

function insertHtml(region, html, range) {
  region.focus();
  if (range) {
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  document.execCommand('insertHTML', false, html);
  onEdit(region);
}

export async function onPaste(e) {
  e.preventDefault();
  const region = e.currentTarget;
  const sel = getSelection();
  const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const selected = range && !range.collapsed ? sel.toString() : '';
  const out = await dtToHtml(e.clipboardData, region, selected);
  if (out) insertHtml(region, out, range);
}

let internalDrag = false;
export function initEditing() {
  document.addEventListener('dragstart', () => (internalDrag = true));
  document.addEventListener('dragend', () => (internalDrag = false));
}

export async function onRegionDrop(e) {
  const dt = e.dataTransfer;
  if (internalDrag || dt.types.includes('text/slide')) return; // 칸 안에서 글 옮기기는 기본 동작
  e.preventDefault();
  const region = e.currentTarget;
  const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY) || null;
  const out = await dtToHtml(dt, region, '');
  if (out) insertHtml(region, out, pos);
}
