// docs/ai.md §3 평가 함수 스펙 기반
import { BOARD_SIZE, inBounds } from '../engine/board.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function countDir(board, row, col, color, dr, dc) {
  let count = 0;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c] === color) {
    count++;
    r += dr; c += dc;
  }
  const open = inBounds(r, c) && board[r][c] === null;
  return { count, open };
}

// docs/ai.md §3-2 점수표
function patternScore(count, openEnds) {
  if (count >= 5) return 100000;
  if (count === 4) {
    if (openEnds === 2) return 10000;
    if (openEnds === 1) return 1000;
    return 0;
  }
  if (count === 3) {
    if (openEnds === 2) return 500;
    if (openEnds === 1) return 100;
    return 0;
  }
  if (count === 2) {
    if (openEnds === 2) return 50;
    if (openEnds === 1) return 10;
    return 0;
  }
  if (count === 1) {
    if (openEnds === 2) return 5;
    if (openEnds === 1) return 1;
  }
  return 0;
}

// docs/ai.md §3-3 centerBonus
function centerBonus(row, col) {
  const dr = row - 7, dc = col - 7;
  return Math.max(0, 8 - Math.sqrt(dr * dr + dc * dc));
}

// 특정 색 기준 한 방향의 패턴 점수 — board를 임시 변형 후 복원
function dirScore(board, row, col, color, dr, dc) {
  const pos = countDir(board, row, col, color, dr, dc);
  const neg = countDir(board, row, col, color, -dr, -dc);
  const count = 1 + pos.count + neg.count;
  const openEnds = (pos.open ? 1 : 0) + (neg.open ? 1 : 0);
  return patternScore(count, openEnds);
}

// docs/ai.md §3-3: 공격/방어 점수 합산
// attackWeight, defenseWeight는 호출부에서 docs/ai.md §2-1 파라미터 주입
export function scorePosition(board, row, col, color, attackWeight = 1.0, defenseWeight = 1.0) {
  const opp = color === 'B' ? 'W' : 'B';
  let score = 0;

  board[row][col] = color;
  for (const [dr, dc] of DIRS) score += dirScore(board, row, col, color, dr, dc) * attackWeight;
  board[row][col] = null;

  board[row][col] = opp;
  for (const [dr, dc] of DIRS) score += dirScore(board, row, col, opp, dr, dc) * defenseWeight;
  board[row][col] = null;

  score += centerBonus(row, col);
  return score;
}

// docs/ai.md §3-4 이중 위협 보너스 (hard 전용)
export function doubleThreatBonus(board, row, col, color) {
  const threshold = 1000; // 4점 이상 패턴 기준
  let threatDirs = 0;

  board[row][col] = color;
  for (const [dr, dc] of DIRS) {
    if (dirScore(board, row, col, color, dr, dc) >= threshold) threatDirs++;
  }
  board[row][col] = null;

  return threatDirs >= 2 ? 5000 : 0;
}

// 후보 셀: 기존 돌 주변 radius 이내 빈 교점 (docs/ai.md §1)
export function getCandidates(board, radius) {
  const candidates = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && board[nr][nc] === null) {
            candidates.add(nr * BOARD_SIZE + nc);
          }
        }
      }
    }
  }
  if (candidates.size === 0) candidates.add(7 * BOARD_SIZE + 7); // 빈 보드 → 중앙
  return Array.from(candidates).map(k => ({ row: Math.floor(k / BOARD_SIZE), col: k % BOARD_SIZE }));
}
