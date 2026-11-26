/**
 * 브라우저 저장소(IndexedDB). 사진이 많아도 저장할 수 있다.
 * - docs: 문서 (키 = doc.id)
 * - meta: 설정값 (lastDoc 등)
 * 버전 1(프로토타입)은 문서 하나를 'main' 키에 저장했다 → 처음 열 때 옮긴다.
 */
import { uid } from './model.js';

const DB_NAME = 'research-slides';
const DB_VERSION = 2;
let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const getDoc = (id) => run('docs', 'readonly', (s) => s.get(id));
export const deleteDoc = (id) => run('docs', 'readwrite', (s) => s.delete(id));
export const getMeta = (key) => run('meta', 'readonly', (s) => s.get(key));
export const setMeta = (key, value) => run('meta', 'readwrite', (s) => s.put(value, key));

export function putDoc(doc) {
  doc.updatedAt = Date.now();
  return run('docs', 'readwrite', (s) => s.put(doc, doc.id));
}

/** 문서 목록 (최근 수정 순) — 목록 표시용 요약만 돌려준다 */
export async function listDocs() {
  const all = (await run('docs', 'readonly', (s) => s.getAll())) || [];
  return all
    .filter((d) => d && d.id && Array.isArray(d.slides))
    .map((d) => ({ id: d.id, title: d.title || '(제목 없음)', updatedAt: d.updatedAt || 0, count: d.slides.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 프로토타입(v1) 데이터 옮기기 */
export async function migrateLegacy() {
  const old = await run('docs', 'readonly', (s) => s.get('main'));
  if (!old || !Array.isArray(old.slides)) return null;
  old.id = old.id || uid();
  await putDoc(old);
  await run('docs', 'readwrite', (s) => s.delete('main'));
  await setMeta('lastDoc', old.id);
  return old.id;
}
