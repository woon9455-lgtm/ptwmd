/** 예전 버전에서 브라우저(IndexedDB)에만 저장했던 문서를 서버로 올리기 */
import * as local from '../core/localStore.js';
import { normalizeDoc, docBody } from '../core/model.js';
import { persistDocImages } from '../lib/upload.js';
import { api } from '../api.js';

const UPLOADED_KEY = 'uploadedIds';

export async function localDocsToUpload() {
  if (!('indexedDB' in window)) return [];
  await local.migrateLegacy().catch(() => null);
  const [list, done] = await Promise.all([local.listDocs(), local.getMeta(UPLOADED_KEY)]);
  const uploaded = new Set(done || []);
  return list.filter((d) => !uploaded.has(d.id));
}

/** 올린 문서 수를 돌려준다 */
export async function uploadLocalDocs(folderId, onProgress = () => {}) {
  const list = await localDocsToUpload();
  const uploaded = new Set((await local.getMeta(UPLOADED_KEY)) || []);
  let n = 0;
  for (const item of list) {
    onProgress(n + 1, list.length);
    const raw = await local.getDoc(item.id);
    if (!raw) continue;
    const doc = normalizeDoc(raw, { clean: true });
    delete doc.version;
    await persistDocImages(doc);
    await api.createDoc(docBody(doc), folderId);
    uploaded.add(item.id);
    await local.setMeta(UPLOADED_KEY, [...uploaded]); // 중간에 실패해도 올린 것은 기록
    n++;
  }
  return n;
}
