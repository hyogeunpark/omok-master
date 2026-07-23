// docs/spec/ai.md §7 Minimax (Negamax + Alpha-Beta)
import { isForbidden } from '../engine/forbidden.js';
import { checkWin } from '../engine/win.js';
import { BOARD_SIZE, inBounds } from '../engine/board.js';
import { getCandidates, evaluateBoard, hasImmediate, scorePosition } from './evaluate.js';

const WIN_SCORE = 100000;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

// (row,col)에 color를 두면 '4(열린/닫힌)'가 생기는가 = 상대를 강제하는 수 (docs/spec/ai.md §7-5)
function makesFour(board, row, col, color) {
  board[row][col] = color;
  let four = false;
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && board[r][c] === color) { cnt++; r += dr; c += dc; }
    const openP = inBounds(r, c) && board[r][c] === null;
    r = row - dr; c = col - dc;
    while (inBounds(r, c) && board[r][c] === color) { cnt++; r -= dr; c -= dc; }
    const openN = inBounds(r, c) && board[r][c] === null;
    if (cnt === 4 && (openP || openN)) { four = true; break; }
  }
  board[row][col] = null;
  return four;
}

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

// §7-6 최선점과의 차 margin 이내 수들 중 랜덤 (margin=0이면 최고점 첫 수 = 결정적)
function pickAmongBest(scored, margin) {
  let best = -Infinity;
  for (const s of scored) if (s.score > best) best = s.score;
  if (margin <= 0) {
    for (const s of scored) if (s.score === best) return { row: s.row, col: s.col };
  }
  const pool = scored.filter((s) => s.score >= best - margin);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { row: pick.row, col: pick.col };
}

// 최선 수 반환 (docs/spec/ai.md §7-1). margin>0이면 최선점 근처 수 중 랜덤(§7-6)
export function minimaxMove(board, color, depth, candidateLimit, margin = 0) {
  const candidates = getOrderedCandidates(board, color, candidateLimit);
  if (candidates.length === 0) return { row: 7, col: 7 };

  // 즉시 승리 수가 있으면 바로 반환 (랜덤 이전)
  const opp = color === 'B' ? 'W' : 'B';
  for (const { row, col } of candidates) {
    if (hasImmediate(board, row, col, color)) return { row, col };
  }

  const scored = [];
  for (const { row, col } of candidates) {
    board[row][col] = color;
    const score = -alphabeta(board, depth - 1, -Infinity, Infinity, opp, candidateLimit);
    board[row][col] = null;
    scored.push({ row, col, score });
  }
  if (scored.length === 0) return candidates[0];
  return pickAmongBest(scored, margin);
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

// TT 적용 Negamax + 강제 수 연장 (docs/spec/ai.md §7-4, §7-5)
// ctx = { nodes, budget, aborted } — node 예산 초과 시 중단(우아한 폴백)
function alphabetaTT(board, depth, alpha, beta, color, limit, h1, h2, tt, ext, ctx) {
  if (++ctx.nodes > ctx.budget) ctx.aborted = true;
  if (ctx.aborted) return 0; // 중단: 반환값은 폴백에서 폐기됨
  if (depth <= 0) return evaluateBoard(board, color);

  const alphaOrig = alpha;
  const e = tt.get(h1);
  const hit = e && e.h2 === h2 && e.depth >= depth && e.ext >= ext;
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
    // §7-5 강제 수(4 생성)이면 depth를 안 깎고 연장 (예산 ext 소비)
    const forcing = ext > 0 && makesFour(board, row, col, color);
    board[row][col] = color;
    const idx = row * BOARD_SIZE + col, ci = colorIdx(color);
    const nh1 = h1 ^ Z1[idx][ci] ^ SIDE1;
    const nh2 = h2 ^ Z2[idx][ci] ^ SIDE2;
    const score = checkWin(board, row, col, color)
      ? WIN_SCORE + depth
      : -alphabetaTT(board, forcing ? depth : depth - 1, -beta, -alpha, opp, limit, nh1, nh2, tt, forcing ? ext - 1 : ext, ctx);
    board[row][col] = null; // 항상 복구 (중단 시에도 board 무손상)
    if (ctx.aborted) return best;

    if (score > best) { best = score; bestMove = { row, col }; }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }

  const flag = best <= alphaOrig ? UPPER : best >= beta ? LOWER : EXACT;
  tt.set(h1, { h2, depth, ext, score: best, flag, move: bestMove });
  return best;
}

// 반복심화 + TT 최선 수 (docs/spec/ai.md §7-4).
// extBudget>0: 강제 수 연장(§7-5). nodeBudget: 최악 시간 캡. onDepth: 진행 콜백(§6-A). margin>0: 최선점 근처 랜덤(§7-6).
export function minimaxMoveTT(board, color, maxDepth, candidateLimit, extBudget = 0, nodeBudget = Infinity, onDepth = null, margin = 0) {
  const rootCands = getOrderedCandidates(board, color, candidateLimit);
  if (rootCands.length === 0) return { row: 7, col: 7 };

  const opp = color === 'B' ? 'W' : 'B';
  for (const { row, col } of rootCands) {
    if (hasImmediate(board, row, col, color)) return { row, col };
  }

  const tt = new Map();
  const ctx = { nodes: 0, budget: nodeBudget, aborted: false };
  let bestMove = rootCands[0];

  for (let d = 2; d <= maxDepth; d += 2) {
    const [rh1, rh2] = hashBoard(board, color);
    // 이전 깊이의 최선 수를 먼저
    const ordered = [bestMove, ...rootCands.filter((c) => !(c.row === bestMove.row && c.col === bestMove.col))];

    let best = -Infinity, bm = bestMove, alpha = -Infinity;
    for (const { row, col } of ordered) {
      const forcing = extBudget > 0 && makesFour(board, row, col, color);
      board[row][col] = color;
      const idx = row * BOARD_SIZE + col, ci = colorIdx(color);
      const nh1 = rh1 ^ Z1[idx][ci] ^ SIDE1;
      const nh2 = rh2 ^ Z2[idx][ci] ^ SIDE2;
      const score = checkWin(board, row, col, color)
        ? WIN_SCORE + d
        : -alphabetaTT(board, forcing ? d : d - 1, -Infinity, -alpha, opp, candidateLimit, nh1, nh2, tt, forcing ? extBudget - 1 : extBudget, ctx);
      board[row][col] = null;
      if (ctx.aborted) break;
      if (score > best) { best = score; bm = { row, col }; }
      if (best > alpha) alpha = best;
    }
    if (ctx.aborted) break; // 이 깊이 미완 → 직전 깊이의 bestMove 유지
    bestMove = bm;
    if (onDepth) onDepth(d); // 반복심화 진행 보고 (docs/spec/ai-player.md §6-A-2)
  }

  // §7-6 랜덤: 최종 깊이 루트를 전체 창으로 재평가(warm TT라 저렴)해 정확 점수 확보 후 근처 랜덤.
  // 예산 초과 등으로 못 하면 결정적 bestMove 폴백.
  if (margin > 0) {
    const [rh1, rh2] = hashBoard(board, color);
    const ctx2 = { nodes: 0, budget: nodeBudget, aborted: false };
    const scored = [];
    for (const { row, col } of rootCands) {
      const forcing = extBudget > 0 && makesFour(board, row, col, color);
      board[row][col] = color;
      const idx = row * BOARD_SIZE + col, ci = colorIdx(color);
      const nh1 = rh1 ^ Z1[idx][ci] ^ SIDE1;
      const nh2 = rh2 ^ Z2[idx][ci] ^ SIDE2;
      const score = checkWin(board, row, col, color)
        ? WIN_SCORE + maxDepth
        : -alphabetaTT(board, forcing ? maxDepth : maxDepth - 1, -Infinity, Infinity, opp, candidateLimit, nh1, nh2, tt, forcing ? extBudget - 1 : extBudget, ctx2);
      board[row][col] = null;
      if (ctx2.aborted) break;
      scored.push({ row, col, score });
    }
    if (!ctx2.aborted && scored.length > 0) return pickAmongBest(scored, margin);
  }
  return bestMove;
}
