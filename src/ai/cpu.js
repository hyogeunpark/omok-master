// docs/ai.md §2 난이도 정의 기반
import { BOARD_SIZE, inBounds } from '../engine/board.js';
import { scorePosition, doubleThreatBonus, getCandidates } from './evaluate.js';
import { isForbidden } from '../engine/forbidden.js';

// docs/ai.md §2-1 난이도별 파라미터
const PARAMS = {
  easy:   { radius: 1, attackWeight: 1.0, defenseWeight: 1.0, randomRate: 0.7, doubleTheat: false },
  normal: { radius: 2, attackWeight: 1.0, defenseWeight: 1.0, randomRate: 0,   doubleTheat: false },
  hard:   { radius: 2, attackWeight: 1.0, defenseWeight: 1.2, randomRate: 0,   doubleThreat: true },
};

function randomEmpty(board) {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null) empty.push({ row: r, col: c });
  return empty[Math.floor(Math.random() * empty.length)];
}

function hasImmediate(board, row, col, color) {
  // 즉시 이기거나 막아야 하는 수 확인 (easy 전용)
  const { scorePosition: sp } = { scorePosition };
  board[row][col] = color;
  let win = false;
  const DIRS = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    for (const s of [1, -1]) {
      let r = row + dr * s, c = col + dc * s;
      while (inBounds(r, c) && board[r][c] === color) { cnt++; r += dr * s; c += dc * s; }
    }
    if (cnt >= 5) { win = true; break; }
  }
  board[row][col] = null;
  return win;
}

export function getCpuMove(board, color, difficulty = 'normal') {
  const p = PARAMS[difficulty] ?? PARAMS.normal;
  const opp = color === 'B' ? 'W' : 'B';
  // Phase 2: 흑일 때 금수 셀 제외
  const candidates = getCandidates(board, p.radius).filter(({ row, col }) =>
    !isForbidden(board, row, col, color)
  );

  // easy: 즉시 승리/차단 수를 먼저 찾고, 없으면 랜덤
  if (difficulty === 'easy') {
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, color)) return { row, col };
    }
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, opp)) return { row, col };
    }
    if (Math.random() < p.randomRate) return randomEmpty(board);
  }

  // normal / hard: 휴리스틱 최고점 셀 선택
  let best = null;
  let bestScore = -Infinity;

  for (const { row, col } of candidates) {
    let score = scorePosition(board, row, col, color, p.attackWeight, p.defenseWeight);
    if (p.doubleThreat) score += doubleThreatBonus(board, row, col, color);
    if (score > bestScore) { bestScore = score; best = { row, col }; }
  }

  return best ?? randomEmpty(board);
}
