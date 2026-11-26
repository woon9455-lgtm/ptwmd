import { describe, it, expect } from 'vitest';
import { safeUrl, normalizeUrl, prettyUrl, isImgUrl, slideIdOf, slideHref } from '../src/lib/url.js';

describe('url', () => {
  it('safeUrl: 허용 주소만 통과', () => {
    expect(safeUrl('https://a.com')).toBe('https://a.com');
    expect(safeUrl('mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(safeUrl('#slide-abc')).toBe('#slide-abc');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,x')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });

  it('normalizeUrl: 입력을 정규화', () => {
    expect(normalizeUrl('example.com')).toBe('https://example.com');
    expect(normalizeUrl(' http://a.com ')).toBe('http://a.com');
    expect(normalizeUrl('me@mail.com')).toBe('mailto:me@mail.com');
    expect(normalizeUrl('')).toBe('');
  });

  it('prettyUrl: 짧은 도메인 표시', () => {
    expect(prettyUrl('https://www.instagram.com/p/xyz')).toBe('instagram.com');
    expect(prettyUrl('잘못된 주소')).toBe('잘못된 주소');
  });

  it('isImgUrl: 이미지 주소 판별', () => {
    expect(isImgUrl('https://x.com/a.JPG?w=200')).toBe(true);
    expect(isImgUrl('https://x.com/page')).toBe(false);
  });

  it('슬라이드 링크 변환', () => {
    expect(slideIdOf(slideHref('k1'))).toBe('k1');
    expect(slideIdOf('https://a.com')).toBeNull();
  });
});
