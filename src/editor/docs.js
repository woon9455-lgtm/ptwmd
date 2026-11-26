/** 문서 관리: 열기 · 새 문서 · 목록 · 파일 저장/불러오기 · 인쇄 */
import { S } from '../state.js';
import * as store from '../core/storage.js';
import { newDoc, normalizeDoc } from '../core/model.js';
import { $, esc, toast, setStatus } from '../lib/dom.js';
import { flushSave } from './editing.js';
import { renderThumbs, renderEditor } from './slides.js';
import { renderSlide, fit } from './render.js';

/** 문서를 화면에 띄운다 */
export function showDoc(doc) {
  S.doc = doc;
  S.cur = Math.min(S.cur, doc.slides.length - 1);
  $('#docName').value = doc.title;
  document.title = `${doc.title} — searchmd`;
  renderThumbs();
  renderEditor();
  store.setMeta('lastDoc', doc.id).catch(() => {});
}

export async function openDoc(id) {
  await flushSave();
  const raw = await store.getDoc(id);
  if (!raw) return toast('문서를 찾을 수 없어요');
  S.cur = 0;
  showDoc(normalizeDoc(raw));
  setStatus('✓ 불러왔어요');
}

export async function createDoc(doc = newDoc()) {
  await flushSave();
  await store.putDoc(doc);
  S.cur = 0;
  showDoc(doc);
  return doc;
}

/** 앱 시작: 마지막 문서 → 최근 문서 → 새 문서 */
export async function startup() {
  await store.migrateLegacy().catch(() => null);
  const lastId = await store.getMeta('lastDoc').catch(() => null);
  let raw = lastId ? await store.getDoc(lastId).catch(() => null) : null;
  if (!raw) {
    const list = await store.listDocs().catch(() => []);
    if (list.length) raw = await store.getDoc(list[0].id);
  }
  if (raw) {
    showDoc(normalizeDoc(raw));
    setStatus('✓ 이전 작업을 불러왔어요');
  } else {
    await createDoc();
  }
}

/* ---------- 문서 목록 ---------- */
const fmtDate = (t) =>
  t ? new Date(t).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

export async function showDocList() {
  await flushSave();
  const list = await store.listDocs();
  const box = $('#docsList');
  box.innerHTML = list.length
    ? list
        .map(
          (d) => `<div class="docItem${d.id === S.doc.id ? ' current' : ''}" data-id="${esc(d.id)}">
            <div class="info"><div class="name">${esc(d.title)}</div><div class="meta">슬라이드 ${d.count}장 · ${esc(fmtDate(d.updatedAt))}${d.id === S.doc.id ? ' · 지금 편집 중' : ''}</div></div>
            <button data-a="open">열기</button><button class="del" data-a="del">삭제</button></div>`,
        )
        .join('')
    : '<div class="docsEmpty">저장된 문서가 없어요</div>';
  box.onclick = async (e) => {
    const a = e.target.dataset.a;
    const id = e.target.closest('.docItem')?.dataset.id;
    if (!a || !id) return;
    if (a === 'open') {
      $('#docsDlg').close();
      if (id !== S.doc.id) await openDoc(id);
    } else if (a === 'del') {
      const name = list.find((d) => d.id === id)?.title || '';
      if (!confirm(`"${name}" 문서를 삭제할까요?\n삭제하면 되돌릴 수 없어요. (필요하면 먼저 "파일로 저장")`)) return;
      await store.deleteDoc(id);
      if (id === S.doc.id) {
        const rest = (await store.listDocs()).filter((d) => d.id !== id);
        S.doc = null; // 삭제한 문서가 다시 저장되지 않게
        if (rest.length) await openDoc(rest[0].id);
        else await createDoc();
      }
      showDocList();
    }
  };
  if (!$('#docsDlg').open) $('#docsDlg').showModal();
}

/* ---------- 파일 ---------- */
export function exportDoc() {
  const blob = new Blob([JSON.stringify(S.doc)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (S.doc.title || '조사자료').replace(/[\\/:*?"<>|]/g, '_') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** 불러온 파일은 항상 새 문서로 추가한다 (지금 문서를 덮어쓰지 않음) */
export async function importFile(file) {
  try {
    const doc = normalizeDoc(JSON.parse(await file.text()), { clean: true });
    const exists = await store.getDoc(doc.id);
    if (exists) doc.id = newDoc().id; // 같은 문서를 또 불러오면 사본으로
    await createDoc(doc);
    toast('새 문서로 불러왔어요');
  } catch (err) {
    console.error(err);
    alert('올바른 파일이 아니에요');
  }
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
  }, 400);
}
