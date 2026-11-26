// 로컬 wrangler 실행 도우미: 로컬 D1/KV 데이터 위치(--persist-to)를 정해 준다.
// Windows에서 프로젝트 폴더 경로가 길면(260자 제한) 로컬 DB가 열리지 않아서, 그때는 임시 폴더를 쓴다.
// 직접 정하려면 환경 변수 SEARCHMD_STATE=경로
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const state =
  process.env.SEARCHMD_STATE ||
  (process.platform === 'win32' && process.cwd().length > 100 ? join(tmpdir(), 'searchmd-dev') : '.wrangler/state');

const args = [...process.argv.slice(2), '--persist-to', state];
const child = spawn('npx', ['wrangler', ...args], { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code) => process.exit(code ?? 1));
