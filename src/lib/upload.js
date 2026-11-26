/** 붙여넣은 사진(data: 주소)을 서버에 올리고 서버 주소로 바꾼다 */
import { api } from '../api.js';
import { isFrameKey, isOptionKey } from '../core/layouts.js';

const dataUrlToBlob = async (u) => (await fetch(u)).blob();

/** data: 주소면 서버에 올려서 /api/images/… 주소를, 아니면 그대로 돌려준다 */
export async function persistSrc(src) {
  if (!src || !src.startsWith('data:image/')) return src;
  return api.uploadImage(await dataUrlToBlob(src));
}

export async function persistHtmlImages(html) {
  if (!html || !html.includes('data:image/')) return html;
  const d = document.createElement('div');
  d.innerHTML = html;
  for (const img of d.querySelectorAll('img[src^="data:image/"]')) {
    img.setAttribute('src', await persistSrc(img.getAttribute('src')));
  }
  return d.innerHTML;
}

/** 문서 안의 모든 data: 사진을 서버로 (브라우저에 있던 문서를 올릴 때) */
export async function persistDocImages(doc) {
  for (const s of doc.slides) {
    for (const [k, v] of Object.entries(s.fields)) {
      if (isOptionKey(k)) continue;
      s.fields[k] = isFrameKey(k) ? await persistSrc(v) : await persistHtmlImages(v);
    }
  }
  return doc;
}
