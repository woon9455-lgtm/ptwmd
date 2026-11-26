import './styles/app.css';
import './styles/slide.css';

import { $ } from './lib/dom.js';
import { initEditing, flushSave, hasPendingSave } from './editor/editing.js';
import { initFrames } from './editor/frames.js';
import { initLinks } from './editor/links.js';
import { initPresent, isPresenting, scaleP } from './editor/present.js';
import { initToolbar } from './editor/toolbar.js';
import { scaleStage } from './editor/slides.js';
import { startup } from './editor/docs.js';

initEditing();
initFrames();
initLinks();
initPresent();
initToolbar();

addEventListener('resize', () => {
  scaleStage();
  if (isPresenting()) scaleP();
});
new ResizeObserver(scaleStage).observe($('#stage'));

// 탭을 닫거나 숨길 때 저장 대기 중인 내용을 바로 저장
addEventListener('pagehide', () => hasPendingSave() && flushSave());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && hasPendingSave()) flushSave();
});

startup();
