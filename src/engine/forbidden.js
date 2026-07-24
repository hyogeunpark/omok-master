// Phase 2 — 렌주 금수 판정 (FR-6)
// 패턴 매칭 기반 구현 (docs/phase-2.md §6 단순 카운트 금지)
import { inBounds } from './board.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function countDir(board, r, c, color, dr, dc) {
  let n = 0, cr = r + dr, cc = c + dc;
  while (inBounds(cr, cc) && board[cr][cc] === color) { n++; cr += dr; cc += dc; }
  return n;
}

// 9-element sequence centered on (row,col) in direction (dr,dc)
// 'O'=our color, '_'=empty, 'X'=opponent/wall
function getSeq(board, row, col, color, dr, dc) {
  const seq = [];
  for (let i = -4; i <= 4; i++) {
    const r = row + i * dr, c = col + i * dc;
    if (!inBounds(r, c)) { seq.push('X'); continue; }
    const cell = board[r][c];
    seq.push(cell === color ? 'O' : cell === null ? '_' : 'X');
  }
  return seq; // seq[4] = center
}

// Window of 5 containing center (index 4) with exactly 4 O's and 1 empty, no X
function hasFourInSeq(seq) {
  for (let s = 0; s <= 4; s++) {
    const win = seq.slice(s, s + 5);
    if (win.includes('X')) continue;
    if (win.filter(x => x === 'O').length === 4 && win.filter(x => x === '_').length === 1) return true;
  }
  return false;
}

// Consecutive run of exactly 3 through center with both immediate ends open
function hasOpenThreeInSeq(seq) {
  let left = 0, right = 0;
  for (let i = 3; i >= 0; i--) { if (seq[i] === 'O') left++; else break; }
  for (let i = 5; i <= 8; i++) { if (seq[i] === 'O') right++; else break; }
  if (1 + left + right !== 3) return false;
  const leftEnd = 4 - left - 1;
  const rightEnd = 4 + right + 1;
  return leftEnd >= 0 && seq[leftEnd] === '_' && rightEnd <= 8 && seq[rightEnd] === '_';
}

export function getForbiddenType(board, row, col, color) {
  if (color !== 'B') return null;

  board[row][col] = color;

  // 우선순위 1: 정확히 5목 → 승리, 금수 아님
  for (const [dr, dc] of DIRS) {
    const run = 1 + countDir(board, row, col, color, dr, dc) + countDir(board, row, col, color, -dr, -dc);
    if (run === 5) { board[row][col] = null; return null; }
  }

  // 우선순위 2: 장목 (6목 이상)
  for (const [dr, dc] of DIRS) {
    const run = 1 + countDir(board, row, col, color, dr, dc) + countDir(board, row, col, color, -dr, -dc);
    if (run >= 6) { board[row][col] = null; return 'overline'; }
  }

  // 우선순위 3: 사사 (4가 2방향 이상)
  let fourCount = 0;
  for (const [dr, dc] of DIRS) {
    if (hasFourInSeq(getSeq(board, row, col, color, dr, dc))) fourCount++;
  }
  if (fourCount >= 2) { board[row][col] = null; return 'four-four'; }

  // 우선순위 4: 삼삼 (열린 3이 2방향 이상)
  let threeCount = 0;
  for (const [dr, dc] of DIRS) {
    if (hasOpenThreeInSeq(getSeq(board, row, col, color, dr, dc))) threeCount++;
  }
  if (threeCount >= 2) { board[row][col] = null; return 'three-three'; }

  board[row][col] = null;
  return null;
}

export function isForbidden(board, row, col, color) {
  return getForbiddenType(board, row, col, color) !== null;
}
