import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { minimaxMove } from '../minimax.js';

// AC-1: 즉시 승리 수 (흑 4연속 → 5목 완성)
describe('minimaxMove — 즉시 승리', () => {
  it('4-in-a-row 완성 수를 선택한다', () => {
    const board = emptyBoard();
    // B: (7,3),(7,4),(7,5),(7,6) — (7,2) 또는 (7,7)이 승리
    board[7][3] = board[7][4] = board[7][5] = board[7][6] = 'B';
    const move = minimaxMove(board, 'B', 2, 10);
    expect(move.row).toBe(7);
    expect(move.col === 2 || move.col === 7).toBe(true);
  });
});

// AC-2: 즉시 차단 (상대 4연속 막기)
describe('minimaxMove — 즉시 차단', () => {
  it('상대 4-in-a-row를 차단한다', () => {
    const board = emptyBoard();
    // W: (5,5),(5,6),(5,7),(5,8) — B가 (5,4) 또는 (5,9)를 둬야 함
    board[5][5] = board[5][6] = board[5][7] = board[5][8] = 'W';
    const move = minimaxMove(board, 'B', 2, 10);
    expect(move.row).toBe(5);
    expect(move.col === 4 || move.col === 9).toBe(true);
  });
});

// AC-3: depth=2에서 단순 휴리스틱보다 나은 수 (열린 3 만들기)
describe('minimaxMove — depth=2 공격', () => {
  it('열린 3을 만드는 수를 선택한다', () => {
    const board = emptyBoard();
    // B: (7,7),(7,8) — (7,6) 또는 (7,9) 중 하나를 두면 열린 3
    board[7][7] = board[7][8] = 'B';
    const move = minimaxMove(board, 'B', 2, 10);
    // 어떤 수를 두든, 같은 row에 인접한 수를 선택해야 함
    expect(move.row).toBe(7);
    expect([5, 6, 9, 10].includes(move.col)).toBe(true);
  });
});

// AC-4: 금수 위치를 선택하지 않음
describe('minimaxMove — 금수 회피', () => {
  it('흑 금수 위치를 선택하지 않는다', () => {
    const board = emptyBoard();
    // 3-3 금수 설정: (7,7)이 흑 금수가 되도록 보드 구성
    // 가로 열린 2: (7,5),(7,6) / 세로 열린 2: (5,7),(6,7)
    // (7,7) 착수 시 양방향 3-3 → 금수
    board[7][5] = board[7][6] = 'B';
    board[5][7] = board[6][7] = 'B';
    const move = minimaxMove(board, 'B', 2, 10);
    // (7,7)은 금수이므로 선택해선 안 됨
    expect(!(move.row === 7 && move.col === 7)).toBe(true);
  });
});

// AC-5: 성능 — depth=4, candidateLimit=8에서 500ms 이내
describe('minimaxMove — 성능', () => {
  it('중반 보드에서 500ms 이내 완료', () => {
    const board = emptyBoard();
    // 중반 보드 세팅 (약 10수 진행된 상태)
    const moves = [
      [7,7,'B'],[7,8,'W'],[6,7,'B'],[8,7,'W'],
      [7,6,'B'],[7,9,'W'],[5,7,'B'],[9,7,'W'],
      [6,6,'B'],[8,8,'W'],
    ];
    for (const [r, c, color] of moves) board[r][c] = color;

    const start = Date.now();
    const move = minimaxMove(board, 'B', 4, 8);
    const elapsed = Date.now() - start;

    expect(move).toBeTruthy();
    expect(elapsed).toBeLessThan(500);
  });
});
