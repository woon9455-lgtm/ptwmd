import { describe, it, expect } from 'vitest';
import { newDoc, normalizeDoc, slideLabel, slideHasContent } from '../src/core/model.js';
import { LAYOUTS } from '../src/core/layouts.js';

describe('model', () => {
  it('newDoc: 표지 + 기본 슬라이드', () => {
    const d = newDoc();
    expect(d.id).toBeTruthy();
    expect(d.slides).toHaveLength(2);
    expect(d.slides[0].layout).toBe('title');
  });

  it('normalizeDoc: 잘못된 문서는 예외', () => {
    expect(() => normalizeDoc(null)).toThrow();
    expect(() => normalizeDoc({ slides: 'x' })).toThrow();
  });

  it('normalizeDoc: 알 수 없는 레이아웃·테마 보정, 사진 주소 검사', () => {
    const d = normalizeDoc(
      {
        theme: 'warm',
        slides: [{ layout: 'nope', fields: { img1: 'javascript:x', img2: 'https://a.com/b.png', 'img2:fit': 'evil' } }],
      },
      { clean: true },
    );
    expect(d.theme).toBe('light');
    expect(d.slides[0].layout).toBe('content');
    expect(d.slides[0].fields.img1).toBe('');
    expect(d.slides[0].fields.img2).toBe('https://a.com/b.png');
    expect(d.slides[0].fields['img2:fit']).toBe('');
  });

  it('normalizeDoc(clean): 글 칸 HTML을 정리한다', () => {
    const d = normalizeDoc(
      { slides: [{ layout: 'content', fields: { body: '<p>a<script>x</script></p>' } }] },
      { clean: true },
    );
    expect(d.slides[0].fields.body).toBe('<p>a</p>');
  });

  it('normalizeDoc: 중복 슬라이드 id는 새로 발급', () => {
    const d = normalizeDoc({ slides: [{ id: 'a' }, { id: 'a' }] });
    expect(d.slides[0].id).not.toBe(d.slides[1].id);
  });

  it('slideLabel / slideHasContent', () => {
    const s = { layout: 'feature', fields: { head1: '<b>핵심</b>' } };
    expect(slideLabel(s, 2)).toBe('3. 핵심');
    expect(slideHasContent(s)).toBe(true);
    expect(slideHasContent({ fields: { 'img1:fit': 'contain' } })).toBe(false);
    expect(slideHasContent({ fields: { img1: 'data:image/png;base64,x' } })).toBe(true);
  });

  it('모든 레이아웃의 저장키가 레이아웃 안에서 중복되지 않는다', () => {
    for (const [name, L] of Object.entries(LAYOUTS)) {
      const keys = [...L.tpl.matchAll(/data-k="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(keys).size, name).toBe(keys.length);
    }
  });
});
