/** 발표 모드 (F5) */
import { S, W, H } from '../state.js';
import { $ } from '../lib/dom.js';
import { renderSlide } from './render.js';
import { select } from './slides.js';
import { follow } from './links.js';

let idx = 0;

export const isPresenting = () => !$('#present').hidden;

export function present(from = 0) {
  idx = from;
  $('#present').hidden = false;
  document.documentElement.requestFullscreen?.().catch(() => {});
  showP(idx);
}

export function showP(i) {
  idx = Math.max(0, Math.min(i, S.doc.slides.length - 1));
  renderSlide($('#pslide'), S.doc.slides[idx], 'view');
  scaleP();
  $('#pcount').textContent = `${idx + 1} / ${S.doc.slides.length}`;
}

export function scaleP() {
  const k = Math.min(innerWidth / W, innerHeight / H);
  const w = $('#pwrap');
  w.style.width = W * k + 'px';
  w.style.height = H * k + 'px';
  $('#pslide').style.transform = `scale(${k})`;
}

export function exitP() {
  $('#present').hidden = true;
  if (document.fullscreenElement) document.exitFullscreen();
  select(idx);
}

/** 발표 중 키 처리 */
export function presentKey(e) {
  if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) {
    e.preventDefault();
    showP(idx + 1);
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) {
    e.preventDefault();
    showP(idx - 1);
  } else if (e.key === 'Home') showP(0);
  else if (e.key === 'End') showP(S.doc.slides.length - 1);
  else if (e.key === 'Escape') exitP();
}

export function initPresent() {
  const el = $('#present');
  el.addEventListener('click', (e) => {
    // 링크를 누르거나, 링크가 있는 카드의 아무 곳이나 누르면 그 링크를 연다
    const a = e.target.closest('a') || e.target.closest('.card,.hcard')?.querySelector('a');
    if (a) {
      e.preventDefault();
      follow(a.getAttribute('href'), true);
      return;
    }
    showP(idx + 1);
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showP(idx - 1);
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && isPresenting()) exitP();
  });
}
