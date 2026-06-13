// docs/spec/ai-player.md §4-1 HeuristicPlayer (easy)
import { BOARD_SIZE } from '../../engine/board.js';
import { scorePosition, getCandidates, hasImmediate } from '../evaluate.js';
import { isForbidden } from '../../engine/forbidden.js';
import { isInOpeningZone, isCandidateDuplicate } from '../../engine/opening.js';

const RADIUS      = 1;
const RANDOM_RATE = 0.35;

function randomEmpty(board) {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null) empty.push({ row: r, col: c });
  return empty[Math.floor(Math.random() * empty.length)];
}

export class HeuristicPlayer {
  // 즉시 승리 → 즉시 차단 → 35% 랜덤(반경 3) → 휴리스틱 최선
  getMove(board, color) {
    const opp = color === 'B' ? 'W' : 'B';
    const candidates = getCandidates(board, RADIUS).filter(({ row, col }) =>
      !isForbidden(board, row, col, color)
    );
    for (const { row, col } of candidates)
      if (hasImmediate(board, row, col, color)) return { row, col };
    for (const { row, col } of candidates)
      if (hasImmediate(board, row, col, opp)) return { row, col };

    if (Math.random() < RANDOM_RATE) {
      const near = getCandidates(board, 3).filter(({ row, col }) =>
        !isForbidden(board, row, col, color)
      );
      if (near.length) return near[Math.floor(Math.random() * near.length)];
    }
    let best = null, bestScore = -Infinity;
    for (const { row, col } of candidates) {
      const score = scorePosition(board, row, col, color, 1.0, 1.0);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best ?? randomEmpty(board);
  }

  getOpeningMove(board, color, step, branch) {
    const inZone = [];
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c] === null && isInOpeningZone(r, c, step, branch))
          inZone.push({ row: r, col: c });
    if (inZone.length === 0) return randomEmpty(board);
    let best = null, bestScore = -Infinity;
    for (const { row, col } of inZone) {
      const score = scorePosition(board, row, col, color, 1.0, 1.0);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best;
  }

  shouldSwap() { return false; }

  selectBranch() { return Math.random() < 0.5 ? 1 : 2; }

  proposeOpeningCandidates(board) {
    const allEmpty = [];
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c] === null) allEmpty.push({ row: r, col: c });

    const scored = allEmpty
      .map(({ row, col }) => ({ row, col, score: scorePosition(board, row, col, 'B', 1.0, 0) }))
      .sort((a, b) => b.score - a.score);

    const candidates = [];
    for (const { row, col } of scored) {
      if (candidates.length >= 10) break;
      if (!isCandidateDuplicate(candidates, row, col)) candidates.push({ row, col });
    }
    return candidates;
  }

  pickOpeningCandidate(board, candidates) {
    let best = candidates[0], bestScore = -Infinity;
    for (const { row, col } of candidates) {
      const score = scorePosition(board, row, col, 'W', 1.0, 1.0);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best;
  }
}
