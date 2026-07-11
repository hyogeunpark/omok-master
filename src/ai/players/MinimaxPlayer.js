// docs/spec/ai-player.md §4-2 MinimaxPlayer (normal/hard)
import { BOARD_SIZE } from '../../engine/board.js';
import { scorePosition, getCandidates, hasImmediate } from '../evaluate.js';
import { isInOpeningZone, isCandidateDuplicate } from '../../engine/opening.js';
import { minimaxMove, minimaxMoveTT } from '../minimax.js';
import { vcfSearch } from '../vcf.js';

// 상대가 지금 당장 5목을 완성할 수 있는 자리가 있는가 (VCF 방어 우선 판정용)
function oppHasImmediateWin(board, color) {
  const opp = color === 'B' ? 'W' : 'B';
  return getCandidates(board, 2).some(({ row, col }) => hasImmediate(board, row, col, opp));
}

function randomEmpty(board) {
  const empty = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === null) empty.push({ row: r, col: c });
  return empty[Math.floor(Math.random() * empty.length)];
}

export class MinimaxPlayer {
  constructor({ depth, candidateLimit, defenseWeight = 1.0, vcf = false, tt = false, ext = 0, nodeBudget = Infinity }) {
    this._depth          = depth;
    this._candidateLimit = candidateLimit;
    this._defenseWeight  = defenseWeight;
    this._vcf            = vcf;
    this._tt             = tt;          // 트랜스포지션 테이블 + 반복심화 (docs/spec/ai.md §7-4)
    this._ext            = ext;         // 강제 수 탐색 연장 예산 (docs/spec/ai.md §7-5)
    this._nodeBudget     = nodeBudget;  // 최악 시간 캡 (docs/spec/ai.md §7-5)
  }

  // VCF 선행(hard) → Minimax. 단 상대 즉시-5 위협이 있으면 VCF 생략(docs/spec/ai.md §3-5-1 방어 우선).
  // onDepth: 반복심화 진행 콜백(선택, 워커에서 실시간 깊이 표시용 — docs/spec/ai-player.md §6-A).
  getMove(board, color, onDepth = null) {
    if (this._vcf && !oppHasImmediateWin(board, color)) {
      const vcfMove = vcfSearch(board.map(r => [...r]), color);
      if (vcfMove) return vcfMove;
    }
    return this._tt
      ? minimaxMoveTT(board, color, this._depth, this._candidateLimit, this._ext, this._nodeBudget, onDepth)
      : minimaxMove(board, color, this._depth, this._candidateLimit);
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
