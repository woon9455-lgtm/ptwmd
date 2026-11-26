/** 사진 칸: 클릭해서 고르기 · 끌어다 놓기 · Ctrl+V 붙여넣기 */
import { S, curSlide } from '../state.js';
import { $, toast, setStatus } from '../lib/dom.js';
import { fileToDataUrl, dtImages } from '../lib/images.js';
import { persistSrc } from '../lib/upload.js';
import { paintFrame } from './render.js';
import { save, refreshThumb } from './editing.js';
import { hidePop, showPopAt, setPop } from './popover.js';

let pickTarget = null;
let hoverFrame = null;

export function pickImage(frame) {
  pickTarget = frame;
  const input = $('#imgIn');
  input.value = '';
  input.click();
}

/**
 * 첫 장은 고른 칸에, 나머지는 그 뒤(모자라면 앞)의 빈 칸에 차례로 넣는다.
 * 붙여넣은 사진(data:)은 서버에 올린 뒤 서버 주소로 저장한다.
 */
export async function fillFrames(frame, srcs) {
  if (!srcs.length) return;
  const s = curSlide();
  const frames = [...$('#slide').querySelectorAll('.frame')];
  const idx = frames.indexOf(frame);
  if (idx < 0) return;
  const empty = (x) => !s.fields[x.dataset.k];
  const targets = [frame, ...frames.slice(idx + 1).filter(empty), ...frames.slice(0, idx).filter(empty)];
  const use = srcs.slice(0, targets.length);
  if (srcs.length > targets.length) toast(`칸이 부족해서 ${srcs.length - targets.length}장은 넣지 못했어요`);
  hidePop();

  targets.slice(0, use.length).forEach((t) => t.classList.add('loading'));
  setStatus('사진 올리는 중…');
  const results = await Promise.allSettled(use.map(persistSrc));
  let failed = 0;
  results.forEach((r, i) => {
    const t = targets[i];
    t.classList.remove('loading');
    if (r.status !== 'fulfilled') return failed++;
    s.fields[t.dataset.k] = r.value;
    if (t.isConnected) paintFrame(t, s);
  });
  if (failed)
    toast(`사진 ${failed}장을 올리지 못했어요: ${results.find((r) => r.status === 'rejected').reason?.message || ''}`);
  save();
  refreshThumb();
  if (frame.isConnected) frame.focus();
}

export function clearFrame(frame) {
  const s = curSlide();
  delete s.fields[frame.dataset.k];
  delete s.fields[frame.dataset.k + ':fit'];
  paintFrame(frame, s);
  save();
  refreshThumb();
  hidePop();
}

export function framePop(frame) {
  const k = frame.dataset.k;
  const s = curSlide();
  const contain = s.fields[k + ':fit'] === 'contain';
  setPop(
    `<button data-f="pick">🖼 사진 바꾸기</button><button data-f="fit">${contain ? '⛶ 칸 꽉 채우기' : '▣ 사진 전체 보기'}</button><button data-f="del">🗑 삭제</button><span class="muted">Ctrl+V로 교체</span>`,
    (e) => {
      const a = e.target.dataset.f;
      if (a === 'pick') pickImage(frame);
      else if (a === 'fit') {
        s.fields[k + ':fit'] = contain ? '' : 'contain';
        paintFrame(frame, s);
        save();
        refreshThumb();
        framePop(frame);
      } else if (a === 'del') clearFrame(frame);
    },
  );
  showPopAt(frame, true);
}

/** 사진 칸 클릭 처리 — 처리했으면 true */
export function handleFrameClick(e) {
  const f = e.target.closest('.frame');
  if (!f) return false;
  f.focus();
  if (f.classList.contains('has')) framePop(f);
  else {
    hidePop();
    pickImage(f);
  }
  return true;
}

/** 사진 칸에 포커스가 있을 때의 키 처리 — 처리했으면 true */
export function handleFrameKey(e) {
  const f = document.activeElement;
  if (!f?.classList?.contains('frame')) return false;
  if ((e.key === 'Delete' || e.key === 'Backspace') && f.classList.contains('has')) {
    e.preventDefault();
    clearFrame(f);
    return true;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    pickImage(f);
    return true;
  }
  return false;
}

export function initFrames() {
  const slideEl = $('#slide');

  $('#imgIn').onchange = async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    if (!files.length || !pickTarget?.isConnected) return;
    fillFrames(pickTarget, (await Promise.all(files.map(fileToDataUrl))).filter(Boolean));
  };

  slideEl.addEventListener('mouseover', (e) => (hoverFrame = e.target.closest('.frame')));
  slideEl.addEventListener('mouseleave', () => (hoverFrame = null));

  slideEl.addEventListener('dragover', (e) => {
    const f = e.target.closest('.frame');
    slideEl.querySelectorAll('.frame.drag').forEach((x) => x !== f && x.classList.remove('drag'));
    if (f && !e.dataTransfer.types.includes('text/slide')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      f.classList.add('drag');
    }
  });
  slideEl.addEventListener('dragleave', (e) => {
    const f = e.target.closest('.frame');
    if (f && !f.contains(e.relatedTarget)) f.classList.remove('drag');
  });
  slideEl.addEventListener('drop', async (e) => {
    const f = e.target.closest('.frame');
    if (!f) return;
    e.preventDefault();
    f.classList.remove('drag');
    const srcs = await dtImages(e.dataTransfer);
    if (srcs.length) fillFrames(f, srcs);
    else toast('이미지를 찾지 못했어요. 사진 파일이나 웹 이미지를 끌어다 놓으세요');
  });

  // 파일을 칸 밖에 떨어뜨려도 브라우저가 파일을 열지 않게
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    if (e.dataTransfer.types.includes('Files') && !e.target.closest('.region,.frame')) {
      e.preventDefault();
      toast('사진은 점선 칸 위에 놓아 주세요');
    }
  });

  // 사진 칸에 붙여넣기 (칸을 클릭했거나 마우스를 올려둔 상태)
  document.addEventListener('paste', async (e) => {
    if (e.defaultPrevented || !S.doc) return;
    const ae = document.activeElement;
    if (ae && (ae.isContentEditable || /INPUT|TEXTAREA/.test(ae.tagName))) return;
    const f = ae?.classList?.contains('frame') && slideEl.contains(ae) ? ae : hoverFrame;
    if (!f) return;
    e.preventDefault();
    const srcs = await dtImages(e.clipboardData);
    if (srcs.length) fillFrames(f, srcs);
    else toast('클립보드에 이미지가 없어요 (이미지 우클릭 → 이미지 복사)');
  });
}
