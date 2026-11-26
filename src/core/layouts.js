/**
 * 슬라이드 레이아웃 정의.
 * - 글 칸: <div class="region r-역할" data-k="저장키">
 * - 사진 칸: <div class="frame" data-k="imgN">
 * 레이아웃을 바꿔도 같은 저장키(title, head1, img1 …)의 내용은 그대로 옮겨진다.
 * `areas: 1`인 레이아웃은 CSS grid-template-areas의 이름으로 data-k를 쓴다.
 */
const PHOTO_PH = '＋ 사진 넣기\n클릭 · 끌어다 놓기 · Ctrl+V';

const tx = (role, k, ph) => `<div class="region r-${role}" data-k="${k}" data-ph="${ph}"></div>`;
const fr = (k, ph = PHOTO_PH) => `<div class="frame" data-k="${k}" data-ph="${ph}"></div>`;
const range = (a, b, f) => Array.from({ length: b - a + 1 }, (_, i) => f(a + i)).join('');

const card = (n) =>
  `<div class="card">${fr('img' + n)}${tx('head', 'head' + n, '핵심 한 줄')}${tx('desc', 'desc' + n, '설명')}${tx('link', 'link' + n, '🔗 링크 붙여넣기')}</div>`;
const mini = (n) =>
  `<div class="card">${fr('img' + n, '＋ 사진')}${tx('head', 'head' + n, '제목')}${tx('link', 'link' + n, '🔗 링크')}</div>`;
const hcard = (n) =>
  `<div class="hcard">${fr('img' + n, '＋ 사진')}<div class="col">${tx('head', 'head' + n, '핵심 한 줄')}${tx('desc', 'desc' + n, '설명')}${tx('link', 'link' + n, '🔗 링크 붙여넣기')}</div></div>`;
const stat = (n) =>
  `<div class="stat">${tx('num', 'num' + n, '00%')}${tx('label', 'head' + n, '지표 이름')}${tx('desc', 'desc' + n, '설명 · 기준 시점')}</div>`;
const featureCol = `<div class="col">${tx('kicker', 'kicker', '키워드 · 분류')}${tx('head', 'head1', '가장 강하게 말하고 싶은 한 문장')}${tx('desc', 'desc1', '조사한 설명을 붙여넣으세요')}${tx('link', 'link1', '🔗 링크 붙여넣기')}${tx('source', 'source', '출처')}</div>`;

export const LAYOUTS = {
  title: {
    name: '표지',
    areas: 1,
    tpl: tx('title', 'title', '제목을 입력하세요') + tx('subtitle', 'subtitle', '부제 · 작성자 · 날짜'),
  },
  section: { name: '구역 제목', areas: 1, tpl: tx('title', 'title', '구역 제목') + tx('body', 'body', '간단한 설명') },
  statement: {
    name: '강한 문장',
    tpl: `<div class="col">${tx('kicker', 'kicker', '키워드 · 분류')}${tx('head', 'head1', '가장 강하게 말하고 싶은 한 문장')}${tx('desc', 'desc1', '부연 설명')}${tx('link', 'link1', '🔗 링크 붙여넣기')}</div>`,
  },
  feature: { name: '사진 + 핵심', tpl: fr('img1') + featureCol },
  featureR: { name: '핵심 + 사진', tpl: fr('img1') + featureCol },
  hero: {
    name: '풀 사진',
    tpl:
      fr('img1', '＋ 배경 사진 넣기\n클릭 · 끌어다 놓기 · Ctrl+V') +
      `<div class="overlay">${tx('kicker', 'kicker', '키워드')}${tx('head', 'head1', '사진 위 강한 한 문장')}${tx('desc', 'desc1', '설명')}${tx('link', 'link1', '🔗 링크')}</div>`,
  },
  img2: { name: '사진 2장 비교', cls: 'compact', tpl: tx('title', 'title', '제목') + range(1, 2, card) },
  gallery3: { name: '사진 3장', cls: 'compact', tpl: tx('title', 'title', '제목') + range(1, 3, card) },
  mosaic: {
    name: '사진 모음',
    cls: 'compact',
    tpl:
      tx('title', 'title', '제목') +
      fr('img1') +
      fr('img2', '＋ 사진') +
      fr('img3', '＋ 사진') +
      tx('desc', 'desc1', '사진 설명 · 출처'),
  },
  cards4: { name: '링크 카드 4개', cls: 'compact', tpl: tx('title', 'title', '참고 자료') + range(1, 4, hcard) },
  board6: { name: '링크 보드 6개', cls: 'compact', tpl: tx('title', 'title', '레퍼런스 모음') + range(1, 6, mini) },
  links: {
    name: '링크 목록',
    areas: 1,
    tpl: tx('title', 'title', '참고 링크') + tx('body', 'body', '링크를 한 줄에 하나씩 붙여넣으세요'),
  },
  stats: {
    name: '핵심 수치 3개',
    cls: 'compact',
    tpl: tx('title', 'title', '핵심 수치') + range(1, 3, stat) + tx('source', 'source', '출처'),
  },
  content: {
    name: '제목 + 본문',
    areas: 1,
    tpl:
      tx('title', 'title', '제목') +
      tx('body', 'body', '조사한 내용을 붙여넣으세요 (Ctrl+V)') +
      tx('source', 'source', '출처: 링크를 붙여넣으세요'),
  },
  two: {
    name: '2단 비교',
    areas: 1,
    tpl:
      tx('title', 'title', '제목') +
      tx('left', 'left', '왼쪽 내용') +
      tx('right', 'right', '오른쪽 내용') +
      tx('source', 'source', '출처'),
  },
  blank: { name: '자유', areas: 1, tpl: tx('body', 'body', '자유롭게 붙여넣기') },
  // 예전 문서 호환용 (메뉴에는 숨김)
  quote: {
    name: '핵심 인용',
    hidden: 1,
    areas: 1,
    tpl: tx('quote', 'quote', '“핵심 문장”') + tx('source', 'source', '— 출처'),
  },
  media: {
    name: '이미지 + 설명',
    hidden: 1,
    areas: 1,
    tpl:
      tx('title', 'title', '제목') +
      tx('media', 'media', '이미지를 붙여넣으세요') +
      tx('body', 'body', '설명') +
      tx('source', 'source', '출처'),
  },
};

export const DEFAULT_LAYOUT = 'feature';

export const THEMES = [
  { id: 'light', name: '화이트' },
  { id: 'gray', name: '그레이' },
  { id: 'black', name: '블랙' },
  { id: 'blue', name: '블루' },
  { id: 'mono', name: '모노' },
];

/** 사진 칸 저장키 (img1, img2 …) */
export const isFrameKey = (k) => /^img\d+$/.test(k);
/** 사진 칸 옵션 키 (img1:fit) */
export const isOptionKey = (k) => k.includes(':');
