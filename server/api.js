/**
 * searchmd 서버 API (Cloudflare Pages Functions)
 *
 *  POST   /api/login            {password}        로그인 (쿠키 발급)
 *  POST   /api/logout                             로그아웃
 *  GET    /api/me                                 로그인 확인
 *  GET    /api/folders                            폴더 전체
 *  POST   /api/folders          {name, parentId}
 *  PATCH  /api/folders/:id      {name?, parentId?}
 *  DELETE /api/folders/:id                        하위 폴더 삭제 + 안의 문서는 휴지통으로
 *  GET    /api/docs?view=folder|recent|starred|trash|search&folder=&q=
 *  POST   /api/docs             {doc, folderId}
 *  GET    /api/docs/:id
 *  PUT    /api/docs/:id         {doc, version}    저장 (version이 다르면 409)
 *  PATCH  /api/docs/:id         {title?, folderId?, starred?, trashed?}
 *  POST   /api/docs/:id/copy
 *  DELETE /api/docs/:id                           영구 삭제 (휴지통에 있는 것만)
 *  DELETE /api/trash                              휴지통 비우기
 *  POST   /api/images           (이미지 바이트)    → {url}
 *  GET    /api/images/:id
 */
import { COOKIE, SESSION_DAYS, checkPassword, checkToken, getCookie, makeToken, sessionCookie } from './auth.js';

const MAX_DOC_BYTES = 1_800_000; // D1 한 행 한도(2MB)보다 작게
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const THEMES = ['light', 'gray', 'black', 'blue', 'mono'];

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
const fail = (status, message, extra = {}) => json({ error: message, ...extra }, status);
const newId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 20);
const now = () => Date.now();

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/* ---------- 진입점 ---------- */
export async function handle(request, env) {
  const url = new URL(request.url);
  const seg = url.pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean);
  const method = request.method;

  if (!env.APP_PASSWORD) return fail(500, '서버 비밀번호(APP_PASSWORD)가 아직 설정되지 않았어요');

  if (seg[0] === 'login' && method === 'POST') return login(request, env);
  if (seg[0] === 'logout' && method === 'POST') return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });

  if (!(await checkToken(env.APP_PASSWORD, getCookie(request, COOKIE)))) return fail(401, '로그인이 필요해요');

  // 다른 사이트에서 보낸 변경 요청 차단
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host') || url.host; // 로컬 개발 프록시에서도 브라우저가 보낸 Host로 비교
    if (origin && new URL(origin).host !== host) return fail(403, '허용되지 않은 요청이에요');
  }

  const [res, id, sub] = seg;
  switch (res) {
    case 'me':
      return json({ ok: true });
    case 'folders':
      return folders(method, id, request, env);
    case 'docs':
      return docs(method, id, sub, request, env, url);
    case 'trash':
      if (method === 'DELETE') return emptyTrash(env);
      break;
    case 'images':
      return images(method, id, request, env);
  }
  return fail(404, '없는 주소예요');
}

async function login(request, env) {
  const body = await readJson(request);
  if (!(await checkPassword(env.APP_PASSWORD, body?.password))) {
    await new Promise((r) => setTimeout(r, 700)); // 무작위 대입 속도 늦추기
    return fail(401, '비밀번호가 맞지 않아요');
  }
  const token = await makeToken(env.APP_PASSWORD);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86400) });
}

/* ---------- 폴더 ---------- */
const cleanName = (n) => (typeof n === 'string' ? n.trim().slice(0, 100) : '');

async function allFolders(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, name, parent_id AS parentId, updated_at AS updatedAt FROM folders ORDER BY name COLLATE NOCASE',
  ).all();
  return results;
}

/** id 폴더와 그 아래 모든 폴더 id */
function descendants(list, id) {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of list) {
      if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
        out.add(f.id);
        grew = true;
      }
    }
  }
  return out;
}

async function folders(method, id, request, env) {
  if (!id && method === 'GET') return json({ folders: await allFolders(env) });

  if (!id && method === 'POST') {
    const b = await readJson(request);
    const name = cleanName(b?.name);
    if (!name) return fail(400, '폴더 이름을 입력하세요');
    const parentId = b?.parentId || null;
    if (parentId && !(await env.DB.prepare('SELECT 1 FROM folders WHERE id=?').bind(parentId).first()))
      return fail(400, '상위 폴더가 없어요');
    const f = { id: newId(), name, parentId, updatedAt: now() };
    await env.DB.prepare('INSERT INTO folders (id, name, parent_id, created_at, updated_at) VALUES (?,?,?,?,?)')
      .bind(f.id, f.name, f.parentId, f.updatedAt, f.updatedAt)
      .run();
    return json({ folder: f }, 201);
  }

  if (!id) return fail(405, '지원하지 않는 요청이에요');
  const list = await allFolders(env);
  const folder = list.find((f) => f.id === id);
  if (!folder) return fail(404, '폴더가 없어요');

  if (method === 'PATCH') {
    const b = (await readJson(request)) || {};
    const name = b.name !== undefined ? cleanName(b.name) : folder.name;
    if (!name) return fail(400, '폴더 이름을 입력하세요');
    let parentId = folder.parentId;
    if (b.parentId !== undefined) {
      parentId = b.parentId || null;
      if (parentId && !list.some((f) => f.id === parentId)) return fail(400, '옮길 폴더가 없어요');
      if (parentId && descendants(list, id).has(parentId)) return fail(400, '폴더를 자기 안으로 옮길 수 없어요');
    }
    await env.DB.prepare('UPDATE folders SET name=?, parent_id=?, updated_at=? WHERE id=?')
      .bind(name, parentId, now(), id)
      .run();
    return json({ folder: { ...folder, name, parentId } });
  }

  if (method === 'DELETE') {
    const ids = [...descendants(list, id)];
    const marks = ids.map(() => '?').join(',');
    const t = now();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE docs SET trashed_at=COALESCE(trashed_at, ?), folder_id=NULL WHERE folder_id IN (${marks})`,
      ).bind(t, ...ids),
      env.DB.prepare(`DELETE FROM folders WHERE id IN (${marks})`).bind(...ids),
    ]);
    return json({ ok: true, deleted: ids.length });
  }
  return fail(405, '지원하지 않는 요청이에요');
}

/* ---------- 문서 ---------- */
const LIST_COLS =
  'id, title, folder_id AS folderId, theme, slide_count AS slideCount, preview, starred, trashed_at AS trashedAt, updated_at AS updatedAt, created_at AS createdAt';

/** 문서 본문 검사 → 저장할 값 */
function prepareDoc(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.slides)) return { error: '문서 형식이 올바르지 않아요' };
  const body = {
    title: typeof doc.title === 'string' ? doc.title.slice(0, 200) : '',
    theme: THEMES.includes(doc.theme) ? doc.theme : 'light',
    slides: doc.slides,
  };
  const text = JSON.stringify(body);
  if (new TextEncoder().encode(text).length > MAX_DOC_BYTES)
    return { error: '문서가 너무 커요. 사진은 사진 칸에 넣어 주세요(서버에 따로 저장돼요)' };
  return {
    text,
    title: body.title || '제목 없는 문서',
    theme: body.theme,
    slideCount: body.slides.length,
    preview: JSON.stringify(body.slides[0] || null),
  };
}

const rowToMeta = (r) => ({ ...r, starred: !!r.starred, preview: r.preview ? JSON.parse(r.preview) : null });

async function docs(method, id, sub, request, env, url) {
  if (!id && method === 'GET') {
    const view = url.searchParams.get('view') || 'folder';
    let stmt;
    if (view === 'recent')
      stmt = env.DB.prepare(`SELECT ${LIST_COLS} FROM docs WHERE trashed_at IS NULL ORDER BY updated_at DESC LIMIT 60`);
    else if (view === 'starred')
      stmt = env.DB.prepare(
        `SELECT ${LIST_COLS} FROM docs WHERE trashed_at IS NULL AND starred=1 ORDER BY updated_at DESC`,
      );
    else if (view === 'trash')
      stmt = env.DB.prepare(`SELECT ${LIST_COLS} FROM docs WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC`);
    else if (view === 'search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
      if (!q) return json({ docs: [] });
      const like = '%' + q.replace(/[\\%_]/g, (c) => '\\' + c) + '%';
      stmt = env.DB.prepare(
        `SELECT ${LIST_COLS} FROM docs WHERE trashed_at IS NULL AND (title LIKE ?1 ESCAPE '\\' OR body LIKE ?1 ESCAPE '\\') ORDER BY updated_at DESC LIMIT 100`,
      ).bind(like);
    } else {
      const folder = url.searchParams.get('folder') || null;
      stmt = env.DB.prepare(
        `SELECT ${LIST_COLS} FROM docs WHERE trashed_at IS NULL AND folder_id IS ? ORDER BY updated_at DESC`,
      ).bind(folder);
    }
    const { results } = await stmt.all();
    return json({ docs: results.map(rowToMeta) });
  }

  if (!id && method === 'POST') {
    const b = await readJson(request);
    const p = prepareDoc(b?.doc);
    if (p.error) return fail(400, p.error);
    const folderId = b?.folderId || null;
    if (folderId && !(await env.DB.prepare('SELECT 1 FROM folders WHERE id=?').bind(folderId).first()))
      return fail(400, '폴더가 없어요');
    const docId = newId();
    const t = now();
    await env.DB.prepare(
      'INSERT INTO docs (id, title, folder_id, theme, slide_count, preview, body, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
    )
      .bind(docId, p.title, folderId, p.theme, p.slideCount, p.preview, p.text, t, t)
      .run();
    return json({ id: docId, version: 1, updatedAt: t }, 201);
  }

  if (!id) return fail(405, '지원하지 않는 요청이에요');
  const row = await env.DB.prepare('SELECT * FROM docs WHERE id=?').bind(id).first();
  if (!row) return fail(404, '문서가 없어요');

  if (sub === 'copy' && method === 'POST') {
    const body = JSON.parse(row.body);
    body.title = (body.title || row.title) + ' 사본';
    const p = prepareDoc(body);
    if (p.error) return fail(400, p.error);
    const docId = newId();
    const t = now();
    await env.DB.prepare(
      'INSERT INTO docs (id, title, folder_id, theme, slide_count, preview, body, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)',
    )
      .bind(docId, p.title, row.folder_id, p.theme, p.slideCount, p.preview, p.text, t, t)
      .run();
    return json({ id: docId }, 201);
  }
  if (sub) return fail(404, '없는 주소예요');

  if (method === 'GET') {
    return json({
      doc: {
        ...JSON.parse(row.body),
        id: row.id,
        folderId: row.folder_id,
        starred: !!row.starred,
        trashedAt: row.trashed_at,
        version: row.version,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
      },
    });
  }

  if (method === 'PUT') {
    const b = await readJson(request);
    if (Number(b?.version) !== row.version)
      return fail(409, '다른 곳에서 먼저 수정했어요', { version: row.version, updatedAt: row.updated_at });
    const p = prepareDoc(b?.doc);
    if (p.error) return fail(400, p.error);
    const t = now();
    const version = row.version + 1;
    const r = await env.DB.prepare(
      'UPDATE docs SET title=?, theme=?, slide_count=?, preview=?, body=?, version=?, updated_at=? WHERE id=? AND version=?',
    )
      .bind(p.title, p.theme, p.slideCount, p.preview, p.text, version, t, id, row.version)
      .run();
    if (!r.meta?.changes) return fail(409, '다른 곳에서 먼저 수정했어요');
    return json({ version, updatedAt: t });
  }

  if (method === 'PATCH') {
    const b = (await readJson(request)) || {};
    const sets = [];
    const vals = [];
    let version = row.version;
    if (b.title !== undefined) {
      const title = String(b.title).trim().slice(0, 200) || '제목 없는 문서';
      const body = JSON.parse(row.body);
      body.title = title;
      version++;
      sets.push('title=?', 'body=?', 'version=?', 'updated_at=?');
      vals.push(title, JSON.stringify(body), version, now());
    }
    if (b.folderId !== undefined) {
      const folderId = b.folderId || null;
      if (folderId && !(await env.DB.prepare('SELECT 1 FROM folders WHERE id=?').bind(folderId).first()))
        return fail(400, '폴더가 없어요');
      sets.push('folder_id=?');
      vals.push(folderId);
    }
    if (b.starred !== undefined) {
      sets.push('starred=?');
      vals.push(b.starred ? 1 : 0);
    }
    if (b.trashed !== undefined) {
      sets.push('trashed_at=?');
      vals.push(b.trashed ? now() : null);
      // 복원할 때 원래 폴더가 지워졌으면 '내 드라이브'로
      if (
        !b.trashed &&
        row.folder_id &&
        !(await env.DB.prepare('SELECT 1 FROM folders WHERE id=?').bind(row.folder_id).first())
      )
        sets.push('folder_id=NULL');
    }
    if (!sets.length) return fail(400, '바꿀 내용이 없어요');
    await env.DB.prepare(`UPDATE docs SET ${sets.join(', ')} WHERE id=?`)
      .bind(...vals, id)
      .run();
    return json({ ok: true, version });
  }

  if (method === 'DELETE') {
    if (!row.trashed_at) return fail(400, '휴지통에 있는 문서만 영구 삭제할 수 있어요');
    await env.DB.prepare('DELETE FROM docs WHERE id=?').bind(id).run();
    return json({ ok: true });
  }
  return fail(405, '지원하지 않는 요청이에요');
}

async function emptyTrash(env) {
  const r = await env.DB.prepare('DELETE FROM docs WHERE trashed_at IS NOT NULL').run();
  return json({ ok: true, deleted: r.meta?.changes || 0 });
}

/* ---------- 사진 ---------- */
async function images(method, id, request, env) {
  if (!id && method === 'POST') {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim();
    if (!/^image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)$/.test(type)) return fail(415, '이미지 파일만 올릴 수 있어요');
    const buf = await request.arrayBuffer();
    if (!buf.byteLength) return fail(400, '빈 파일이에요');
    if (buf.byteLength > MAX_IMAGE_BYTES) return fail(413, '사진이 너무 커요 (최대 15MB)');
    const imgId = newId();
    await env.FILES.put('img:' + imgId, buf, { metadata: { type, size: buf.byteLength, createdAt: now() } });
    return json({ url: '/api/images/' + imgId }, 201);
  }
  if (id && method === 'GET') {
    if (!/^[a-f0-9]{8,40}$/.test(id)) return fail(404, '사진이 없어요');
    const { value, metadata } = await env.FILES.getWithMetadata('img:' + id, 'arrayBuffer');
    if (!value) return fail(404, '사진이 없어요');
    const type = metadata?.type || 'application/octet-stream';
    return new Response(value, {
      headers: {
        'content-type': type,
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        // SVG 안의 스크립트가 실행되지 않게
        ...(type === 'image/svg+xml'
          ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }
          : {}),
      },
    });
  }
  return fail(405, '지원하지 않는 요청이에요');
}
