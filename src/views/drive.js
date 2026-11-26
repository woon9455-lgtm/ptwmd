/** 드라이브 화면: 폴더·문서 목록, 검색, 휴지통, 끌어서 옮기기 */
import { api } from '../api.js';
import { $, $$, esc, toast } from '../lib/dom.js';
import { renderSlide } from '../editor/render.js';
import { createDoc, pickImport } from '../editor/docs.js';
import { navigate, folderPath } from '../router.js';
import { askName, askFolder } from './dialogs.js';
import { localDocsToUpload, uploadLocalDocs } from './localDocs.js';

let route = { mode: 'folder', folderId: null };
let folders = [];
let docs = [];

const TITLES = { recent: '최근 문서', starred: '중요 문서', trash: '휴지통', search: '검색 결과' };
const fmtDate = (t) => {
  if (!t) return '';
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};
const folderName = (id) => folders.find((f) => f.id === id)?.name;
const currentFolder = () => (route.mode === 'folder' ? route.folderId : null);

/* ---------- 그리기 ---------- */
export async function showDrive(r) {
  route = r;
  document.title = 'searchmd — 드라이브';
  $('#dSearch').value = r.mode === 'search' ? r.q : '';
  try {
    [folders, docs] = await Promise.all([api.folders(), loadDocs()]);
  } catch (err) {
    if (err.status !== 401) toast(err.message);
    return;
  }
  if (r.mode === 'folder' && r.folderId && !folders.some((f) => f.id === r.folderId)) {
    toast('폴더가 없어요');
    return navigate('/', { replace: true });
  }
  paint();
  refreshLocalButton();
}

function loadDocs() {
  if (route.mode === 'folder') return api.listDocs({ view: 'folder', folder: route.folderId || undefined });
  if (route.mode === 'search') return api.listDocs({ view: 'search', q: route.q });
  return api.listDocs({ view: route.mode });
}

const refresh = () => showDrive(route);

function paint() {
  // 왼쪽 메뉴 표시
  const navPath = route.mode === 'folder' ? (route.folderId ? null : '/') : '/' + route.mode;
  $$('.dnav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === navPath));
  paintTree();
  paintCrumbs();

  const inFolder = route.mode === 'folder';
  const subFolders = inFolder ? folders.filter((f) => (f.parentId || null) === (route.folderId || null)) : [];
  $('#dFoldersSec').hidden = !subFolders.length;
  $('#dFolders').innerHTML = subFolders
    .map(
      (f) =>
        `<div class="fcard" draggable="true" data-type="folder" data-id="${esc(f.id)}" data-drop="${esc(f.id)}" title="${esc(f.name)}"><span class="ficon">📁</span><span class="fname">${esc(f.name)}</span><button class="kebab" title="더보기">⋮</button></div>`,
    )
    .join('');

  $('#dDocsSec').hidden = !docs.length;
  $('#dDocsTitle').textContent = inFolder ? '문서' : TITLES[route.mode];
  const box = $('#dDocs');
  box.innerHTML = '';
  for (const d of docs) box.appendChild(docCard(d));

  $('#dEmptyTrash').hidden = !(route.mode === 'trash' && docs.length);
  const empty = !subFolders.length && !docs.length;
  $('#dEmpty').hidden = !empty;
  $('#dEmpty').innerHTML = !empty
    ? ''
    : {
        folder: '<b>비어 있는 폴더예요</b><br>왼쪽 위 <b>＋ 새로 만들기</b>로 문서나 폴더를 만들어 보세요.',
        recent: '<b>아직 문서가 없어요</b>',
        starred: '<b>중요 표시한 문서가 없어요</b><br>문서의 ⋮ 메뉴에서 ⭐ 중요 표시를 할 수 있어요.',
        trash: '<b>휴지통이 비어 있어요</b>',
        search: `<b>“${esc(route.q)}”</b>에 맞는 문서가 없어요`,
      }[route.mode];
}

function docCard(d) {
  const el = document.createElement('div');
  el.className = 'dcard';
  el.draggable = route.mode !== 'trash';
  el.dataset.type = 'doc';
  el.dataset.id = d.id;
  const where =
    route.mode === 'folder' ? '' : d.folderId ? `📁 ${esc(folderName(d.folderId) || '')} · ` : '🏠 내 드라이브 · ';
  const when = route.mode === 'trash' ? `삭제 ${fmtDate(d.trashedAt)}` : `수정 ${fmtDate(d.updatedAt)}`;
  el.innerHTML = `
    <div class="dct"><span class="dicon">▣</span><span class="dtitle" title="${esc(d.title)}">${esc(d.title)}</span>${d.starred ? '<span class="star">⭐</span>' : ''}<button class="kebab" title="더보기">⋮</button></div>
    <div class="dthumb"><div class="slide"></div></div>
    <div class="dmeta">${where}슬라이드 ${d.slideCount}장 · ${when}</div>`;
  if (d.preview) renderSlide(el.querySelector('.slide'), d.preview, 'view', d.theme);
  return el;
}

function paintTree() {
  const curId = route.mode === 'folder' ? route.folderId : null;
  const rows = (parentId, depth) =>
    folders
      .filter((f) => (f.parentId || null) === parentId)
      .map(
        (f) =>
          `<a href="/f/${esc(f.id)}" class="tnode${f.id === curId ? ' on' : ''}" data-drop="${esc(f.id)}" style="padding-left:${30 + depth * 14}px" title="${esc(f.name)}">📁 ${esc(f.name)}</a>${rows(f.id, depth + 1)}`,
      )
      .join('');
  $('#dTree').innerHTML = rows(null, 0);
}

function paintCrumbs() {
  let html;
  if (route.mode === 'folder') {
    const chain = [];
    let id = route.folderId;
    while (id) {
      const f = folders.find((x) => x.id === id);
      if (!f) break;
      chain.unshift(f);
      id = f.parentId;
    }
    html =
      `<a href="/" data-drop="">내 드라이브</a>` +
      chain
        .map((f) => ` <span>›</span> <a href="/f/${esc(f.id)}" data-drop="${esc(f.id)}">${esc(f.name)}</a>`)
        .join('');
  } else {
    html = `<b>${TITLES[route.mode]}</b>`;
  }
  $('#dCrumbs').innerHTML = html;
}

/* ---------- 메뉴 ---------- */
const ctx = () => $('#ctx');
export function hideCtx() {
  ctx().hidden = true;
}

function showCtx(x, y, items) {
  const m = ctx();
  m.innerHTML = items
    .map((it) => (it === '-' ? '<hr>' : `<button data-a="${it[0]}"${it[2] ? ' class="danger"' : ''}>${it[1]}</button>`))
    .join('');
  m.hidden = false;
  const r = m.getBoundingClientRect();
  m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
  m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
}

function docMenu(d, x, y) {
  const items =
    route.mode === 'trash'
      ? [
          ['restore', '↩ 복원'],
          ['purge', '🗑 영구 삭제', true],
        ]
      : [
          ['open', '✏️ 열기'],
          ['present', '▶ 발표하기'],
          ['tab', '↗ 새 탭에서 열기'],
          ['link', '🔗 발표 링크 복사'],
          '-',
          ['rename', '이름 바꾸기'],
          ['move', '📁 이동…'],
          ['star', d.starred ? '☆ 중요 표시 해제' : '⭐ 중요 표시'],
          ['copy', '⧉ 사본 만들기'],
          '-',
          ['trash', '🗑 휴지통으로', true],
        ];
  showCtx(x, y, items);
  ctx().onclick = (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    hideCtx();
    docAction(a, d);
  };
}

async function docAction(a, d) {
  try {
    if (a === 'open') return navigate('/d/' + d.id);
    if (a === 'present') return presentDoc(d.id);
    if (a === 'tab') return window.open('/d/' + d.id, '_blank');
    if (a === 'link')
      return navigator.clipboard.writeText(`${location.origin}/p/${d.id}`).then(() => toast('발표 링크를 복사했어요'));
    if (a === 'rename') {
      const name = await askName('이름 바꾸기', d.title);
      if (!name || name === d.title) return;
      await api.patchDoc(d.id, { title: name });
    } else if (a === 'move') {
      const r = await askFolder(folders, d.folderId);
      if (!r || r.folderId === (d.folderId || null)) return;
      await api.patchDoc(d.id, { folderId: r.folderId });
      toast(`${r.folderId ? folderName(r.folderId) : '내 드라이브'}(으)로 옮겼어요`);
    } else if (a === 'star') await api.patchDoc(d.id, { starred: !d.starred });
    else if (a === 'copy') {
      await api.copyDoc(d.id);
      toast('사본을 만들었어요');
    } else if (a === 'trash') {
      await api.patchDoc(d.id, { trashed: true });
      toast('휴지통으로 옮겼어요');
    } else if (a === 'restore') {
      await api.patchDoc(d.id, { trashed: false });
      toast('복원했어요');
    } else if (a === 'purge') {
      if (!confirm(`"${d.title}" 문서를 영구 삭제할까요?\n되돌릴 수 없어요.`)) return;
      await api.deleteDoc(d.id);
    }
    refresh();
  } catch (err) {
    toast(err.message);
  }
}

function folderMenu(f, x, y) {
  showCtx(x, y, [
    ['open', '📂 열기'],
    ['rename', '이름 바꾸기'],
    ['move', '📁 이동…'],
    '-',
    ['delete', '🗑 폴더 삭제', true],
  ]);
  ctx().onclick = async (e) => {
    const a = e.target.closest('button')?.dataset.a;
    if (!a) return;
    hideCtx();
    try {
      if (a === 'open') return navigate('/f/' + f.id);
      if (a === 'rename') {
        const name = await askName('폴더 이름 바꾸기', f.name);
        if (!name || name === f.name) return;
        await api.updateFolder(f.id, { name });
      } else if (a === 'move') {
        const r = await askFolder(folders, f.parentId, f.id);
        if (!r || r.folderId === (f.parentId || null)) return;
        await api.updateFolder(f.id, { parentId: r.folderId });
      } else if (a === 'delete') {
        if (
          !confirm(`"${f.name}" 폴더를 삭제할까요?\n안에 있는 하위 폴더도 함께 삭제되고, 문서는 휴지통으로 옮겨져요.`)
        )
          return;
        await api.deleteFolder(f.id);
        toast('폴더를 삭제했어요 — 문서는 휴지통에 있어요');
      }
      refresh();
    } catch (err) {
      toast(err.message);
    }
  };
}

/** 드라이브에서 바로 발표 (전체 화면은 클릭한 순간에 요청해야 열린다) */
function presentDoc(id) {
  document.documentElement.requestFullscreen?.().catch(() => {});
  navigate('/p/' + id);
}

/* ---------- 끌어서 옮기기 ---------- */
let dragItem = null;

async function moveItem(item, folderId) {
  try {
    if (item.type === 'doc') {
      const d = docs.find((x) => x.id === item.id);
      if ((d?.folderId || null) === folderId) return;
      await api.patchDoc(item.id, { folderId });
    } else {
      if (item.id === folderId) return;
      await api.updateFolder(item.id, { parentId: folderId });
    }
    toast(`${folderId ? folderName(folderId) : '내 드라이브'}(으)로 옮겼어요`);
    refresh();
  } catch (err) {
    toast(err.message);
  }
}

/* ---------- 브라우저에만 있던 문서 ---------- */
async function refreshLocalButton() {
  const list = await localDocsToUpload().catch(() => []);
  const btn = $('#dLocal');
  btn.hidden = !list.length;
  btn.textContent = `⬆ 이 브라우저에만 있는 문서 ${list.length}개 서버로 올리기`;
}

/* ---------- 초기화 ---------- */
export function initDrive() {
  const view = $('#driveView');

  // 링크(<a href="/...">)는 새로고침 없이 이동
  view.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="/"]');
    if (a && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      navigate(a.getAttribute('href'));
    }
  });

  $('#dNew').onclick = (e) => {
    e.stopPropagation();
    $('#dNewMenu').classList.toggle('open');
  };
  $('#dNewMenu').onclick = async (e) => {
    const n = e.target.closest('[data-new]')?.dataset.new;
    if (!n) return;
    $('#dNewMenu').classList.remove('open');
    const folderId = currentFolder();
    if (n === 'doc') createDoc(folderId);
    else if (n === 'import') pickImport(folderId, () => refresh());
    else if (n === 'folder') {
      const name = await askName('새 폴더', '제목 없는 폴더');
      if (!name) return;
      try {
        await api.createFolder(name, folderId);
        refresh();
      } catch (err) {
        toast(err.message);
      }
    }
  };

  $('#dSearchForm').onsubmit = (e) => {
    e.preventDefault();
    const q = $('#dSearch').value.trim();
    navigate(q ? '/search?q=' + encodeURIComponent(q) : '/');
  };

  $('#dEmptyTrash').onclick = async () => {
    if (!confirm(`휴지통의 문서 ${docs.length}개를 모두 영구 삭제할까요?\n되돌릴 수 없어요.`)) return;
    try {
      await api.emptyTrash();
      toast('휴지통을 비웠어요');
      refresh();
    } catch (err) {
      toast(err.message);
    }
  };

  $('#dLogout').onclick = async () => {
    await api.logout().catch(() => {});
    location.href = '/';
  };

  $('#dLocal').onclick = async () => {
    const btn = $('#dLocal');
    btn.disabled = true;
    try {
      const n = await uploadLocalDocs(currentFolder(), (i, total) => (btn.textContent = `올리는 중… ${i}/${total}`));
      toast(`문서 ${n}개를 서버로 올렸어요`);
      refresh();
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      refreshLocalButton();
    }
  };

  // 카드 클릭 · 메뉴
  const body = $('#dBody');
  body.addEventListener('click', (e) => {
    const card = e.target.closest('.dcard,.fcard');
    if (!card) return;
    const kebab = e.target.closest('.kebab');
    if (card.dataset.type === 'folder') {
      const f = folders.find((x) => x.id === card.dataset.id);
      if (kebab) return folderMenu(f, e.clientX, e.clientY);
      return navigate('/f/' + f.id);
    }
    const d = docs.find((x) => x.id === card.dataset.id);
    if (kebab || route.mode === 'trash') return docMenu(d, e.clientX, e.clientY);
    navigate('/d/' + d.id);
  });
  body.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.dcard,.fcard');
    if (!card) return;
    e.preventDefault();
    if (card.dataset.type === 'folder')
      folderMenu(
        folders.find((x) => x.id === card.dataset.id),
        e.clientX,
        e.clientY,
      );
    else
      docMenu(
        docs.find((x) => x.id === card.dataset.id),
        e.clientX,
        e.clientY,
      );
  });
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#ctx')) hideCtx();
    if (!e.target.closest('.newWrap')) $('#dNewMenu').classList.remove('open');
  });
  addEventListener('blur', hideCtx);

  // 끌어서 폴더로 옮기기
  view.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.dcard,.fcard');
    if (!card) return;
    dragItem = { type: card.dataset.type, id: card.dataset.id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });
  view.addEventListener('dragend', () => {
    dragItem = null;
    $$('.dropOn').forEach((x) => x.classList.remove('dropOn'));
  });
  view.addEventListener('dragover', (e) => {
    const t = e.target.closest('[data-drop]');
    $$('.dropOn').forEach((x) => x !== t && x.classList.remove('dropOn'));
    if (!dragItem || !t || t.dataset.drop === dragItem.id) return;
    e.preventDefault();
    t.classList.add('dropOn');
  });
  view.addEventListener('drop', (e) => {
    const t = e.target.closest('[data-drop]');
    if (!dragItem || !t) return;
    e.preventDefault();
    t.classList.remove('dropOn');
    const item = dragItem;
    dragItem = null;
    moveItem(item, t.dataset.drop || null);
  });
}

export const driveFolderPath = () => folderPath(currentFolder());
