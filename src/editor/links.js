/** 링크: Ctrl+K 대화상자 · 링크 팝업 · 슬라이드 간 이동 · 본문 이미지 크기 */
import { S } from '../state.js';
import { $, $$, esc, elOf, toast } from '../lib/dom.js';
import { normalizeUrl, prettyUrl, slideHref, slideIdOf } from '../lib/url.js';
import { slideLabel } from '../core/model.js';
import { onEdit } from './editing.js';
import { select } from './slides.js';
import { showP } from './present.js';
import { hidePop, showPopAt, setPop, pop } from './popover.js';
import { handleFrameClick } from './frames.js';

/** 링크 따라가기 — 슬라이드 링크면 그 슬라이드로, 아니면 새 탭 */
export function follow(href, inPresent = false) {
  if (!href) return;
  const id = slideIdOf(href);
  if (id) {
    const i = S.doc.slides.findIndex((s) => s.id === id);
    if (i < 0) return toast('연결된 슬라이드가 삭제되었어요');
    if (inPresent) showP(i);
    else select(i);
  } else {
    window.open(href, '_blank', 'noopener');
  }
}

/* ---------- 링크 대화상자 ---------- */
let savedRange = null;
let editingLink = null;
let mode = 'url';

function setMode(m) {
  mode = m;
  $$('#linkDlg .tabs button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('#lnUrlBox').hidden = m !== 'url';
  $('#lnSlideBox').hidden = m !== 'slide';
}

export function openLinkDlg(linkEl) {
  const sel = getSelection();
  if (linkEl) {
    editingLink = linkEl;
    savedRange = document.createRange();
    savedRange.selectNodeContents(linkEl);
  } else {
    const node = sel.anchorNode;
    if (!sel.rangeCount || !node || !$('#slide').contains(node) || !elOf(node).closest('.region')) {
      return toast('먼저 글 칸 안에 커서를 두거나 글자를 선택하세요');
    }
    savedRange = sel.getRangeAt(0).cloneRange();
    editingLink = elOf(node).closest('a');
  }
  const href = editingLink ? editingLink.getAttribute('href') : '';
  $('#lnText').value = editingLink ? editingLink.textContent : sel.toString();
  $('#lnSlide').innerHTML = S.doc.slides
    .map((s, i) => `<option value="${s.id}">${esc(slideLabel(s, i))}</option>`)
    .join('');
  const sid = slideIdOf(href);
  if (sid) {
    setMode('slide');
    $('#lnSlide').value = sid;
    $('#lnUrl').value = '';
  } else {
    setMode('url');
    $('#lnUrl').value = href;
  }
  $('#linkDlg').showModal();
  (mode === 'url' ? $('#lnUrl') : $('#lnSlide')).focus();
}

function applyLink() {
  const region = elOf(savedRange.commonAncestorContainer)?.closest('.region');
  let href, fallback;
  if (mode === 'slide') {
    const id = $('#lnSlide').value;
    const i = S.doc.slides.findIndex((s) => s.id === id);
    href = slideHref(id);
    fallback = slideLabel(S.doc.slides[i], i).replace(/^\d+\. /, '') + ' 슬라이드로';
  } else {
    href = normalizeUrl($('#lnUrl').value);
    fallback = region?.matches('.r-link,.r-source') ? prettyUrl(href) : $('#lnUrl').value.trim();
  }
  if (!href) return $('#lnUrl').focus();
  const text = $('#lnText').value || fallback;
  $('#linkDlg').close();

  if (editingLink?.isConnected) {
    editingLink.setAttribute('href', href);
    if (text !== editingLink.textContent) editingLink.textContent = text;
  } else if (region) {
    region.focus();
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    document.execCommand('insertHTML', false, `<a href="${esc(href)}">${esc(text)}</a>`);
  }
  if (region) onEdit(region);
}

function unlink(a) {
  const region = a.closest('.region');
  a.replaceWith(...a.childNodes);
  hidePop();
  if (region) onEdit(region);
}

/* ---------- 팝업 ---------- */
function linkPop(a) {
  const href = a.getAttribute('href');
  const sid = slideIdOf(href);
  let label = href;
  if (sid) {
    const i = S.doc.slides.findIndex((s) => s.id === sid);
    label = i < 0 ? '(삭제된 슬라이드)' : '📑 ' + slideLabel(S.doc.slides[i], i);
  }
  setPop(
    `<span class="url" title="${esc(href)}">${esc(label)}</span><button data-p="open">열기</button><button data-p="copy">복사</button><button data-p="edit">편집</button><button data-p="un">링크 해제</button>`,
    (e) => {
      const p = e.target.dataset.p || (e.target.classList.contains('url') && 'open');
      if (p === 'open') follow(href);
      else if (p === 'edit') {
        hidePop();
        openLinkDlg(a);
      } else if (p === 'un') unlink(a);
      else if (p === 'copy') navigator.clipboard.writeText(sid ? label : href).then(() => toast('주소를 복사했어요'));
    },
  );
  showPopAt(a);
}

function imgPop(img) {
  setPop(
    `<span class="muted">이미지 크기</span><button data-w="25%">작게</button><button data-w="50%">중간</button><button data-w="75%">크게</button><button data-w="100%">꽉 차게</button><button data-w="">원래대로</button><button data-w="del">삭제</button>`,
    (e) => {
      const w = e.target.dataset.w;
      if (w === undefined) return;
      const region = img.closest('.region');
      if (w === 'del') {
        img.remove();
        hidePop();
      } else {
        img.style.width = w;
        img.style.maxHeight = w ? 'none' : '';
        setTimeout(() => showPopAt(img), 0);
      }
      onEdit(region);
    },
  );
  showPopAt(img);
}

export function initLinks() {
  const slideEl = $('#slide');

  slideEl.addEventListener('click', (e) => {
    if (handleFrameClick(e)) return;
    const a = e.target.closest('a');
    const img = e.target.closest('.region img');
    if (a) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) follow(a.getAttribute('href'));
      else linkPop(a);
      return;
    }
    if (img) return imgPop(img);
    hidePop();
  });

  slideEl.addEventListener('mouseover', (e) => {
    const a = e.target.closest('a');
    if (a && !a.title) {
      const href = a.getAttribute('href');
      a.title = (slideIdOf(href) ? '슬라이드 이동' : href) + '  (Ctrl+클릭으로 열기)';
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!pop().contains(e.target) && !e.target.closest('#slide a, #slide img, #slide .frame')) hidePop();
  });

  // 키보드로 링크 안에 커서가 들어가도 팝업 표시
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (!s.anchorNode || !slideEl.contains(s.anchorNode)) return;
    const a = elOf(s.anchorNode).closest('a');
    if (a && s.isCollapsed) linkPop(a);
    else if (!a && pop().querySelector('[data-p]')) hidePop();
  });

  $$('#linkDlg .tabs button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('#lnOk').onclick = applyLink;
  $('#lnCancel').onclick = () => $('#linkDlg').close();
  $('#linkDlg').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyLink();
    }
  });
}
