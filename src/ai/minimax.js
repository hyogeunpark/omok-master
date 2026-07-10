// docs/spec/ai.md §7 Minimax (Negamax + Alpha-Beta)
import { isForbidden } from '../engine/forbidden.js';
import { checkWin } from '../engine/win.js';
import { BOARD_SIZE } from '../engine/board.js';
import { getCandidates, evaluateBoard, hasImmediate, scorePosition } from './evaluate.js';

const WIN_SCORE = 100000;

// docs/spec/ai.md §7-2: 수 정렬 — 즉시 승리 → 즉시 차단 → 휴리스틱 상위 limit개
function getOrderedCandidates(board, color, limit) {
  const opp = color === 'B' ? 'W' : 'B';
  const all = getCandidates(board, 2);

  const wins = [], blocks = [], rest = [];
  for (const { row, col } of all) {
    if (isForbidden(board, row, col, color)) continue;
    if (hasImmediate(board, row, col, color)) wins.push({ row, col });
    else if (hasImmediate(board, row, col, opp)) blocks.push({ row, col });
    else rest.push({ row, col, score: scorePosition(board, row, col, color, 1.0, 1.0) });
  }

  rest.sort((a, b) => b.score - a.score);
  const cap = Math.max(0, limit - wins.length - blocks.length);
  return [...wins, ...blocks, ...rest.slice(0, cap)];
}

// Negamax with alpha-beta pruning — returns score from `color`'s perspective
function alphabeta(board, depth, alpha, beta, color, limit) {
  if (depth === 0) return evaluateBoard(board, color);

  const opp = color === 'B' ? 'W' : 'B';
  const candidates = getOrderedCandidates(board, color, limit);
  if (candidates.length === 0) return 0;

  let best = -Infinity;
  for (const { row, col } of candidates) {
    board[row][col] = color;
    const score = checkWin(board, row, col, color)
      ? WIN_SCORE + depth
      : -alphabeta(board, depth - 1, -beta, -alpha, opp, limit);
    board[row][col] = null;

    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// 최선 수 반환 (docs/spec/ai.md §7-1)
export function minimaxMove(board, color, depth, candidateLimit) {
  const candidates = getOrderedCandidates(board, color, candidateLimit);
  if (candidates.length === 0) return { row: 7, col: 7 };

  // 즉시 승리 수가 있으면 바로 반환
  const opp = color === 'B' ? 'W' : 'B';
  for (const { row, col } of candidates) {
    if (hasImmediate(board, row, col, color)) return { row, col };
  }

  let best = null, bestScore = -Infinity;
  for (const { row, col } of candidates) {
    board[row][col] = color;
    const score = -alphabeta(board, depth - 1, -Infinity, Infinity, opp, candidateLimit);
    board[row][col] = null;
    if (score > bestScore) { bestScore = score; best = { row, col }; }
  }
  return best ?? candidates[0];
}

// ── 트랜스포지션 테이블 + 반복심화 (docs/spec/ai.md §7-4) ────────────────────

// 시드 PRNG로 Zobrist 테이블 생성 (Math.random 미사용 → 재현 가능)
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _z = mulberry32(0x9e3779b9);
const _rand32 = () => (_z() * 0x100000000) | 0;
const N = BOARD_SIZE * BOARD_SIZE;
const Z1 = Array.from({ length: N }, () => [_rand32(), _rand32()]); // [idx][B|W]
const Z2 = Array.from({ length: N }, () => [_rand32(), _rand32()]);
const SIDE1 = _rand32();
const SIDE2 = _rand32();
const colorIdx = (color) => (color === 'B' ? 0 : 1);

// 국면 해시 (착수 색 side 반영). 증분 XOR과 동일 규약.
function hashBoard(board, color) {
  let h1 = 0, h2 = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      const v = board[r][c];
      if (v === null) continue;
      const idx = r * BOARD_SIZE + c, ci = colorIdx(v);
      h1 ^= Z1[idx][ci]; h2 ^= Z2[idx][ci];
    }
  if (color === 'W') { h1 ^= SIDE1; h2 ^= SIDE2; }
  return [h1, h2];
}

const EXACT = 0, LOWER = 1, UPPER = 2;

// TT 적용 Negamax (docs/spec/ai.md §7-4)
function alphabetaTT(board, depth, alpha, beta, color, limit, h1, h2, tt) {
  if (depth === 0) return evaluateBoard(board, color);

  const alphaOrig = alpha;
  const e = tt.get(h1);
  const hit = e && e.h2 === h2 && e.depth >= depth;
  if (hit) {
    if (e.flag === EXACT) return e.score;
    if (e.flag === LOWER) alpha = Math.max(alpha, e.score);
    else beta = Math.min(beta, e.score);
    if (alpha >= beta) return e.score;
  }

  const opp = color === 'B' ? 'W' : 'B';
  const candidates = getOrderedCandidates(board, color, limit);
  if (candidates.length === 0) return 0;

  // TT 저장 최선 수를 먼저 시도 (컷 향상)
  if (e && e.move) {
    const i = candidates.findIndex((c) => c.row === e.move.row && c.col === e.move.col);
    if (i > 0) { const [m] = candidates.splice(i, 1); candidates.unshift(m); }
  }

  let best = -Infinity, bestMove = null;
  for (const { row, col } of candidates) {
    board[row][col] = color;
    const idx = row * BOARD_SIZE + col, ci = colorIdx(color);
    const nh1 = h1 ^ Z1[idx][ci] ^ SIDE1;
    const nh2 = h2 ^ Z2[idx][ci] ^ SIDE2;
    const score = checkWin(board, row, col, color)
      ? WIN_SCORE + depth
      : -alphabetaTT(board, depth - 1, -beta, -alpha, opp, limit, nh1, nh2, tt);
    board[row][col] = null;

    if (score > best) { best = score; bestMove = { row, col }; }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  const flag = best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT;
  tt.set(h1, { h2, depth, score: best, flag, move: bestMove });
  return best;
}

// 반복심화 + TT 최선 수 (docs/spec/ai.md §7-4). depth 2→4→…→maxDepth
export function minimaxMoveTT(board, color, maxDepth, candidateLimit) {
  const rootCands = getOrderedCandidates(board, color, candidateLimit);
  if (rootCands.length === 0) return { row: 7, col: 7 };

  const opp = color === 'B' ? 'W' : 'B';
  for (const { row, col } of rootCands) {
    if (hasImmediate(board, row, col, color)) return { row, col };
  }

  const tt = new Map();
  let bestMove = rootCands[0];

  for (let d = 2; d <= maxDepth; d += 2) {
    const [rh1, rh2] = hashBoard(board, color);
    // 이전 깊이의 최선 수를 먼저
    const ordered = [bestMove, ...rootCands.filter((c) => !(c.row === bestMove.row && c.col === bestMove.col))];

    let best = -Infinity, bm = bestMove, alpha = -Infinity;
    for (const { row, col } of ordered) {
      board[row][col] = color;
      const idx = row * BOARD_SIZE + col, ci = colorIdx(color);
      const nh1 = rh1 ^ Z1[idx][ci] ^ SIDE1;
      const nh2 = rh2 ^ Z2[idx][ci] ^ SIDE2;
      const score = checkWin(board, row, col, color)
        ? WIN_SCORE + d
        : -alphabetaTT(board, d - 1, -Infinity, -alpha, opp, candidateLimit, nh1, nh2, tt);
      board[row][col] = null;
      if (score > best) { best = score; bm = { row, col }; }
      if (best > alpha) alpha = best;
    }
    bestMove = bm;
  }
  return bestMove;
}
