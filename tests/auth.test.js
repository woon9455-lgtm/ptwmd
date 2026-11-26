// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { makeToken, checkToken, checkPassword, getCookie, safeEqual } from '../server/auth.js';

describe('server/auth', () => {
  it('비밀번호 확인', async () => {
    expect(await checkPassword('secret-pw', 'secret-pw')).toBe(true);
    expect(await checkPassword('secret-pw', 'wrong')).toBe(false);
    expect(await checkPassword('', '')).toBe(false);
    expect(await checkPassword('x', undefined)).toBe(false);
  });

  it('세션 토큰: 발급 → 확인', async () => {
    const t = await makeToken('pw');
    expect(await checkToken('pw', t)).toBe(true);
  });

  it('세션 토큰: 비밀번호가 바뀌면 무효', async () => {
    const t = await makeToken('pw');
    expect(await checkToken('pw2', t)).toBe(false);
  });

  it('세션 토큰: 만료·위조 거부', async () => {
    const t = await makeToken('pw', 1, Date.now() - 2 * 86400000);
    expect(await checkToken('pw', t)).toBe(false);
    const ok = await makeToken('pw');
    const [, sig] = ok.split('.');
    expect(await checkToken('pw', `${Date.now() + 999999999}.${sig}`)).toBe(false);
    expect(await checkToken('pw', 'garbage')).toBe(false);
    expect(await checkToken('pw', null)).toBe(false);
  });

  it('쿠키 읽기', () => {
    const req = new Request('https://x', { headers: { cookie: 'a=1; sm_session=abc.def=; b=2' } });
    expect(getCookie(req, 'sm_session')).toBe('abc.def=');
    expect(getCookie(req, 'none')).toBeNull();
  });

  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });
});
