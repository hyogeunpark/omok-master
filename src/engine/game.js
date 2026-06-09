import { emptyBoard } from './board.js';
import { checkWin, checkDraw, getWinningLine } from './win.js';
import { isForbidden } from './forbidden.js';
import { createOpeningState, isInOpeningZone } from './opening.js';

// FR-5: playerColor 미지정 시 무작위 배정
// useOpening=true → Phase 3 타라구치-10 오프닝 활성화
export function createGame({ playerColor, useOpening = true } = {}) {
  const assigned = playerColor ?? (Math.random() < 0.5 ? 'B' : 'W');
  return {
    board: emptyBoard(),
    currentTurn: 'B', // 흑 항상 선공
    playerColor: assigned,
    cpuColor: assigned === 'B' ? 'W' : 'B',
    status: 'playing', // 'playing' | 'black-wins' | 'white-wins' | 'draw'
    history: [],
    lastMove: null,
    winningLine: null,
    opening: useOpening ? createOpeningState() : null,
  };
}

// 오프닝 상태 전이: 착수 후 다음 phase/step으로
function advanceOpeningAfterPlace(opening) {
  const { step, branch } = opening;
  if (step <= 3) return { ...opening, phase: 'await-swap' };
  if (step === 4) return { ...opening, phase: 'await-branch' };
  if (step === 5 && branch === 1) return { ...opening, phase: 'await-swap' };
  if (step === 6) return null; // 오프닝 완료
  return null;
}

export function placeStone(game, row, col) {
  if (game.status !== 'playing') return game;
  if (game.board[row][col] !== null) return game;

  const color = game.currentTurn;

  // Phase 3: 오프닝 중 영역 제한
  if (game.opening?.phase === 'place') {
    if (!isInOpeningZone(row, col, game.opening.step, game.opening.branch)) return game;
  }

  // Phase 2: 흑 금수 → 반칙패 (오프닝 중에는 적용 안 함, phase-3.md §5-1)
  if (!game.opening && isForbidden(game.board, row, col, color)) {
    const board = game.board.map((r, ri) =>
      ri === row ? r.map((cell, ci) => (ci === col ? color : cell)) : r
    );
    return {
      ...game,
      board,
      history: [...game.history, { row, col, color }],
      lastMove: { row, col },
      status: 'white-wins',
      winningLine: null,
    };
  }

  const board = game.board.map((r, ri) =>
    ri === row ? r.map((cell, ci) => (ci === col ? color : cell)) : r
  );
  const history = [...game.history, { row, col, color }];
  const lastMove = { row, col };

  // 오프닝 상태 전이
  const newOpening = game.opening
    ? advanceOpeningAfterPlace(game.opening)
    : null;

  if (checkWin(board, row, col, color)) {
    return {
      ...game,
      board,
      history,
      lastMove,
      opening: newOpening,
      status: color === 'B' ? 'black-wins' : 'white-wins',
      winningLine: getWinningLine(board, row, col, color),
    };
  }

  if (checkDraw(board)) {
    return { ...game, board, history, lastMove, opening: newOpening, status: 'draw' };
  }

  return {
    ...game,
    board,
    history,
    lastMove,
    opening: newOpening,
    currentTurn: color === 'B' ? 'W' : 'B',
  };
}

// 스왑 시 phase/step 전이
function advanceOpeningAfterSwap(opening) {
  const { step, branch } = opening;
  // 1~3수 후 스왑: 다음 수로
  if (step <= 3) return { ...opening, step: step + 1, phase: 'place' };
  // 선택1 분기 후 5수 전 스왑 (after-branch1 swap)
  if (step === 4 && branch === 1) return { ...opening, step: 5, phase: 'place' };
  // 5수 후 스왑 (선택1)
  if (step === 5 && branch === 1) return { ...opening, step: 6, phase: 'place' };
  return opening;
}

// Phase 3: 스왑 수행 (오프닝 중 playerColor/cpuColor 교환)
export function performOpeningSwap(game) {
  if (!game.opening || game.opening.phase !== 'await-swap') return game;
  return {
    ...game,
    playerColor: game.cpuColor,
    cpuColor: game.playerColor,
    currentTurn: game.opening.step + 1 <= 6
      ? (game.opening.step + 1) % 2 === 1 ? 'B' : 'W'
      : game.currentTurn,
    opening: advanceOpeningAfterSwap(game.opening),
  };
}

// Phase 3: 스왑 패스
export function skipOpeningSwap(game) {
  if (!game.opening || game.opening.phase !== 'await-swap') return game;
  return { ...game, opening: advanceOpeningAfterSwap(game.opening) };
}

// Phase 3: 4수 후 분기 선택 (branch=1|2), White만 호출
export function selectOpeningBranch(game, branch) {
  if (!game.opening || game.opening.phase !== 'await-branch') return game;
  if (branch === 1) {
    // 선택1: 흑 스왑 기회
    return { ...game, opening: { ...game.opening, branch: 1, phase: 'await-swap' } };
  }
  // 선택2: 흑이 후보 10개 제시
  return { ...game, opening: { ...game.opening, branch: 2, phase: 'await-candidates', candidates: [] } };
}

// Phase 3: 선택2 — 후보 추가 (10개 되면 자동으로 await-candidate-pick)
export function addOpeningCandidate(game, row, col) {
  if (!game.opening || game.opening.phase !== 'await-candidates') return game;
  const { candidates } = game.opening;
  if (candidates.length >= 10) return game;
  if (game.board[row][col] !== null) return game;
  if (candidates.some(c => c.row === row && c.col === col)) return game;

  const newCandidates = [...candidates, { row, col }];
  const nextPhase = newCandidates.length === 10 ? 'await-candidate-pick' : 'await-candidates';
  return { ...game, opening: { ...game.opening, candidates: newCandidates, phase: nextPhase } };
}

// Phase 3: 선택2 — 백이 후보 중 하나 선택 → 흑 5수 확정, step 6
export function pickOpeningCandidate(game, row, col) {
  if (!game.opening || game.opening.phase !== 'await-candidate-pick') return game;
  const { candidates } = game.opening;
  if (!candidates.some(c => c.row === row && c.col === col)) return game;

  // 흑 돌을 선택한 위치에 놓음
  const board = game.board.map((r, ri) =>
    ri === row ? r.map((cell, ci) => (ci === col ? 'B' : cell)) : r
  );
  return {
    ...game,
    board,
    history: [...game.history, { row, col, color: 'B' }],
    lastMove: { row, col },
    currentTurn: 'W', // 백이 6수
    opening: { ...game.opening, step: 6, phase: 'place', candidates: [] },
  };
}

export function undoMove(game) {
  if (game.history.length === 0) return game;

  const history = [...game.history];
  const board = game.board.map(r => [...r]);

  // 플레이어 수가 제거될 때까지 pop
  while (history.length > 0) {
    const last = history.pop();
    board[last.row][last.col] = null;
    if (last.color === game.playerColor) break;
  }

  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  return {
    ...game,
    board,
    history,
    currentTurn: game.playerColor,
    status: 'playing',
    lastMove: lastEntry ? { row: lastEntry.row, col: lastEntry.col } : null,
    winningLine: null,
    // 오프닝 완료(null) 후에만 undo 가능 → opening은 null 유지
    opening: null,
  };
}
