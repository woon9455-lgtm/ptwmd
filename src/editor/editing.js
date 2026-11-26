/** 글 칸 편집 · 붙여넣기 · 드롭 · 서버 자동 저장 */
import { S, curSlide } from '../state.js';
import { api } from '../api.js';
import { docBody } from '../core/model.js';
import { esc, plain, setStatus, toast } from '../lib/dom.js';
import { sanitize, textToHtml } from '../lib/sanitize.js';
import { normalizeUrl, prettyUrl, isImgUrl } from '../lib/url.js';
import { dtImages } from '../lib/images.js';
import { persistSrc, persistHtmlImages } from '../lib/upload.js';
import { fit } from './render.js';
import { updateThumb } from './slides.js';

/* ---------- 서버 자동 저장 ---------- */
const SAVE_DELAY = 800;
let saveTimer = null;
let saving = null; // 진행 중인 저장 Promise
let dirty = false; // 저장 중에 또 바뀜
let onConflict = async () => false;

/** 저장 충돌(다른 곳에서 먼저 수정) 처리기 등록 — true를 돌려주면 내 내용으로 덮어쓴다 */
export const setConflictHandler = (fn) => (onConflict = fn);

export function save() {
  if (!S.doc) return;
  dirty = true;
  setStatus('저장 중…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, SAVE_DELAY);
}

export const hasPendingSave = () => dirty || saveTimer !== null || saving !== null;

/** 대기 중인 저장을 지금 바로 실행 (끝날 때까지 기다림) */
export async function flushSave() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (saving) {
    await saving;
    if (dirty) return flushSave();
    return;
  }
  if (!dirty || !S.doc) return;
  const doc = S.doc;
  let retry = false;
  saving = (async () => {
    try {
      while (dirty && S.doc === doc) {
        dirty = false;
        const res = await api.saveDoc(doc.id, docBody(doc), doc.version);
        doc.version = res.version;
      }
      setStatus('✓ 서버에 저장됨');
    } catch (err) {
      dirty = true;
      if (err.status === 409) {
        setStatus('⚠ 다른 곳에서 수정된 문서');
        if (await onConflict(doc, err.data)) {
          doc.version = err.data.version; // 내 내용으로 덮어쓰기
          retry = true;
        } else dirty = false;
      } else if (err.status !== 401) {
        setStatus('⚠ 저장 실패 — 잠시 후 다시 시도해요');
        toast(err.message);
        setTimeout(() => dirty && S.doc === doc && save(), 5000);
      }
    }
  })();
  try {
    await saving;
  } finally {
    saving = null;
  }
  if (retry) return flushSave();
}

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

/** 붙여넣기·드롭 데이터를 글 칸에 넣을 HTML로 바꾼다 (사진은 서버에 올림) */
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
    if (imgs.length) setStatus('사진 올리는 중…');
    const urls = await Promise.all(imgs.map(persistSrc));
    out = urls.map((s) => `<img src="${esc(s)}">`).join('');
  }
  return persistHtmlImages(out);
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

async function safeDtToHtml(dt, region, selected) {
  try {
    return await dtToHtml(dt, region, selected);
  } catch (err) {
    toast(err.message || '붙여넣기에 실패했어요');
    return '';
  }
}

export async function onPaste(e) {
  e.preventDefault();
  const region = e.currentTarget;
  const sel = getSelection();
  const range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
  const selected = range && !range.collapsed ? sel.toString() : '';
  const out = await safeDtToHtml(e.clipboardData, region, selected);
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
  const out = await safeDtToHtml(dt, region, '');
  if (out) insertHtml(region, out, pos);
}
