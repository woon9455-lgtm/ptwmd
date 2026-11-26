/** 링크·사진 위에 뜨는 작은 메뉴 */
import { $ } from '../lib/dom.js';

export const pop = () => $('#pop');

export function hidePop() {
  pop()?.classList.remove('open');
}

/**
 * @param {Element} el 기준 요소
 * @param {boolean} inside true면 요소 안쪽 왼쪽 위에, 아니면 요소 아래(공간 없으면 위)에 띄운다
 */
export function showPopAt(el, inside = false) {
  const p = pop();
  const b = el.getBoundingClientRect();
  p.classList.add('open');
  const top = inside ? b.top + 10 : b.bottom + 6 > innerHeight - 50 ? b.top - p.offsetHeight - 6 : b.bottom + 6;
  p.style.left = Math.max(8, Math.min(b.left + (inside ? 10 : 0), innerWidth - p.offsetWidth - 10)) + 'px';
  p.style.top = Math.max(8, top) + 'px';
}

/** 메뉴 내용을 채우고 클릭 처리기를 단다 */
export function setPop(html, onClick) {
  const p = pop();
  p.innerHTML = html;
  p.onclick = onClick;
}
