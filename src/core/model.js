/**
 * 문서 데이터 모델
 *
 * Doc   = { id, title, theme, slides: Slide[], createdAt, updatedAt }
 * Slide = { id, layout, fields: { [저장키]: html | 이미지주소 }, notes }
 */
import { LAYOUTS, THEMES, DEFAULT_LAYOUT, isFrameKey, isOptionKey } from './layouts.js';
import { sanitize } from '../lib/sanitize.js';
import { plain } from '../lib/dom.js';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export const newSlide = (layout = DEFAULT_LAYOUT) => ({ id: uid(), layout, fields: {}, notes: '' });

export function newDoc(title = '내 조사 자료') {
  const now = Date.now();
  return {
    id: uid(),
    title,
    theme: 'light',
    createdAt: now,
    updatedAt: now,
    slides: [
      {
        id: uid(),
        layout: 'title',
        fields: { title: '조사 주제', subtitle: '작성자 · ' + new Date().toLocaleDateString('ko-KR') },
        notes: '',
      },
      newSlide(DEFAULT_LAYOUT),
    ],
  };
}

/** 썸네일·링크 선택용 슬라이드 이름 */
export function slideLabel(slide, index) {
  if (!slide) return '(삭제된 슬라이드)';
  const f = slide.fields || {};
  const t = plain(f.title || f.head1 || f.quote || f.body || f.left || '');
  return `${index + 1}. ${t.slice(0, 30) || '(제목 없음)'}`;
}

export const slideHasContent = (slide) =>
  Object.entries(slide.fields || {}).some(
    ([k, v]) => !isOptionKey(k) && (isFrameKey(k) ? !!v : !!plain(v) || /<img/.test(v || '')),
  );

/**
 * 외부(파일 불러오기·옛 버전)에서 온 문서를 검사·정리한다.
 * 잘못된 형식이면 예외를 던진다.
 * @param {boolean} clean true면 글 칸 HTML을 다시 정리(sanitize)한다 — 외부 파일일 때 사용
 */
export function normalizeDoc(raw, { clean = false } = {}) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.slides)) throw new Error('올바른 문서가 아니에요');
  const themeIds = THEMES.map((t) => t.id);
  const now = Date.now();
  const doc = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    title: typeof raw.title === 'string' ? raw.title : '가져온 문서',
    theme: themeIds.includes(raw.theme) ? raw.theme : 'light',
    createdAt: Number(raw.createdAt) || now,
    updatedAt: Number(raw.updatedAt) || now,
    slides: [],
  };
  const seen = new Set();
  for (const s of raw.slides) {
    if (!s || typeof s !== 'object') continue;
    let id = typeof s.id === 'string' && s.id ? s.id : uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    const fields = {};
    for (const [k, v] of Object.entries(s.fields || {})) {
      if (typeof v !== 'string') continue;
      if (isFrameKey(k)) fields[k] = /^(https?:|data:image\/)/i.test(v) ? v : '';
      else if (isOptionKey(k)) fields[k] = v === 'contain' ? 'contain' : '';
      else fields[k] = clean ? sanitize(v) : v;
    }
    doc.slides.push({
      id,
      layout: LAYOUTS[s.layout] ? s.layout : 'content',
      fields,
      notes: typeof s.notes === 'string' ? s.notes : '',
    });
  }
  if (!doc.slides.length) doc.slides.push(newSlide());
  return doc;
}
