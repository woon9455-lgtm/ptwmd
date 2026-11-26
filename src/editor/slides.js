/** 슬라이드 목록(썸네일)과 편집 화면 */
import { S, curSlide, W, H } from '../state.js';
import { LAYOUTS, DEFAULT_LAYOUT } from '../core/layouts.js';
import { newSlide, uid, slideHasContent } from '../core/model.js';
import { $, toast } from '../lib/dom.js';
import { renderSlide } from './render.js';
import { save } from './editing.js';
import { hidePop } from './popover.js';

export function nextLayout() {
  const l = curSlide()?.layout;
  return !l || l === 'title' || l === 'section' ? DEFAULT_LAYOUT : l;
}

export function renderThumbs() {
  const box = $('#thumbs');
  box.innerHTML = '';
  S.doc.slides.forEach((s, i) => {
    const t = document.createElement('div');
    t.className = 'thumb' + (i === S.cur ? ' active' : '');
    t.draggable = true;
    t.innerHTML = `<span class="num">${i + 1}</span><div class="tframe"><div class="slide"></div></div><div class="tools"><button data-a="dup" title="복제">⧉</button><button data-a="del" title="삭제">🗑</button></div>`;
    renderSlide(t.querySelector('.slide'), s, 'view');
    t.onclick = (e) => {
      const a = e.target.dataset.a;
      if (a === 'dup') dupSlide(i);
      else if (a === 'del') delSlide(i);
      else select(i);
    };
    t.ondragstart = (e) => e.dataTransfer.setData('text/slide', String(i));
    t.ondragover = (e) => {
      if (!e.dataTransfer.types.includes('text/slide')) return;
      e.preventDefault();
      box.querySelectorAll('.dropBefore').forEach((x) => x.classList.remove('dropBefore'));
      t.classList.add('dropBefore');
    };
    t.ondragleave = () => t.classList.remove('dropBefore');
    t.ondrop = (e) => {
      if (!e.dataTransfer.types.includes('text/slide')) return;
      e.preventDefault();
      t.classList.remove('dropBefore');
      moveSlide(+e.dataTransfer.getData('text/slide'), i);
    };
    box.appendChild(t);
  });
  const add = document.createElement('button');
  add.className = 'addThumb';
  add.textContent = '＋ 슬라이드 추가';
  add.onclick = () => addSlide(nextLayout());
  add.ondragover = (e) => e.preventDefault();
  add.ondrop = (e) => {
    e.preventDefault();
    moveSlide(+e.dataTransfer.getData('text/slide'), S.doc.slides.length);
  };
  box.appendChild(add);
}

export function updateThumb(i) {
  const t = $('#thumbs').children[i];
  if (t && S.doc.slides[i]) renderSlide(t.querySelector('.slide'), S.doc.slides[i], 'view');
}

export function fillLaySel() {
  const curL = curSlide().layout;
  $('#laySel').innerHTML = Object.entries(LAYOUTS)
    .filter(([k, v]) => !v.hidden || k === curL)
    .map(([k, v]) => `<option value="${k}">레이아웃: ${v.name}</option>`)
    .join('');
  $('#laySel').value = curL;
}

export function renderEditor() {
  const s = curSlide();
  renderSlide($('#slide'), s, 'edit');
  fillLaySel();
  $('#notes').value = s.notes || '';
  $('#themeSel').value = S.doc.theme;
  hidePop();
  scaleStage();
}

export function select(i) {
  S.cur = Math.max(0, Math.min(i, S.doc.slides.length - 1));
  renderEditor();
  [...$('#thumbs').children].forEach((t, j) => t.classList.toggle('active', j === S.cur));
  $('#thumbs').children[S.cur]?.scrollIntoView({ block: 'nearest' });
}

export function addSlide(layout) {
  S.doc.slides.splice(S.cur + 1, 0, newSlide(layout));
  S.cur++;
  renderThumbs();
  renderEditor();
  save();
}

export function dupSlide(i) {
  const copy = structuredClone(S.doc.slides[i]);
  copy.id = uid();
  S.doc.slides.splice(i + 1, 0, copy);
  S.cur = i + 1;
  renderThumbs();
  renderEditor();
  save();
}

export function delSlide(i) {
  if (S.doc.slides.length === 1) return toast('마지막 슬라이드는 삭제할 수 없어요');
  if (slideHasContent(S.doc.slides[i]) && !confirm(`${i + 1}번 슬라이드를 삭제할까요?`)) return;
  S.doc.slides.splice(i, 1);
  if (S.cur >= S.doc.slides.length) S.cur = S.doc.slides.length - 1;
  else if (S.cur > i) S.cur--;
  renderThumbs();
  renderEditor();
  save();
}

export function moveSlide(from, to) {
  if (Number.isNaN(from) || from === to || from + 1 === to) return;
  const [s] = S.doc.slides.splice(from, 1);
  if (to > from) to--;
  S.doc.slides.splice(to, 0, s);
  S.cur = to;
  renderThumbs();
  renderEditor();
  save();
}

export function setLayout(layout) {
  curSlide().layout = layout;
  renderEditor();
  updateThumb(S.cur);
  save();
}

export function scaleStage() {
  const st = $('#stage');
  const k = Math.max(0.1, Math.min((st.clientWidth - 48) / W, (st.clientHeight - 48) / H));
  const w = $('#slideWrap');
  w.style.width = W * k + 'px';
  w.style.height = H * k + 'px';
  $('#slide').style.transform = `scale(${k})`;
}
