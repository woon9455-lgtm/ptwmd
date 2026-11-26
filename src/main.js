import './styles/app.css';
import './styles/slide.css';
import './styles/drive.css';

import { $, toast } from './lib/dom.js';
import { api, setUnauthorizedHandler } from './api.js';
import { S } from './state.js';
import { startRouter, navigate, folderPath } from './router.js';
import { initEditing, flushSave, hasPendingSave } from './editor/editing.js';
import { initFrames } from './editor/frames.js';
import { initLinks } from './editor/links.js';
import { initPresent, isPresenting, scaleP, present, exitP } from './editor/present.js';
import { initToolbar } from './editor/toolbar.js';
import { scaleStage } from './editor/slides.js';
import { initDocs, openDoc, closeDoc } from './editor/docs.js';
import { initDrive, showDrive, hideCtx } from './views/drive.js';

/* ---------- 화면 전환 ---------- */
const VIEWS = ['bootView', 'loginView', 'driveView', 'editorView'];
function showView(name) {
  for (const v of VIEWS) $('#' + v).hidden = v !== name;
  hideCtx();
  if (name === 'editorView') requestAnimationFrame(scaleStage);
}

let loggedIn = false;
let inAppNav = 0; // 앱 안에서 이동한 횟수 (발표를 끝낼 때 뒤로 갈지 판단)

async function render(route) {
  if (!loggedIn) return showLogin();
  if (isPresenting() && route.view !== 'present') exitP(false);

  if (route.view === 'drive') {
    if (S.doc) await closeDoc();
    showView('driveView');
    return showDrive(route);
  }
  showView('editorView');
  if (!(await openDoc(route.id))) return;
  if (route.view === 'present') {
    present(route.slide, {
      onExit: () => {
        if (inAppNav > 1) history.back();
        else navigate(folderPath(S.doc?.folderId), { replace: true });
      },
    });
  }
}

/* ---------- 로그인 ---------- */
function showLogin() {
  loggedIn = false;
  showView('loginView');
  $('#loginErr').textContent = '';
  setTimeout(() => $('#loginPw').focus(), 0);
}

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  $('#loginErr').textContent = '';
  try {
    await api.login($('#loginPw').value);
    $('#loginPw').value = '';
    loggedIn = true;
    await startRouterOnce();
  } catch (err) {
    $('#loginErr').textContent = err.message;
    $('#loginPw').select();
  } finally {
    btn.disabled = false;
  }
};

setUnauthorizedHandler(() => {
  if (!loggedIn) return;
  toast('로그인이 만료됐어요. 다시 로그인하세요');
  showLogin();
});

let routerStarted = false;
async function startRouterOnce() {
  if (routerStarted) return navigate(location.pathname + location.search, { replace: true });
  routerStarted = true;
  const origPush = history.pushState.bind(history);
  history.pushState = (...args) => {
    inAppNav++;
    return origPush(...args);
  };
  inAppNav = 1;
  return startRouter(render);
}

/* ---------- 시작 ---------- */
initEditing();
initFrames();
initLinks();
initPresent();
initToolbar();
initDocs();
initDrive();

addEventListener('resize', () => {
  if (!$('#editorView').hidden) scaleStage();
  if (isPresenting()) scaleP();
});
new ResizeObserver(() => !$('#editorView').hidden && scaleStage()).observe($('#stage'));

// 저장이 끝나기 전에 창을 닫으려 하면 알려 주고, 숨길 때는 바로 저장
addEventListener('beforeunload', (e) => {
  if (hasPendingSave()) {
    flushSave();
    e.preventDefault();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && hasPendingSave()) flushSave();
});

(async () => {
  try {
    await api.me();
    loggedIn = true;
    await startRouterOnce();
  } catch (err) {
    if (err.status === 401) showLogin();
    else {
      showView('bootView');
      $('#bootView').textContent = '⚠ ' + err.message;
    }
  }
})();
