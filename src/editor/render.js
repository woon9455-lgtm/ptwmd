/** 슬라이드 그리기 — 편집 화면·썸네일·발표·인쇄가 모두 이 함수를 쓴다 */
import { LAYOUTS } from '../core/layouts.js';
import { S } from '../state.js';
import { onEdit, onPaste, onRegionDrop } from './editing.js';

/** 글이 칸을 넘치면 글자 크기를 줄여 맞춘다 (최소 45%) */
export function fit(region) {
  region.style.fontSize = '';
  if (region.scrollHeight <= region.clientHeight + 1) return;
  let size = parseFloat(getComputedStyle(region).fontSize);
  const min = size * 0.45;
  let n = 0;
  while (region.scrollHeight > region.clientHeight + 1 && size > min && n++ < 80) {
    size -= 1;
    region.style.fontSize = size + 'px';
  }
}

export function paintFrame(frame, slide) {
  const k = frame.dataset.k;
  const src = slide.fields[k];
  frame.classList.toggle('has', !!src);
  frame.classList.toggle('contain', slide.fields[k + ':fit'] === 'contain');
  frame.innerHTML = '';
  if (!src) return;
  const img = new Image();
  img.alt = '';
  img.src = src;
  img.draggable = false;
  img.onerror = () => {
    frame.innerHTML = '<div class="broken">⚠ 이미지를 불러올 수 없어요</div>';
  };
  frame.appendChild(img);
}

/**
 * @param {HTMLElement} host .slide 요소
 * @param {object} slide
 * @param {'edit'|'view'|'preview'} mode edit=편집 가능, view=보기(썸네일·발표·인쇄), preview=레이아웃 미리보기(빈칸 안내 표시)
 */
export function renderSlide(host, slide, mode) {
  const L = LAYOUTS[slide.layout] || LAYOUTS.content;
  host.className = `slide L-${LAYOUTS[slide.layout] ? slide.layout : 'content'} ${L.cls || ''} ${mode === 'view' ? 'view' : 'edit'}`;
  host.dataset.theme = S.doc?.theme || 'light';
  host.innerHTML = L.tpl;
  if (L.areas) for (const c of host.children) c.style.gridArea = c.dataset.k;

  for (const r of host.querySelectorAll('.region')) {
    r.innerHTML = slide.fields[r.dataset.k] || '';
    if (mode === 'edit') {
      r.contentEditable = 'true';
      r.spellcheck = false;
      r.addEventListener('input', () => onEdit(r));
      r.addEventListener('paste', onPaste);
      r.addEventListener('drop', onRegionDrop);
    }
  }
  for (const f of host.querySelectorAll('.frame')) {
    paintFrame(f, slide);
    if (mode === 'edit') f.tabIndex = 0;
  }

  const fitAll = () => host.querySelectorAll('.region').forEach(fit);
  requestAnimationFrame(fitAll);
  for (const img of host.querySelectorAll('.region img')) {
    if (!img.complete) img.addEventListener('load', fitAll, { once: true });
  }
}
