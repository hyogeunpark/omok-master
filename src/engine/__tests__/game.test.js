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
    const g2 = placeStone(g1, 7, 7); // 같은 자리 재착수 시도
    expect(g2).toBe(g1);             // 상태 변화 없음
  });

  it('게임 종료 후 착수 무시', () => {
    // 승리 상태의 game에서 추가 착수 시도 → 상태 변화 없음
    const game = createGame({ playerColor: 'B' });
    const won = { ...game, status: 'black-wins' };
    const next = placeStone(won, 0, 0);
    expect(next).toBe(won);
  });
});

describe('되돌리기 (FR-4)', () => {
  it('undo하면 내 수 + CPU 응수가 함께 취소되고 내 차례로 복귀', () => {
    const game = createGame({ playerColor: 'B' });
    const g1 = placeStone(game, 7, 7); // 흑 착수
    // CPU 응수가 포함된 상태라고 가정 (game.js 내부에서 처리)
    const undone = undoMove(g1);
    expect(undone.board[7][7]).toBeNull();
    expect(undone.currentTurn).toBe('B');
  });

  it('진 뒤에도 undo 동작', () => {
    const game = createGame({ playerColor: 'B' });
    const lost = { ...game, status: 'white-wins', history: [{ row: 7, col: 7, color: 'B' }] };
    const undone = undoMove(lost);
    expect(undone.status).toBe('playing');
  });

  it('히스토리가 없으면 undo는 아무것도 하지 않음', () => {
    const game = createGame({ playerColor: 'B' });
    const undone = undoMove(game);
    expect(undone).toBe(game);
  });
});

describe('색 선택 (FR-5)', () => {
  it('백 선택 시 CPU가 흑으로 선공', () => {
    const game = createGame({ playerColor: 'W' });
    // 게임 시작 직후 CPU(흑)가 먼저 둔 상태여야 함
    expect(game.currentTurn).toBe('W'); // CPU 착수 후 사람 차례
  });

  it('흑 선택 시 사람이 선공', () => {
    const game = createGame({ playerColor: 'B' });
    expect(game.currentTurn).toBe('B');
  });
});
