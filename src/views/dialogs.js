/** 이름 입력 · 폴더 고르기 대화상자 (Promise로 결과를 돌려줌) */
import { $, esc } from '../lib/dom.js';

/** @returns {Promise<string|null>} 입력한 이름, 취소하면 null */
export function askName(title, value = '') {
  const dlg = $('#nameDlg');
  const input = $('#nameIn');
  $('#nameTitle').textContent = title;
  input.value = value;
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      $('#nameOk').onclick = $('#nameCancel').onclick = input.onkeydown = dlg.oncancel = null;
      resolve(v);
    };
    $('#nameOk').onclick = () => input.value.trim() && done(input.value.trim());
    $('#nameCancel').onclick = () => done(null);
    dlg.oncancel = () => done(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        e.preventDefault();
        done(input.value.trim());
      }
    };
    dlg.showModal();
    input.focus();
    input.select();
  });
}

/**
 * 폴더 고르기
 * @param {Array} folders 전체 폴더
 * @param {string|null} current 지금 위치 (처음 선택)
 * @param {string|null} excludeId 고를 수 없는 폴더 (폴더를 옮길 때 자기 자신과 그 아래)
 * @returns {Promise<{folderId: string|null}|null>} 취소하면 null
 */
export function askFolder(folders, current = null, excludeId = null) {
  const dlg = $('#moveDlg');
  const box = $('#moveTree');
  const blocked = new Set();
  if (excludeId) {
    blocked.add(excludeId);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of folders)
        if (f.parentId && blocked.has(f.parentId) && !blocked.has(f.id)) (blocked.add(f.id), (grew = true));
    }
  }
  const rows = (parentId, depth) =>
    folders
      .filter((f) => (f.parentId || null) === parentId)
      .map(
        (f) =>
          `<div class="mrow${blocked.has(f.id) ? ' off' : ''}" data-id="${esc(f.id)}" style="padding-left:${14 + depth * 18}px">📁 ${esc(f.name)}</div>${rows(f.id, depth + 1)}`,
      )
      .join('');
  box.innerHTML = `<div class="mrow" data-id="" style="padding-left:14px">🏠 내 드라이브</div>${rows(null, 1)}`;
  let picked = current || '';
  const mark = () => box.querySelectorAll('.mrow').forEach((r) => r.classList.toggle('on', r.dataset.id === picked));
  mark();
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      $('#moveOk').onclick = $('#moveCancel').onclick = box.onclick = dlg.oncancel = null;
      resolve(v);
    };
    box.onclick = (e) => {
      const r = e.target.closest('.mrow');
      if (!r || r.classList.contains('off')) return;
      picked = r.dataset.id;
      mark();
    };
    box.ondblclick = (e) => {
      const r = e.target.closest('.mrow');
      if (r && !r.classList.contains('off')) done({ folderId: r.dataset.id || null });
    };
    $('#moveOk').onclick = () => done({ folderId: picked || null });
    $('#moveCancel').onclick = () => done(null);
    dlg.oncancel = () => done(null);
    dlg.showModal();
  });
}
