// docs/spec/ai-player.md §4-2 MinimaxPlayer (normal/hard)
import { BOARD_SIZE } from '../../engine/board.js';
import { scorePosition, getCandidates } from '../evaluate.js';
import { isInOpeningZone, isCandidateDuplicate } from '../../engine/opening.js';
import { minimaxMove } from '../minimax.js';
import { vcfSearch } from '../vcf.js';

function randomEmpty(board) {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null) empty.push({ row: r, col: c });
  return empty[Math.floor(Math.random() * empty.length)];
}

export class MinimaxPlayer {
  constructor({ depth, candidateLimit, defenseWeight = 1.0, vcf = false }) {
    this._depth          = depth;
    this._candidateLimit = candidateLimit;
    this._defenseWeight  = defenseWeight;
    this._vcf            = vcf;
  }

  // VCF 선행(hard) → Minimax
  getMove(board, color) {
    if (this._vcf) {
      const vcfMove = vcfSearch(board.map(r => [...r]), color);
      if (vcfMove) return vcfMove;
    }
    return minimaxMove(board, color, this._depth, this._candidateLimit);
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
      const score = scorePosition(board, row, col, color, 1.0, this._defenseWeight);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best;
  }

  // docs/spec/ai.md §5 스왑 판단 — 돌당 평균 점수 vs threshold
  shouldSwap(board, justPlayedColor) {
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
    const threshold = this._depth >= 4 ? 22 : 26;
    return (score / stoneCount) > threshold;
  }

  selectBranch(board) {
    let blackScore = 0;
    for (let r = 0; r < BOARD_SIZE; r++)
      for (let c = 0; c < BOARD_SIZE; c++)
        if (board[r][c] === 'B') {
          board[r][c] = null;
          blackScore += scorePosition(board, r, c, 'B', 1.0, 0);
          board[r][c] = 'B';
        }
    return blackScore > 400 ? 2 : 1;
  }

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
      const score = scorePosition(board, row, col, 'W', 1.0, this._defenseWeight);
      if (score > bestScore) { bestScore = score; best = { row, col }; }
    }
    return best;
  }
}
