/** 편집기 문서 다루기: 서버에서 열기 · 새 문서 · 파일 내려받기/불러오기 · 인쇄 · 발표 링크 */
import { S } from '../state.js';
import { api } from '../api.js';
import { newDoc, normalizeDoc, docBody } from '../core/model.js';
import { $, toast, setStatus } from '../lib/dom.js';
import { persistDocImages } from '../lib/upload.js';
import { flushSave, setConflictHandler } from './editing.js';
import { renderThumbs, renderEditor } from './slides.js';
import { renderSlide, fit } from './render.js';
import { navigate } from '../router.js';

/** 문서를 편집 화면에 띄운다 */
export function showDoc(doc, keepSlide = false) {
  S.doc = doc;
  S.cur = keepSlide ? Math.min(S.cur, doc.slides.length - 1) : 0;
  $('#docName').value = doc.title;
  document.title = `${doc.title || '제목 없는 문서'} — searchmd`;
  renderThumbs();
  renderEditor();
}

/** 서버에서 문서를 받아 띄운다 (저장 대기 없이) */
async function loadDoc(id) {
  const keep = S.doc?.id === id;
  const raw = await api.getDoc(id);
  showDoc(normalizeDoc(raw), keep);
  if (raw.trashedAt) toast('휴지통에 있는 문서예요. 드라이브의 휴지통에서 복원할 수 있어요');
}

/** 성공하면 true */
export async function openDoc(id) {
  await flushSave();
  setStatus('불러오는 중…');
  try {
    await loadDoc(id);
    setStatus('');
    return true;
  } catch (err) {
    if (err.status !== 401) {
      toast(err.message);
      navigate('/', { replace: true });
    }
    return false;
  }
}

/** 편집 화면을 떠날 때 */
export async function closeDoc() {
  await flushSave();
  S.doc = null;
}

/** 새 문서를 서버에 만들고 편집 화면으로 */
export async function createDoc(folderId = null) {
  try {
    await flushSave();
    const { id } = await api.createDoc(docBody(newDoc('제목 없는 문서')), folderId);
    navigate('/d/' + id);
  } catch (err) {
    toast(err.message);
  }
}

/* ---------- 파일 ---------- */
export function exportDoc() {
  const blob = new Blob([JSON.stringify(docBody(S.doc))], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (S.doc.title || '조사자료').replace(/[\\/:*?"<>|]/g, '_') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** .json 파일 → 서버에 새 문서로 (붙여넣었던 사진도 서버로 올림). 만든 문서 id를 돌려준다 */
export async function importDocFile(file, folderId = null) {
  const doc = normalizeDoc(JSON.parse(await file.text()), { clean: true });
  setStatus('사진 올리는 중…');
  await persistDocImages(doc);
  const { id } = await api.createDoc(docBody(doc), folderId);
  return id;
}

let importFolder = null;
let afterImport = null;
/** 파일 고르기 창을 열어 불러온다 */
export function pickImport(folderId, done) {
  importFolder = folderId;
  afterImport = done;
  $('#fileIn').click();
}

export function printDoc() {
  const pa = $('#printArea');
  pa.innerHTML = '';
  for (const s of S.doc.slides) {
    const d = document.createElement('div');
    pa.appendChild(d);
    renderSlide(d, s, 'view');
  }
  setTimeout(() => {
    pa.querySelectorAll('.region').forEach(fit);
    window.print();
  }, 600);
}

export const presentUrl = (id, slide = 0) => `${location.origin}/p/${id}${slide ? '?s=' + (slide + 1) : ''}`;

export function copyPresentLink() {
  navigator.clipboard
    .writeText(presentUrl(S.doc.id))
    .then(() => toast('발표 링크를 복사했어요 (로그인한 브라우저에서 열려요)'));
}

export function initDocs() {
  $('#fileIn').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const id = await importDocFile(f, importFolder);
      toast('새 문서로 불러왔어요');
      afterImport ? afterImport(id) : navigate('/d/' + id);
    } catch (err) {
      console.error(err);
      toast(err instanceof SyntaxError ? '올바른 파일이 아니에요' : err.message || '불러오지 못했어요');
    }
  };

  // 다른 브라우저/탭에서 먼저 저장했을 때
  setConflictHandler(async (doc) => {
    const reload = confirm(
      '다른 브라우저(또는 탭)에서 이 문서가 먼저 수정됐어요.\n\n' +
        '[확인] 최신 내용 불러오기 — 여기서 방금 바꾼 내용은 사라져요\n' +
        '[취소] 지금 여기 내용으로 덮어쓰기',
    );
    if (reload)
      setTimeout(
        () =>
          S.doc === doc &&
          loadDoc(doc.id)
            .then(() => setStatus('✓ 최신 내용을 불러왔어요'))
            .catch((e) => toast(e.message)),
        0,
      );
    return !reload;
  });
}
