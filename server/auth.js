/**
 * 비밀번호 로그인 세션.
 * 쿠키 값 = "만료시각.서명" (HMAC-SHA256, 키는 APP_PASSWORD에서 만든다 → 비밀번호를 바꾸면 모든 세션이 끊긴다)
 */
const enc = new TextEncoder();
export const COOKIE = 'sm_session';
export const SESSION_DAYS = 30;

const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode('searchmd-session:' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

const sign = async (secret, text) => b64u(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(text)));

/** 길이가 같으면 끝까지 비교 (시간 차이로 내용을 알아내지 못하게) */
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(secret, input) {
  if (!secret || typeof input !== 'string') return false;
  const h = async (s) => b64u(await crypto.subtle.digest('SHA-256', enc.encode(s)));
  return safeEqual(await h(secret), await h(input));
}

export async function makeToken(secret, days = SESSION_DAYS, now = Date.now()) {
  const exp = String(now + days * 86400000);
  return `${exp}.${await sign(secret, exp)}`;
}

export async function checkToken(secret, token, now = Date.now()) {
  if (!secret || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  return safeEqual(await sign(secret, exp), sig);
}

export function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export const sessionCookie = (token, maxAgeSec) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
