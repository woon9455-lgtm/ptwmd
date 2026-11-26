/** 이미지 읽기·축소, 클립보드/드래그 데이터에서 이미지 꺼내기 */
import { sanitize } from './sanitize.js';
import { plain } from './dom.js';
import { isImgUrl } from './url.js';

const MAX_SIDE = 2000; // 저장할 때 긴 변 최대 픽셀
const KEEP_BELOW = 400 * 1024; // 이보다 작은 파일은 원본 그대로

export function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => {
      const url = fr.result;
      if (file.size < KEEP_BELOW || /svg|gif/.test(file.type)) return resolve(url);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(url);
      img.src = url;
    };
    fr.onerror = () => resolve(null);
    fr.readAsDataURL(file);
  }).then((u) => u || '');
}

/** DataTransfer(붙여넣기·드롭)에서 이미지 주소 목록을 꺼낸다 */
export async function dtImages(dt) {
  let files = [...(dt.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length && dt.items) {
    files = [...dt.items]
      .filter((i) => i.kind === 'file' && i.type.startsWith('image/'))
      .map((i) => i.getAsFile())
      .filter(Boolean);
  }
  if (files.length) return (await Promise.all(files.map(fileToDataUrl))).filter(Boolean);

  const html = dt.getData('text/html');
  if (html) {
    const srcs = [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('img')]
      .map((i) => i.getAttribute('src'))
      .filter((s) => s && /^(https?:|data:image\/)/i.test(s));
    const onlyImages = !plain(sanitize(html).replace(/<img[^>]*>/g, ''));
    if (srcs.length && (onlyImages || srcs.length === 1)) return srcs;
  }
  const u = (dt.getData('text/uri-list') || dt.getData('text/plain') || '').trim().split(/\s+/)[0];
  return isImgUrl(u) ? [u] : [];
}
