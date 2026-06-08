import { emptyBoard } from './board.js';
import { checkWin, checkDraw, getWinningLine } from './win.js';

export function createGame({ playerColor = 'B' } = {}) {
  return {
    board: emptyBoard(),
    currentTurn: 'B', // 흑 항상 선공
    playerColor,
    cpuColor: playerColor === 'B' ? 'W' : 'B',
    status: 'playing', // 'playing' | 'black-wins' | 'white-wins' | 'draw'
    history: [],
    lastMove: null,
    winningLine: null,
  };
}

export function placeStone(game, row, col) {
  if (game.status !== 'playing') return game;
  if (game.board[row][col] !== null) return game;

  const color = game.currentTurn;
  const board = game.board.map((r, ri) =>
    ri === row ? r.map((cell, ci) => (ci === col ? color : cell)) : r
  );
  const history = [...game.history, { row, col, color }];
  const lastMove = { row, col };

  if (checkWin(board, row, col, color)) {
    return {
      ...game,
      board,
      history,
      lastMove,
      status: color === 'B' ? 'black-wins' : 'white-wins',
      winningLine: getWinningLine(board, row, col, color),
    };
  }

  if (checkDraw(board)) {
    return { ...game, board, history, lastMove, status: 'draw' };
  }

  return {
    ...game,
    board,
    history,
    lastMove,
    currentTurn: color === 'B' ? 'W' : 'B',
  };
}

export function undoMove(game) {
  if (game.history.length === 0) return game;

  const history = [...game.history];
  const board = game.board.map(r => [...r]);

  // 플레이어 수가 제거될 때까지 pop (CPU 응수 → 플레이어 수 순서로 제거)
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
  };
}
