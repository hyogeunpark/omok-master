// Phase 1 완료 기준: 승리·무승부 판정 (FR-2)
// 구현 위치: src/engine/win.js
import { describe, it, expect } from 'vitest';
import { checkWin, checkDraw } from '../win.js';

// 빈 15×15 보드 생성 헬퍼
function emptyBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

// board[row][col]에 돌을 놓는 헬퍼
function place(board, stones) {
  stones.forEach(([r, c, color]) => {
    board[r][c] = color;
  });
  return board;
}

describe('checkWin — 가로 5목', () => {
  it('가로로 정확히 5목이면 승리', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 7, 'B'],
    ]);
    expect(checkWin(board, 7, 7, 'B')).toBe(true);
  });
});

describe('checkWin — 세로 5목', () => {
  it('세로로 정확히 5목이면 승리', () => {
    const board = place(emptyBoard(), [
      [3, 7, 'W'], [4, 7, 'W'], [5, 7, 'W'], [6, 7, 'W'], [7, 7, 'W'],
    ]);
    expect(checkWin(board, 7, 7, 'W')).toBe(true);
  });
});

describe('checkWin — 대각선 5목', () => {
  it('우하향 대각선 5목이면 승리', () => {
    const board = place(emptyBoard(), [
      [3, 3, 'B'], [4, 4, 'B'], [5, 5, 'B'], [6, 6, 'B'], [7, 7, 'B'],
    ]);
    expect(checkWin(board, 7, 7, 'B')).toBe(true);
  });

  it('우상향 대각선 5목이면 승리', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [6, 4, 'B'], [5, 5, 'B'], [4, 6, 'B'], [3, 7, 'B'],
    ]);
    expect(checkWin(board, 3, 7, 'B')).toBe(true);
  });
});

describe('checkWin — Phase 1 장목 규칙', () => {
  it('Phase 1에서 6목도 승리로 인정', () => {
    const board = place(emptyBoard(), [
      [7, 2, 'B'], [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 7, 'B'],
    ]);
    expect(checkWin(board, 7, 7, 'B')).toBe(true);
  });
});

describe('checkWin — 미완성 상태', () => {
  it('4목은 승리가 아님', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'],
    ]);
    expect(checkWin(board, 7, 6, 'B')).toBe(false);
  });

  it('끊긴 5목은 승리가 아님', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'W'], [7, 6, 'B'], [7, 7, 'B'],
    ]);
    expect(checkWin(board, 7, 7, 'B')).toBe(false);
  });
});

describe('checkDraw — 무승부', () => {
  it('보드가 가득 찼을 때 무승부', () => {
    // 모든 칸을 채우되 승자 없는 보드
    const board = Array.from({ length: 15 }, (_, r) =>
      Array.from({ length: 15 }, (_, c) => ((r + c) % 2 === 0 ? 'B' : 'W'))
    );
    expect(checkDraw(board)).toBe(true);
  });

  it('빈 칸이 있으면 무승부 아님', () => {
    expect(checkDraw(emptyBoard())).toBe(false);
  });
});
