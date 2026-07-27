// docs/spec/puzzle.md §3 — 문제은행 오프라인 생성 (Node 직접 실행, 빌드 불필요)
//
//   node scripts/puzzles.mjs                  # 기본: 60판에서 수집, bank.json 기록
//   node scripts/puzzles.mjs --games 200      # 대국 수
//   node scripts/puzzles.mjs --seed 7         # 오프닝 시드(재현 가능)
//   node scripts/puzzles.mjs --dry            # 파일로 쓰지 않고 통계만 출력
//
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emptyBoard, BOARD_SIZE } from '../src/engine/board.js';
import { isForbidden } from '../src/engine/forbidden.js';
import { vcfSearch } from '../src/ai/vcf.js';
import { hasImmediate, getCandidates } from '../src/ai/evaluate.js';
import { playGame, randomOpenings, mulberry32 } from '../src/ai/arena/arena.js';
import { createAiPlayer } from '../src/ai/createAiPlayer.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = resolve(HERE, '../src/puzzles/bank.json');

// ── 인자 파싱
const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def;
};
const GAMES = Number(arg('games', 60));
const SEED  = Number(arg('seed', 20260727));
const DRY   = argv.includes('--dry');

// ── 국면 → 정답 목록 (§2 정답은 복수 가능)
// 흑 차례 국면에서 "강제승으로 이어지는 착수점"을 모두 찾는다.
function findSolutions(board) {
  const solutions = [];

  // §2-1 흑이 지금 당장 5목을 만들 수 있으면 자명한 국면 → 제외
  for (const { row, col } of getCandidates(board, 2)) {
    if (board[row][col] !== null) continue;
    if (hasImmediate(board, row, col, 'B')) return { solutions: [], kind: 'trivial' };
  }

  // VCF 강제승 — 각 후보를 두어 보고, 그 뒤로도 강제승이 유지되는지 확인
  const vcf = vcfSearch(board.map(r => [...r]), 'B');
  if (!vcf) return { solutions: [], kind: null };

  // vcfSearch는 한 수만 반환하므로, 동치인 다른 정답도 직접 검사한다.
  for (const { row, col } of getCandidates(board, 2)) {
    if (board[row][col] !== null) continue;
    if (isForbidden(board, row, col, 'B')) continue; // §10 금수는 정답 불가
    const next = board.map(r => [...r]);
    next[row][col] = 'B';
    // 이 수가 즉시 5목이면 위에서 잡혔어야 한다. 여기서는 강제 수순만 본다.
    if (!createsForcedWin(next)) continue;
    solutions.push([row, col]);
  }
  // §2-1 아무 데나 둬도 이기는 국면은 변별력이 없다
  if (solutions.length >= 4) return { solutions: [], kind: 'trivial' };
  return { solutions, kind: 'vcf' };
}

// 흑이 방금 두었고 백이 응수해야 하는 국면에서, 흑의 강제승이 유지되는가.
// 백의 모든 합법 응수에 대해 흑이 계속 이길 수 있어야 한다(간이 판정).
function createsForcedWin(board) {
  // 백이 지금 당장 이기면 실패
  for (const { row, col } of getCandidates(board, 2)) {
    if (board[row][col] === null && hasImmediate(board, row, col, 'W')) return false;
  }
  // 흑이 다음 수로 5목을 만들 자리(=백이 반드시 막아야 하는 곳)
  const threats = getCandidates(board, 2)
    .filter(({ row, col }) => board[row][col] === null && hasImmediate(board, row, col, 'B'));

  if (threats.length === 0) return false;      // 강제(4) 상태가 아니면 VCF 수순이 아니다
  if (threats.length >= 2) return true;        // 백이 둘 다 막을 수 없다 → 승리 확정

  // 유일 방어점을 백이 막은 뒤에도 흑에게 VCF가 남아야 한다
  const [t] = threats;
  const after = board.map(r => [...r]);
  after[t.row][t.col] = 'W';
  return !!vcfSearch(after, 'B');
}

function stonesOf(board) {
  const b = [], w = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 'B') b.push([r, c]);
      else if (board[r][c] === 'W') w.push([r, c]);
    }
  return { b, w };
}

// 강제승까지의 수순 길이로 난이도 판정 (§2-2)
function classify(board) {
  const copy = board.map(r => [...r]);
  if (vcfSearch(copy, 'B', 1)) return 'easy';
  if (vcfSearch(copy.map(r => [...r]), 'B', 3)) return 'normal';
  return 'hard';
}

// ── 수집
const rng = mulberry32(SEED);
// 판마다 서로 다른 초기 배치(결정적 두뇌 다양화 — ai-arena.md §5-4)
const books = randomOpenings(GAMES, { stones: 4, seed: SEED, radius: 4 });
const players = ['normal', 'hard'].map(d => createAiPlayer(d));
const puzzles = [];
const seen = new Set();
let scanned = 0;

console.log(`문제은행 생성 — ${GAMES}판 (seed ${SEED})`);

for (let g = 0; g < GAMES; g++) {
  const openings = books[g];
  const pB = players[Math.floor(rng() * players.length)];
  const pW = players[Math.floor(rng() * players.length)];
  const { history } = playGame(pB, pW, { openingMoves: openings });

  // 기보를 되짚으며 "흑이 둘 차례"인 국면마다 검사
  const board = emptyBoard();
  let takenThisGame = 0; // §3-1 한 대국에서 최대 2문제 (인접 국면은 서로 비슷하다)
  for (const mv of history) {
    if (mv.color === 'B' && takenThisGame < 2) {
      const stoneCount = board.flat().filter(Boolean).length;
      // §3-1 돌이 너무 적거나 많은 국면은 제외
      if (stoneCount >= 6 && stoneCount <= 40) {
        scanned++;
        const { solutions, kind } = findSolutions(board);
        if (solutions.length > 0) {
          const { b, w } = stonesOf(board);
          const key = JSON.stringify([b, w]);
          if (!seen.has(key)) {
            seen.add(key);
            takenThisGame++;
            puzzles.push({
              id: `p${String(puzzles.length + 1).padStart(4, '0')}`,
              b, w,
              solution: solutions,
              difficulty: classify(board),
            });
          }
        }
      }
    }
    board[mv.row][mv.col] = mv.color;
  }
  if ((g + 1) % 10 === 0) console.log(`  ${g + 1}/${GAMES}판 · 국면 ${scanned} 검사 · 퍼즐 ${puzzles.length}개`);
}

// ── 검증 (§10) — 모든 정답이 금수가 아니고 1개 이상
let bad = 0;
for (const p of puzzles) {
  const board = emptyBoard();
  for (const [r, c] of p.b) board[r][c] = 'B';
  for (const [r, c] of p.w) board[r][c] = 'W';
  if (p.solution.length === 0) { bad++; continue; }
  for (const [r, c] of p.solution) {
    if (board[r][c] !== null) { bad++; break; }
    if (!hasImmediate(board, r, c, 'B') && isForbidden(board, r, c, 'B')) { bad++; break; }
  }
}

const byDiff = { easy: 0, normal: 0, hard: 0 };
for (const p of puzzles) byDiff[p.difficulty]++;

console.log('');
console.log(`검사한 국면: ${scanned}`);
console.log(`생성된 퍼즐: ${puzzles.length}개  (easy ${byDiff.easy} / normal ${byDiff.normal} / hard ${byDiff.hard})`);
console.log(`검증 실패:   ${bad}개`);

if (DRY) {
  console.log('\n--dry: 파일을 쓰지 않았습니다.');
  console.log(JSON.stringify(puzzles.slice(0, 2), null, 2));
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ version: 1, puzzles }, null, 0));
  console.log(`\n저장: ${OUT}`);
}
