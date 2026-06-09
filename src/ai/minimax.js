// docs/spec/ai.md §7 Minimax (Negamax + Alpha-Beta)
import { isForbidden } from '../engine/forbidden.js';
import { checkWin } from '../engine/win.js';
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
