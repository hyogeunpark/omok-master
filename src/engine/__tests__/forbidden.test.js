// Phase 2 완료 기준: 렌주 금수 판정 (FR-6)
// 구현 위치: src/engine/forbidden.js
// 주의: 단순 카운트 금지 — 패턴 매칭 기반으로 구현할 것 (docs/phase-2.md §6)
import { describe, it, expect } from 'vitest';
import { isForbidden, getForbiddenType } from '../forbidden.js';

function emptyBoard() {
  return Array.from({ length: 15 }, () => Array(15).fill(null));
}

function place(board, stones) {
  stones.forEach(([r, c, color]) => { board[r][c] = color; });
  return board;
}

// ─── 판정 우선순위: 5목이면 금수 아님 ────────────────────────────────────────
describe('5목 우선 — 3-3/4-4여도 5목이면 금수 아님 (phase-2.md §2 우선순위 1)', () => {
  it('5목 완성 수는 형식상 3-3이어도 금수가 아님', () => {
    // 흑이 놓으면 5목이 완성되는 자리 (3-3 형태가 겹쳐도)
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], // 가로 4개
      [5, 5, 'B'], [6, 5, 'B'], [8, 5, 'B'],               // 세로 쪽 3개 (열린3)
    ]);
    // [7,7]에 놓으면 가로 5목 완성 — 금수 아님
    expect(isForbidden(board, 7, 7, 'B')).toBe(false);
  });
});

// ─── 장목 (6목 이상) ─────────────────────────────────────────────────────────
describe('장목 금수 (phase-2.md §2)', () => {
  it('흑이 6목을 만드는 수는 금수', () => {
    const board = place(emptyBoard(), [
      [7, 2, 'B'], [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'],
    ]);
    expect(isForbidden(board, 7, 7, 'B')).toBe(true);
    expect(getForbiddenType(board, 7, 7, 'B')).toBe('overline');
  });

  it('백은 6목도 금수 아님', () => {
    const board = place(emptyBoard(), [
      [7, 2, 'W'], [7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'], [7, 6, 'W'],
    ]);
    expect(isForbidden(board, 7, 7, 'W')).toBe(false);
  });
});

// ─── 삼삼 (3-3) ──────────────────────────────────────────────────────────────
describe('삼삼 금수 (phase-2.md §2)', () => {
  it('한 수로 열린 3을 2개 만들면 금수', () => {
    // 가로 열린3: _ B B _ (중간에 놓으면 열린3)
    // 세로 열린3: 같은 교점에서 세로로도 열린3
    const board = place(emptyBoard(), [
      [7, 5, 'B'], [7, 6, 'B'],  // 가로 2개
      [5, 7, 'B'], [6, 7, 'B'],  // 세로 2개
    ]);
    // [7,7]에 놓으면 가로 열린3 + 세로 열린3 → 삼삼
    expect(isForbidden(board, 7, 7, 'B')).toBe(true);
    expect(getForbiddenType(board, 7, 7, 'B')).toBe('three-three');
  });

  it('백은 삼삼 금수 없음', () => {
    const board = place(emptyBoard(), [
      [7, 5, 'W'], [7, 6, 'W'],
      [5, 7, 'W'], [6, 7, 'W'],
    ]);
    expect(isForbidden(board, 7, 7, 'W')).toBe(false);
  });
});

// ─── 사사 (4-4) ──────────────────────────────────────────────────────────────
describe('사사 금수 (phase-2.md §2)', () => {
  it('한 수로 4를 2개 만들면 금수', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'],  // 가로 3개
      [4, 7, 'B'], [5, 7, 'B'], [6, 7, 'B'],  // 세로 3개
    ]);
    // [7,7]에 놓으면 가로 4 + 세로 4 → 사사
    expect(isForbidden(board, 7, 7, 'B')).toBe(true);
    expect(getForbiddenType(board, 7, 7, 'B')).toBe('four-four');
  });

  it('백은 사사 금수 없음', () => {
    const board = place(emptyBoard(), [
      [7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'],
      [4, 7, 'W'], [5, 7, 'W'], [6, 7, 'W'],
    ]);
    expect(isForbidden(board, 7, 7, 'W')).toBe(false);
  });
});

// ─── 빈 칸은 금수 아님 ───────────────────────────────────────────────────────
describe('정상 착수', () => {
  it('아무 돌도 없는 자리는 금수 아님', () => {
    expect(isForbidden(emptyBoard(), 7, 7, 'B')).toBe(false);
  });
});
