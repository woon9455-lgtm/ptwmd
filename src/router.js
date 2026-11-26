/**
 * 주소(URL)로 화면 고르기
 *   /              내 드라이브
 *   /f/:id         폴더
 *   /recent        최근 문서
 *   /starred       중요 문서
 *   /trash         휴지통
 *   /search?q=     검색
 *   /d/:id         편집
 *   /p/:id?s=번호  발표
 */
export function parseRoute(loc = location) {
  const p = loc.pathname.replace(/\/+$/, '') || '/';
  const q = new URLSearchParams(loc.search);
  let m;
  if ((m = p.match(/^\/d\/([\w-]+)$/))) return { view: 'editor', id: m[1] };
  if ((m = p.match(/^\/p\/([\w-]+)$/)))
    return { view: 'present', id: m[1], slide: Math.max(0, (+q.get('s') || 1) - 1) };
  if ((m = p.match(/^\/f\/([\w-]+)$/))) return { view: 'drive', mode: 'folder', folderId: m[1] };
  if (p === '/recent') return { view: 'drive', mode: 'recent' };
  if (p === '/starred') return { view: 'drive', mode: 'starred' };
  if (p === '/trash') return { view: 'drive', mode: 'trash' };
  if (p === '/search') return { view: 'drive', mode: 'search', q: q.get('q') || '' };
  return { view: 'drive', mode: 'folder', folderId: null };
}

export const folderPath = (folderId) => (folderId ? '/f/' + folderId : '/');

let renderFn = () => {};
export function startRouter(fn) {
  renderFn = fn;
  addEventListener('popstate', () => renderFn(parseRoute()));
  return renderFn(parseRoute());
}

export function navigate(path, { replace = false } = {}) {
  if (path !== location.pathname + location.search) {
    history[replace ? 'replaceState' : 'pushState'](null, '', path);
  }
  return renderFn(parseRoute());
}
