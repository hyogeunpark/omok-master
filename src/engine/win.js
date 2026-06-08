import { inBounds } from './board.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function countDir(board, row, col, color, dr, dc) {
  let count = 0;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c] === color) {
    count++;
    r += dr; c += dc;
  }
  return count;
}

// Phase 1: 5목 이상이면 승리 (장목 포함)
export function checkWin(board, row, col, color) {
  for (const [dr, dc] of DIRS) {
    const len = 1 + countDir(board, row, col, color, dr, dc) + countDir(board, row, col, color, -dr, -dc);
    if (len >= 5) return true;
  }
  return false;
}

export function checkDraw(board) {
  return board.every(row => row.every(cell => cell !== null));
}

export function getWinningLine(board, row, col, color) {
  for (const [dr, dc] of DIRS) {
    const line = [{ row, col }];
    for (const [sr, sc] of [[dr, dc], [-dr, -dc]]) {
      let r = row + sr, c = col + sc;
      while (inBounds(r, c) && board[r][c] === color) {
        line.push({ row: r, col: c });
        r += sr; c += sc;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}
