// Phase 1 완료 기준: 게임 흐름 (FR-1, FR-4, FR-5)
// 구현 위치: src/engine/game.js
import { describe, it, expect } from 'vitest';
import { createGame, placeStone, undoMove } from '../game.js';

describe('착수 (FR-1)', () => {
  it('빈 교점에 착수하면 돌이 놓임', () => {
    const game = createGame({ playerColor: 'B' });
    const next = placeStone(game, 7, 7);
    expect(next.board[7][7]).toBe('B');
  });

  it('이미 점유된 교점은 무시', () => {
    const game = createGame({ playerColor: 'B' });
    const g1 = placeStone(game, 7, 7);
    const g2 = placeStone(g1, 7, 7);
    expect(g2).toBe(g1);
  });

  it('게임 종료 후 착수 무시', () => {
    const game = createGame({ playerColor: 'B' });
    const won = { ...game, status: 'black-wins' };
    const next = placeStone(won, 0, 0);
    expect(next).toBe(won);
  });

  it('착수 후 차례가 상대로 넘어감', () => {
    const game = createGame({ playerColor: 'B' });
    const next = placeStone(game, 7, 7);
    expect(next.currentTurn).toBe('W');
  });
});

describe('되돌리기 (FR-4)', () => {
  it('undo하면 내 수 + CPU 응수가 함께 취소되고 내 차례로 복귀', () => {
    const game = createGame({ playerColor: 'B' });
    const g1 = placeStone(game, 7, 7);  // 흑(사람) 착수
    const g2 = placeStone(g1, 0, 0);   // 백(CPU) 응수
    const undone = undoMove(g2);
    expect(undone.board[7][7]).toBeNull();
    expect(undone.board[0][0]).toBeNull();
    expect(undone.currentTurn).toBe('B');
  });

  it('진 뒤에도 undo 동작', () => {
    const game = createGame({ playerColor: 'B' });
    const g1 = placeStone(game, 7, 7);
    const lost = { ...g1, status: 'white-wins' };
    const undone = undoMove(lost);
    expect(undone.status).toBe('playing');
    expect(undone.board[7][7]).toBeNull();
  });

  it('히스토리가 없으면 undo는 아무것도 하지 않음', () => {
    const game = createGame({ playerColor: 'B' });
    const undone = undoMove(game);
    expect(undone).toBe(game);
  });
});

describe('색 선택 (FR-5)', () => {
  it('흑 선택 시 사람이 선공 (currentTurn === B)', () => {
    const game = createGame({ playerColor: 'B' });
    expect(game.currentTurn).toBe('B');
    expect(game.cpuColor).toBe('W');
  });

  it('백 선택 시 CPU가 흑으로 선공 (currentTurn === B, 즉 CPU 차례)', () => {
    const game = createGame({ playerColor: 'W' });
    expect(game.currentTurn).toBe('B'); // 흑(CPU) 선공 — UI가 즉시 CPU 수 처리
    expect(game.cpuColor).toBe('B');
  });
});
