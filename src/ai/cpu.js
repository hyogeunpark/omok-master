// docs/ai.md §2 난이도 정의 기반
import { BOARD_SIZE, inBounds } from '../engine/board.js';
import { scorePosition, doubleThreatBonus, getCandidates } from './evaluate.js';
import { isForbidden } from '../engine/forbidden.js';
import { isInOpeningZone, isCandidateDuplicate } from '../engine/opening.js';

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

function randomEmptyInZone(board, step, branch) {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null && isInOpeningZone(r, c, step, branch))
        empty.push({ row: r, col: c });
  return empty.length ? empty[Math.floor(Math.random() * empty.length)] : randomEmpty(board);
}

function hasImmediate(board, row, col, color) {
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

// 오프닝 영역 내 최고점 수 선택
export function getCpuOpeningMove(board, color, step, branch, difficulty = 'normal') {
  const p = PARAMS[difficulty] ?? PARAMS.normal;
  const inZone = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null && isInOpeningZone(r, c, step, branch))
        inZone.push({ row: r, col: c });

  if (inZone.length === 0) return randomEmpty(board);

  let best = null, bestScore = -Infinity;
  for (const { row, col } of inZone) {
    const score = scorePosition(board, row, col, color, p.attackWeight, p.defenseWeight);
    if (score > bestScore) { bestScore = score; best = { row, col }; }
  }
  return best;
}

// 스왑 여부 결정: justPlayedColor의 포석이 강하면 스왑
export function cpuShouldSwap(board, justPlayedColor, difficulty) {
  // 보드 위 justPlayedColor 돌들의 위치 점수 합산
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === justPlayedColor) {
        board[r][c] = null;
        score += scorePosition(board, r, c, justPlayedColor, 1.0, 0);
        board[r][c] = justPlayedColor;
      }
    }
  }
  const threshold = difficulty === 'hard' ? 150 : 250;
  return score > threshold;
}

// 분기 선택 (선택1 vs 선택2): 현재 포석 강도에 따라 결정
// 포석이 약하면(상대 흑 위치 나쁨) 선택2로 후보 제어 시도
export function cpuSelectBranch(board, difficulty) {
  if (difficulty === 'easy') return Math.random() < 0.5 ? 1 : 2;
  // normal/hard: 보드 중앙 석점들 평가
  let blackScore = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === 'B') {
        board[r][c] = null;
        blackScore += scorePosition(board, r, c, 'B', 1.0, 0);
        board[r][c] = 'B';
      }
  return blackScore > 400 ? 2 : 1; // 흑이 강하면 선택2로 제어
}

// 선택2: 흑이 후보 10개 제시 (다양성을 위해 분산된 위치 선택)
export function cpuProposeOpeningCandidates(board, difficulty) {
  const candidates = [];
  const allEmpty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null) allEmpty.push({ row: r, col: c });

  // 점수 순 정렬 후 대칭 중복 없이 10개 선택
  const scored = allEmpty.map(({ row, col }) => ({
    row, col,
    score: scorePosition(board, row, col, 'B', 1.0, 0),
  })).sort((a, b) => b.score - a.score);

  for (const { row, col } of scored) {
    if (candidates.length >= 10) break;
    if (!isCandidateDuplicate(candidates, row, col)) {
      candidates.push({ row, col });
    }
  }
  return candidates;
}

// 선택2: 백이 후보 중 1개 선택 (evaluate.js 기준 최고점)
export function cpuPickOpeningCandidate(board, candidates, difficulty) {
  const p = PARAMS[difficulty] ?? PARAMS.normal;
  let best = candidates[0], bestScore = -Infinity;
  for (const { row, col } of candidates) {
    const score = scorePosition(board, row, col, 'W', p.attackWeight, p.defenseWeight);
    if (score > bestScore) { bestScore = score; best = { row, col }; }
  }
  return best;
}

export function getCpuMove(board, color, difficulty = 'normal') {
  const p = PARAMS[difficulty] ?? PARAMS.normal;
  const opp = color === 'B' ? 'W' : 'B';
  const candidates = getCandidates(board, p.radius).filter(({ row, col }) =>
    !isForbidden(board, row, col, color)
  );

  if (difficulty === 'easy') {
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, color)) return { row, col };
    }
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, opp)) return { row, col };
    }
    if (Math.random() < p.randomRate) return randomEmpty(board);
  }

  let best = null, bestScore = -Infinity;
  for (const { row, col } of candidates) {
    let score = scorePosition(board, row, col, color, p.attackWeight, p.defenseWeight);
    if (p.doubleThreat) score += doubleThreatBonus(board, row, col, color);
    if (score > bestScore) { bestScore = score; best = { row, col }; }
  }

  return best ?? randomEmpty(board);
}
