# searchmd — 리서치 슬라이드

조사한 자료(글·사진·링크)를 붙여넣어 PPT처럼 정리하는 웹 편집기입니다.

- 운영: https://searchmd-3rh.pages.dev (Cloudflare Pages 프로젝트 `searchmd` — `searchmd.pages.dev`는 이미 다른 사람이 사용 중이라 자동 배정된 주소)
- 저장소: https://github.com/woon9455-lgtm/ptwmd

## 기능

- **레이아웃 16종** — 사진+핵심, 풀 사진, 강한 문장, 사진 2·3장, 사진 모음, 링크 카드 4개, 링크 보드 6개, 핵심 수치 등
- **미니멀 테마 5종** — 화이트 · 그레이 · 블랙 · 블루 · 모노
- **사진 칸** — 클릭해서 선택 · 끌어다 놓기 · Ctrl+V (여러 장이면 빈 칸에 차례로)
- **붙여넣기** — 웹 글의 굵게·목록·표·링크 유지, 스크립트·스타일 제거, 주소 자동 링크
- **링크** — Ctrl+K로 웹 주소 또는 다른 슬라이드 연결, Ctrl+클릭으로 열기
- **여러 문서** — 📁 파일 → 문서 목록에서 열기·삭제, 새 문서
- **발표**(F5), PDF 저장/인쇄, `.json` 파일로 저장·불러오기
- 브라우저(IndexedDB)에 자동 저장 — 프로토타입에서 쓰던 문서도 자동으로 옮겨짐

## 개발 환경

필요: Node.js 20 이상 (`.nvmrc` = 22)

```bash
npm install        # 의존성 설치
npm run dev        # 개발 서버 http://localhost:5173
npm test           # 단위 테스트 (Vitest + jsdom)
npm run lint       # ESLint
npm run format     # Prettier 정리
npm run check      # lint + test + build 한 번에
npm run build      # dist/ 에 배포용 빌드
npm run preview    # 빌드 결과 미리보기
```

## 배포 (Cloudflare Pages)

처음 한 번:

```bash
npm run cf:login   # 브라우저가 열리면 Cloudflare 계정으로 OAuth 승인
npm run cf:create  # searchmd 프로젝트 생성 (production 브랜치 = main)
```

배포:

```bash
npm run deploy           # 운영 → https://searchmd-3rh.pages.dev
npm run deploy:preview   # 미리보기 → https://preview.searchmd-3rh.pages.dev
```

설정은 `wrangler.toml`, 응답 헤더는 `public/_headers`에 있습니다.
GitHub에 push하면 Actions(`.github/workflows/ci.yml`)가 lint·test·build를 검사합니다.

## 구조

```
index.html              화면 뼈대
src/
  main.js               시작점 (초기화)
  state.js              전역 상태 (열린 문서, 현재 슬라이드)
  core/
    layouts.js          레이아웃·테마 정의  ← 새 레이아웃은 여기에 추가
    model.js            문서 데이터 모델·검증
    storage.js          IndexedDB 저장소
  lib/
    sanitize.js         붙여넣기 HTML 정리
    url.js              주소 처리
    images.js           이미지 읽기·축소
    dom.js              DOM 도우미
  editor/
    render.js           슬라이드 그리기 (편집·썸네일·발표·인쇄 공용)
    editing.js          글 편집·붙여넣기·자동 저장
    slides.js           썸네일·슬라이드 추가/삭제/이동
    frames.js           사진 칸
    links.js            링크 대화상자·팝업
    present.js          발표 모드
    docs.js             문서 목록·파일 저장/불러오기·인쇄
    toolbar.js          도구 모음·단축키
  styles/
    app.css             편집기 화면
    slide.css           슬라이드 테마·레이아웃
tests/                  단위 테스트
prototype/              최초 프로토타입 (단일 HTML, 참고용)
```

### 새 레이아웃 추가하기

1. `src/core/layouts.js`의 `LAYOUTS`에 항목 추가 — 글 칸은 `tx(역할, 저장키, 안내문)`, 사진 칸은 `fr(저장키)`
2. `src/styles/slide.css`에 `.L-이름 { ... }` 배치 작성
3. 같은 저장키(`title`, `head1`, `img1` …)를 쓰면 레이아웃을 바꿔도 내용이 옮겨집니다
