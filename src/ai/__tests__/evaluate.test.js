import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { evaluateBoard } from '../evaluate.js';

// ── AC-E1: 연속 패턴 기준점 ──────────────────────────────────────────────────
// 개선 전후 비교를 위한 기준값. BBB open-3 = ~1500pts 수준.
describe('evaluateBoard — 연속 패턴 기준', () => {
  it('BBB open-3 (7,5)(7,6)(7,7) 는 500pts 이상이어야 한다', () => {
    const board = emptyBoard();
    board[7][5] = board[7][6] = board[7][7] = 'B';
    const score = evaluateBoard(board, 'B');
    expect(score).toBeGreaterThan(500);
  });
});

// ── AC-E2: 점프 패턴 — evaluateBoard 과소평가 (현재 버그) ─────────────────────
// B_BB: 갭 하나를 채우면 열린 4(open-4)가 된다.
// 실제 위협 수준: open-3과 동급이어야 한다.
// 현재 evaluateBoard 는 B_BB 를 ~165pts(개별 돌 합산)로 계산 → open-3 기준(500+)에 크게 못 미침.
describe('evaluateBoard — 점프 패턴 과소평가 (개선 전 실패 예상)', () => {
  it('B_BB (7,3)(7,5)(7,6) 는 open-3 수준(500pts 이상)이어야 한다', () => {
    const board = emptyBoard();
    board[7][3] = board[7][5] = board[7][6] = 'B';
    // 갭 (7,4) 을 채우면 BBBB open-4 → 1수 후 승리
    const score = evaluateBoard(board, 'B');
    expect(score).toBeGreaterThan(500);
  });

  it('BB_B (7,5)(7,6)(7,8) 는 open-3 수준(500pts 이상)이어야 한다', () => {
    const board = emptyBoard();
    board[7][5] = board[7][6] = board[7][8] = 'B';
    // 갭 (7,7) 을 채우면 BBBB open-4
    const score = evaluateBoard(board, 'B');
    expect(score).toBeGreaterThan(500);
  });

  it('W_WW (7,3)(7,5)(7,6) 는 W 기준 500pts 이상이어야 한다', () => {
    const board = emptyBoard();
    board[7][3] = board[7][5] = board[7][6] = 'W';
    const score = evaluateBoard(board, 'W');
    expect(score).toBeGreaterThan(500);
  });

  it('대각선 B_BB (5,5)(7,7)(8,8) 는 500pts 이상이어야 한다', () => {
    const board = emptyBoard();
    board[5][5] = board[7][7] = board[8][8] = 'B';
    // 갭 (6,6) 을 채우면 BBBB
    const score = evaluateBoard(board, 'B');
    expect(score).toBeGreaterThan(500);
  });
});

// ── AC-E3: 점프 패턴 점수 ≥ 단순 쌍(BB) ─────────────────────────────────────
// B_BB 위협이 단순 BB 쌍보다 훨씬 높게 평가돼야 한다.
describe('evaluateBoard — 점프 패턴 > 단순 쌍', () => {
  it('B_BB 는 BB 단순 쌍보다 3배 이상 높아야 한다', () => {
    const board1 = emptyBoard();
    board1[7][3] = board1[7][5] = board1[7][6] = 'B'; // B_BB

    const board2 = emptyBoard();
    board2[7][5] = board2[7][6] = 'B'; // BB

    const jumpScore = evaluateBoard(board1, 'B');
    const pairScore = evaluateBoard(board2, 'B');

    // B_BB 는 BB 의 3배 이상 위협적이어야 함
    expect(jumpScore).toBeGreaterThan(pairScore * 3);
  });
});
