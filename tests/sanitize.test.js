import { describe, it, expect } from 'vitest';
import { sanitize, textToHtml } from '../src/lib/sanitize.js';

describe('sanitize', () => {
  it('스크립트·스타일·이벤트 속성을 제거한다', () => {
    const out = sanitize('<p style="color:red" onclick="x()">안녕<script>alert(1)</script></p><style>p{}</style>');
    expect(out).toBe('<p>안녕</p>');
  });

  it('굵게·목록·표·링크는 유지한다', () => {
    const out = sanitize(
      '<strong>굵게</strong><ul><li>하나</li></ul><table><tr><td colspan="2">셀</td></tr></table><a href="https://a.com">링크</a>',
    );
    expect(out).toContain('<b>굵게</b>');
    expect(out).toContain('<ul><li>하나</li></ul>');
    expect(out).toContain('<td colspan="2">셀</td>');
    expect(out).toContain('<a href="https://a.com">링크</a>');
  });

  it('위험한 링크(javascript:)는 글자만 남긴다', () => {
    expect(sanitize('<a href="javascript:alert(1)">클릭</a>')).toBe('클릭');
  });

  it('상대 주소 링크는 글자만 남긴다', () => {
    expect(sanitize('<a href="/path">내부</a>')).toBe('내부');
  });

  it('제목 태그는 굵은 문단으로 바꾼다', () => {
    expect(sanitize('<h2>시장 규모</h2>')).toBe('<p><b>시장 규모</b></p>');
  });

  it('글 속 주소를 자동으로 링크로 만든다', () => {
    expect(sanitize('<p>참고 https://kosis.kr.</p>')).toBe(
      '<p>참고 <a href="https://kosis.kr">https://kosis.kr</a>.</p>',
    );
  });

  it('링크 안의 주소는 다시 링크로 감싸지 않는다', () => {
    const out = sanitize('<a href="https://a.com">https://a.com</a>');
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  it('이미지는 http(s)·data 주소만 허용한다', () => {
    expect(sanitize('<img src="https://x.com/a.png">')).toBe('<img src="https://x.com/a.png">');
    expect(sanitize('<img src="javascript:x">')).toBe('');
  });

  it('편집기가 넣은 이미지 크기 스타일만 유지한다', () => {
    expect(sanitize('<img src="https://x.com/a.png" style="width: 50%; max-height: none;">')).toContain(
      'style="width: 50%',
    );
    expect(sanitize('<img src="https://x.com/a.png" style="position:fixed">')).not.toContain('style');
  });
});

describe('textToHtml', () => {
  it('줄바꿈을 <br>로, 주소를 링크로 바꾼다', () => {
    expect(textToHtml('첫 줄\nwww.data.go.kr')).toBe('첫 줄<br><a href="https://www.data.go.kr">www.data.go.kr</a>');
  });

  it('HTML 특수문자는 이스케이프한다', () => {
    expect(textToHtml('<b>x</b>')).toBe('&lt;b&gt;x&lt;/b&gt;');
  });
});
