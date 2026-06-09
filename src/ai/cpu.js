// docs/spec/ai.md §2 난이도 정의 기반
import { BOARD_SIZE, inBounds } from '../engine/board.js';
import { scorePosition, doubleThreatBonus, getCandidates, hasImmediate } from './evaluate.js';
import { isForbidden } from '../engine/forbidden.js';
import { isInOpeningZone, isCandidateDuplicate } from '../engine/opening.js';
import { minimaxMove } from './minimax.js';

const PARAMS = {
  easy:   { radius: 1, attackWeight: 1.0, defenseWeight: 1.0, randomRate: 0.35, doubleThreat: false, depth: 0,  candidateLimit: 0  },
  normal: { radius: 2, attackWeight: 1.0, defenseWeight: 1.0, randomRate: 0,   doubleThreat: false, depth: 2,  candidateLimit: 10 },
  hard:   { radius: 2, attackWeight: 1.0, defenseWeight: 1.2, randomRate: 0,   doubleThreat: true,  depth: 4,  candidateLimit: 8  },
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

// 스왑 여부 결정: justPlayedColor의 포석이 강하면 스왑 (docs/spec/ai.md §5)
export function cpuShouldSwap(board, justPlayedColor, difficulty) {
  if (difficulty === 'easy') return false;
  let score = 0, stoneCount = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === justPlayedColor) {
        stoneCount++;
        board[r][c] = null;
        score += scorePosition(board, r, c, justPlayedColor, 1.0, 0);
        board[r][c] = justPlayedColor;
      }
    }
  }
  if (stoneCount === 0) return false;
  const perStoneThreshold = difficulty === 'hard' ? 22 : 26;
  return (score / stoneCount) > perStoneThreshold;
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

  // easy: 즉시 승리/차단 후 랜덤 (docs/spec/ai.md §2)
  if (difficulty === 'easy') {
    const candidates = getCandidates(board, p.radius).filter(({ row, col }) =>
      !isForbidden(board, row, col, color)
    );
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, color)) return { row, col };
    }
    for (const { row, col } of candidates) {
      if (hasImmediate(board, row, col, opp)) return { row, col };
    }
    if (Math.random() < p.randomRate) {
      // 보드 전체가 아닌 주변(반경 3) 에서만 랜덤 선택 (docs/spec/ai.md §2)
      const near = getCandidates(board, 3).filter(({ row, col }) =>
        !isForbidden(board, row, col, color)
      );
      if (near.length) return near[Math.floor(Math.random() * near.length)];
    }
    let best = null, bestScore = -Infinity;
    for (const { row, col } of candidates) {
      const score = scorePosition(board, row, col, color, p.attackWeight, p.defenseWeight);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best ?? randomEmpty(board);
  }

  // normal/hard: Minimax + Alpha-Beta (docs/spec/ai.md §7)
  return minimaxMove(board, color, p.depth, p.candidateLimit);
}
