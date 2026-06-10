// docs/spec/ai.md §3-5 VCF 탐색
import { inBounds } from '../engine/board.js';
import { getCandidates, hasImmediate } from './evaluate.js';
import { isForbidden } from '../engine/forbidden.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function countDir(board, row, col, color, dr, dc) {
  let count = 0;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c] === color) { count++; r += dr; c += dc; }
  const open = inBounds(r, c) && board[r][c] === null;
  return { count, open };
}

// 착수 시 4-in-a-row(열린/닫힌) 위협이 생기는지
function createsFourThreat(board, row, col, color) {
  board[row][col] = color;
  let result = false;
  for (const [dr, dc] of DIRS) {
    const pos = countDir(board, row, col, color, dr, dc);
    const neg = countDir(board, row, col, color, -dr, -dc);
    const count = 1 + pos.count + neg.count;
    if (count === 4 && (pos.open || neg.open)) { result = true; break; }
  }
  board[row][col] = null;
  return result;
}

// color 기준 지금 당장 5목이 되는 빈 자리들 (상대 강제 응수 후보)
function getWinThreats(board, color) {
  return getCandidates(board, 2).filter(({ row, col }) => hasImmediate(board, row, col, color));
}

// VCF 탐색 — docs/spec/ai.md §3-5-2
export function vcfSearch(board, color, maxDepth = 10) {
  const opp = color === 'B' ? 'W' : 'B';

  // 즉시 이기는 수 있으면 바로 반환
  const immediate = getWinThreats(board, color);
  if (immediate.length > 0) return immediate[0];

  if (maxDepth <= 0) return null;

  const candidates = getCandidates(board, 2);

  for (const { row, col } of candidates) {
    if (color === 'B' && isForbidden(board, row, col, 'B')) continue;
    if (!createsFourThreat(board, row, col, color)) continue;

    board[row][col] = color;

    const forcedBlocks = getWinThreats(board, color);

    // 막을 곳 없거나 동시에 두 곳 → 상대가 막을 수 없음
    if (forcedBlocks.length === 0 || forcedBlocks.length >= 2) {
      board[row][col] = null;
      return { row, col };
    }

    // 상대 강제 응수 후 재귀
    const { row: br, col: bc } = forcedBlocks[0];
    board[br][bc] = opp;

    const result = vcfSearch(board, color, maxDepth - 2);

    board[br][bc] = null;
    board[row][col] = null;

    if (result !== null) return { row, col };
  }

  return null;
}
