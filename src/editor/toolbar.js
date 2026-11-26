/** 상단 도구 모음 · 메뉴 · 단축키 */
import { S, curSlide } from '../state.js';
import { LAYOUTS } from '../core/layouts.js';
import { $, $$, elOf, toast } from '../lib/dom.js';
import { onEdit, save, flushSave } from './editing.js';
import { renderSlide } from './render.js';
import { renderThumbs, renderEditor, addSlide, select, delSlide, setLayout, nextLayout } from './slides.js';
import { openLinkDlg } from './links.js';
import { present, isPresenting, presentKey } from './present.js';
import { handleFrameKey } from './frames.js';
import { hidePop } from './popover.js';
import { createDoc, showDocList, exportDoc, importFile, printDoc } from './docs.js';

function closeMenus(except) {
  $$('.menu').forEach((m) => m !== except && m.classList.remove('open'));
}
function toggleMenu(m) {
  closeMenus(m);
  m.classList.toggle('open');
}

function buildLayMenu() {
  const m = $('#layMenu');
  m.innerHTML = '';
  for (const [k, v] of Object.entries(LAYOUTS)) {
    if (v.hidden) continue;
    const d = document.createElement('div');
    d.className = 'lay';
    d.dataset.l = k;
    d.innerHTML = `<div class="lprev"><div class="slide"></div></div>${v.name}`;
    m.appendChild(d);
    renderSlide(d.querySelector('.slide'), { layout: k, fields: {} }, 'preview');
  }
}

function runFormat(cmd) {
  if (cmd === 'hilite') {
    const v = document.queryCommandValue('hiliteColor');
    document.execCommand('hiliteColor', false, /253, 230, 138|fde68a/i.test(v) ? 'transparent' : '#fde68a');
  } else {
    document.execCommand(cmd);
  }
  const region = elOf(getSelection().anchorNode)?.closest('.region');
  if (region) onEdit(region);
}

function onKeydown(e) {
  if (isPresenting()) return presentKey(e);
  const ctrl = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (e.key === 'F5') {
    e.preventDefault();
    present(e.shiftKey ? S.cur : 0);
  } else if (ctrl && key === 'k') {
    e.preventDefault();
    openLinkDlg();
  } else if (ctrl && key === 'm') {
    e.preventDefault();
    addSlide(nextLayout());
  } else if (ctrl && key === 's') {
    e.preventDefault();
    flushSave().then(() => toast('저장했어요'));
  } else if (e.key === 'Escape') {
    hidePop();
  } else if (handleFrameKey(e)) {
    // 사진 칸에서 처리됨
  } else if (!e.target.closest('[contenteditable],input,textarea,select')) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      select(S.cur + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      select(S.cur - 1);
    } else if (e.key === 'Delete' && document.activeElement === document.body) {
      delSlide(S.cur);
    }
  }
}

export function initToolbar() {
  // 도구 버튼을 눌러도 글 선택이 풀리지 않게
  $$('.bar button, .menu').forEach((b) =>
    b.addEventListener('mousedown', (e) => {
      if (!e.target.closest('input,select')) e.preventDefault();
    }),
  );
  $$('[data-cmd]').forEach((b) => (b.onclick = () => runFormat(b.dataset.cmd)));
  $('#btnLink').onclick = () => openLinkDlg();
  $('#laySel').onchange = (e) => setLayout(e.target.value);
  $('#themeSel').onchange = (e) => {
    S.doc.theme = e.target.value;
    renderThumbs();
    renderEditor();
    save();
  };
  $('#docName').oninput = (e) => {
    S.doc.title = e.target.value;
    document.title = `${S.doc.title} — searchmd`;
    save();
  };
  $('#notes').oninput = (e) => {
    curSlide().notes = e.target.value;
    save();
  };

  $('#btnAdd').onclick = (e) => {
    e.stopPropagation();
    buildLayMenu();
    toggleMenu($('#layMenu'));
  };
  $('#layMenu').onclick = (e) => {
    const l = e.target.closest('.lay');
    if (!l) return;
    closeMenus();
    addSlide(l.dataset.l);
  };
  $('#btnFile').onclick = (e) => {
    e.stopPropagation();
    toggleMenu($('#fileMenu'));
  };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menuWrap')) closeMenus();
  });

  const fileAction = (fn) => () => {
    closeMenus();
    fn();
  };
  $('#mDocs').onclick = fileAction(showDocList);
  $('#mNew').onclick = fileAction(() => createDoc().then(() => toast('새 문서를 만들었어요')));
  $('#mExport').onclick = fileAction(exportDoc);
  $('#mImport').onclick = fileAction(() => $('#fileIn').click());
  $('#mPrint').onclick = fileAction(printDoc);
  $('#fileIn').onchange = async (e) => {
    const f = e.target.files[0];
    if (f) await importFile(f);
    e.target.value = '';
  };
  $('#docsNew').onclick = async () => {
    $('#docsDlg').close();
    await createDoc();
    toast('새 문서를 만들었어요');
  };
  $('#docsClose').onclick = () => $('#docsDlg').close();

  $('#btnPresent').onclick = () => present(S.cur);
  document.addEventListener('keydown', onKeydown);
}
