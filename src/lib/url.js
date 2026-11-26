/** 주소(URL) 관련 순수 함수 */

/** 글 속 주소를 찾는 정규식 (끝의 문장부호는 제외) */
export const URL_RE = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]}])|(www\.[^\s<>"']+[^\s<>"'.,;:!?)\]}])/g;

/** 링크로 허용할 주소만 통과 (javascript: 등 차단) */
export function safeUrl(href) {
  if (!href) return null;
  const h = href.trim();
  return /^(https?:|mailto:)/i.test(h) || /^#slide-/.test(h) ? h : null;
}

/** 사용자가 입력한 주소를 정규화 (example.com → https://example.com) */
export function normalizeUrl(input) {
  const u = (input || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|#slide-)/i.test(u)) return u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return 'mailto:' + u;
  return 'https://' + u;
}

/** 표시용 짧은 주소 (https://www.instagram.com/p/x → instagram.com) */
export function prettyUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u;
  }
}

/** 이미지 파일 주소인지 */
export const isImgUrl = (u) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?\S*)?$/i.test(u || '');

/** 슬라이드 내부 링크 */
export const slideHref = (id) => '#slide-' + id;
export const slideIdOf = (href) => (href?.startsWith('#slide-') ? href.slice(7) : null);
