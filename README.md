# searchmd — 리서치 슬라이드 드라이브

조사한 자료(글·사진·링크)를 붙여넣어 PPT처럼 정리하고, 서버에 저장해 어느 브라우저에서든 열고 발표하는 웹 앱입니다.

- 운영: https://searchmd-3rh.pages.dev (Cloudflare Pages 프로젝트 `searchmd` — `searchmd.pages.dev`는 이미 다른 사람이 사용 중이라 자동 배정된 주소)
- 저장소: https://github.com/woon9455-lgtm/ptwmd

## 기능

- **드라이브** — 구글 드라이브처럼 폴더로 분류 (하위 폴더, 끌어서 옮기기, 이름 바꾸기, 사본, ⭐ 중요 표시, 최근 문서, 검색, 휴지통)
- **서버 저장** — 문서·폴더는 Cloudflare D1, 사진은 Cloudflare KV에 저장. 다른 브라우저·컴퓨터에서도 똑같이 보임
- **바로 발표** — 드라이브에서 ⋮ → ▶ 발표하기, 또는 발표 링크 `/p/문서id` (`?s=3`이면 3번 슬라이드부터)
- **비밀번호 로그인** — 본인만 접근 (30일 유지)
- **동시 수정 보호** — 다른 브라우저에서 먼저 저장했으면 알려 주고 최신 내용 불러오기/덮어쓰기 선택
- **레이아웃 16종 · 미니멀 테마 5종**
- **사진 칸** — 클릭해서 선택 · 끌어다 놓기 · Ctrl+V (여러 장이면 빈 칸에 차례로)
- **붙여넣기** — 웹 글의 굵게·목록·표·링크 유지, 스크립트·스타일 제거, 주소 자동 링크
- **링크** — Ctrl+K로 웹 주소 또는 다른 슬라이드 연결, Ctrl+클릭으로 열기
- PDF 저장/인쇄, `.json` 내려받기·불러오기
- 예전 버전에서 브라우저에만 저장했던 문서는 드라이브 왼쪽 아래 버튼으로 서버에 올리기

## 개발 환경

필요: Node.js 20 이상 (`.nvmrc` = 22)

처음 한 번:

```bash
npm install
echo APP_PASSWORD=dev1234 > .dev.vars   # 로컬 로그인 비밀번호 (git에 안 올라감)
npm run db:migrate:local                 # 로컬 DB 표 만들기
```

```bash
npm run dev        # 화면(Vite, http://localhost:5173) + API(wrangler, 8799) 함께 실행
npm test           # 단위 테스트 (Vitest)
npm run lint       # ESLint
npm run format     # Prettier 정리
npm run check      # lint + test + build 한 번에
```

> Windows PowerShell에서 `npx`/`npm`이 실행 정책 때문에 막히면 `npx.cmd`, `npm.cmd`로 실행하세요.
> 로컬 DB는 보통 `.wrangler/state`에 저장되고, 폴더 경로가 아주 길면 임시 폴더를 씁니다 (`scripts/wrangler-local.mjs`, `SEARCHMD_STATE`로 지정 가능).

## 배포 (Cloudflare Pages)

처음 한 번 (이미 해 둠):

```bash
npm run cf:login            # 브라우저에서 Cloudflare OAuth 승인
npm run cf:secret           # 운영 로그인 비밀번호 설정 (입력창에 직접 입력)
npm run db:migrate:remote   # 운영 DB 표 만들기
```

배포:

```bash
npm run deploy           # 운영 → https://searchmd-3rh.pages.dev
npm run deploy:preview   # 미리보기 → https://preview.searchmd-3rh.pages.dev
```

- 비밀번호를 바꾸려면 `npm run cf:secret` 후 `npm run deploy` (바꾸면 모든 기기에서 다시 로그인)
- DB 표를 바꿀 때는 `migrations/`에 새 SQL 파일을 추가하고 `db:migrate:local` → `db:migrate:remote`
- 설정: `wrangler.toml` (D1 `DB`, KV `FILES`), 응답 헤더: `public/_headers`
- GitHub에 push하면 Actions(`.github/workflows/ci.yml`)가 lint·test·build를 검사합니다

## 구조

```
index.html              화면 뼈대 (로그인 · 드라이브 · 편집기)
functions/api/[[path]].js   Cloudflare Pages Functions 진입점 → server/api.js
server/
  api.js                API (폴더·문서·사진·로그인)
  auth.js               비밀번호 확인·세션 쿠키 서명
migrations/             D1 표 정의
src/
  main.js               시작점 · 화면 전환 · 로그인
  router.js             주소(/, /f/폴더, /d/문서, /p/발표 …) → 화면
  api.js                서버 API 호출
  state.js              전역 상태 (열린 문서, 현재 슬라이드)
  views/
    drive.js            드라이브 화면
    dialogs.js          이름 입력·폴더 고르기
    localDocs.js        브라우저에만 있던 문서 올리기
  core/
    layouts.js          레이아웃·테마 정의  ← 새 레이아웃은 여기에 추가
    model.js            문서 데이터 모델·검증
    localStore.js       (예전) 브라우저 IndexedDB 저장소 — 옮기기용
  lib/
    sanitize.js         붙여넣기 HTML 정리
    upload.js           사진을 서버에 올리기
    url.js · images.js · dom.js
  editor/
    render.js           슬라이드 그리기 (편집·썸네일·발표·인쇄·드라이브 공용)
    editing.js          글 편집·붙여넣기·서버 자동 저장
    slides.js · frames.js · links.js · present.js · docs.js · toolbar.js · popover.js
  styles/
    app.css · slide.css · drive.css
tests/                  단위 테스트
scripts/                개발 도우미
prototype/              최초 프로토타입 (단일 HTML, 참고용)
```

### 새 레이아웃 추가하기

1. `src/core/layouts.js`의 `LAYOUTS`에 항목 추가 — 글 칸은 `tx(역할, 저장키, 안내문)`, 사진 칸은 `fr(저장키)`
2. `src/styles/slide.css`에 `.L-이름 { ... }` 배치 작성
3. 같은 저장키(`title`, `head1`, `img1` …)를 쓰면 레이아웃을 바꿔도 내용이 옮겨집니다
