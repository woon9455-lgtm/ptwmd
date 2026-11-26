/** 서버 API 호출 */
export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let onUnauthorized = () => {};
/** 로그인이 풀렸을 때(401) 할 일 */
export const setUnauthorizedHandler = (fn) => (onUnauthorized = fn);

async function request(method, path, body, { auth = true } = {}) {
  const init = { method, headers: {}, credentials: 'same-origin' };
  if (body instanceof Blob) {
    init.body = body;
    init.headers['content-type'] = body.type || 'application/octet-stream';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['content-type'] = 'application/json';
  }
  let res;
  try {
    res = await fetch('/api/' + path, init);
  } catch {
    throw new ApiError(0, '서버에 연결할 수 없어요. 인터넷 연결을 확인하세요');
  }
  const data = (res.headers.get('content-type') || '').includes('json') ? await res.json().catch(() => null) : null;
  if (res.status === 401 && auth) onUnauthorized();
  if (!res.ok) throw new ApiError(res.status, data?.error || `요청에 실패했어요 (${res.status})`, data);
  return data;
}

const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null)).toString();

export const api = {
  me: () => request('GET', 'me', undefined, { auth: false }),
  login: (password) => request('POST', 'login', { password }, { auth: false }),
  logout: () => request('POST', 'logout', undefined, { auth: false }),

  folders: () => request('GET', 'folders').then((r) => r.folders),
  createFolder: (name, parentId = null) => request('POST', 'folders', { name, parentId }).then((r) => r.folder),
  updateFolder: (id, patch) => request('PATCH', 'folders/' + id, patch),
  deleteFolder: (id) => request('DELETE', 'folders/' + id),

  /** @param {{view?:string, folder?:string, q?:string}} params */
  listDocs: (params) => request('GET', 'docs?' + qs(params)).then((r) => r.docs),
  createDoc: (doc, folderId = null) => request('POST', 'docs', { doc, folderId }),
  getDoc: (id) => request('GET', 'docs/' + id).then((r) => r.doc),
  saveDoc: (id, doc, version) => request('PUT', 'docs/' + id, { doc, version }),
  patchDoc: (id, patch) => request('PATCH', 'docs/' + id, patch),
  copyDoc: (id) => request('POST', `docs/${id}/copy`),
  deleteDoc: (id) => request('DELETE', 'docs/' + id),
  emptyTrash: () => request('DELETE', 'trash'),

  uploadImage: (blob) => request('POST', 'images', blob).then((r) => r.url),
};
