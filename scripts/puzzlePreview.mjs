// docs/spec/puzzle.md §3-4 — 문제를 보드 그림으로 렌더해 사람이 훑어볼 수 있게 한다.
//
//   node scripts/puzzlePreview.mjs                 # 앞에서 3개
//   node scripts/puzzlePreview.mjs --last 40       # 마지막 40개 중에서
//   node scripts/puzzlePreview.mjs --ids p0007,p0012
//   node scripts/puzzlePreview.mjs --max 5         # 최대 몇 개를 그릴지
//
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK = resolve(HERE, '../src/puzzles/bank.json');

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};

const { puzzles } = JSON.parse(readFileSync(BANK, 'utf8'));
const LAST = Number(arg('last', 0));
const MAX  = Number(arg('max', 3));
const IDS  = arg('ids', null);

let pool = puzzles;
if (IDS) {
  const want = new Set(IDS.split(','));
  pool = puzzles.filter(p => want.has(p.id));
} else if (LAST > 0) {
  pool = puzzles.slice(-LAST);
}

// 고르게 뽑는다 (앞쪽만 보이지 않도록)
const step = Math.max(1, Math.floor(pool.length / MAX));
const picked = pool.filter((_, i) => i % step === 0).slice(0, MAX);

const count = { easy: 0, normal: 0, hard: 0 };
for (const p of pool) count[p.difficulty]++;

console.log(`## 새 문제 ${pool.length}개`);
console.log('');
console.log(`쉬움 ${count.easy} · 보통 ${count.normal} · 어려움 ${count.hard} — 전체 ${puzzles.length}개`);
console.log('');
console.log('정답 유효성(빈 자리 / 강제승 / 금수 아님)은 테스트에서 전수 검증됩니다.');
console.log('아래는 **퍼즐로서 읽을 만한지** 사람이 확인하기 위한 샘플입니다.');
console.log('');
console.log('`●` 흑 · `○` 백 · `★` 정답');
console.log('');

for (const p of picked) {
  const g = Array.from({ length: 15 }, () => Array(15).fill('.'));
  for (const [r, c] of p.b) g[r][c] = '●';
  for (const [r, c] of p.w) g[r][c] = '○';
  for (const [r, c] of p.solution) g[r][c] = '★';

  const all = [...p.b, ...p.w, ...p.solution];
  const rs = all.map(x => x[0]), cs = all.map(x => x[1]);
  const r0 = Math.max(0, Math.min(...rs) - 1), r1 = Math.min(14, Math.max(...rs) + 1);
  const c0 = Math.max(0, Math.min(...cs) - 1), c1 = Math.min(14, Math.max(...cs) + 1);

  console.log(`### ${p.id} — ${p.difficulty} · 돌 ${p.b.length + p.w.length}개 · 정답 ${p.solution.length}곳`);
  console.log('```');
  for (let r = r0; r <= r1; r++) console.log(g[r].slice(c0, c1 + 1).join(' '));
  console.log('```');
  console.log('');
}

console.log('---');
console.log('문제가 자명하거나(이미 열린 4 등) 읽을 거리가 없으면 머지하지 말고 알려주세요 — 생성 필터를 손봐야 합니다.');
