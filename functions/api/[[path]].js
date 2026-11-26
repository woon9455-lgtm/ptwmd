// Cloudflare Pages Functions — /api/* 요청을 server/api.js로 넘긴다
import { handle } from '../../server/api.js';

export async function onRequest({ request, env }) {
  try {
    return await handle(request, env);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: '서버 오류가 났어요: ' + (err?.message || err) }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
