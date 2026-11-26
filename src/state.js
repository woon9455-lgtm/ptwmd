/** 편집기 전역 상태 (열려 있는 문서와 현재 슬라이드 번호) */
export const S = {
  /** @type {import('./core/model.js').Doc|null} */
  doc: null,
  cur: 0,
};

export const curSlide = () => S.doc.slides[S.cur];

/** 슬라이드 크기 (16:9, PPT 와이드 기준) */
export const W = 1280;
export const H = 720;
