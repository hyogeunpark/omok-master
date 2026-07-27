// docs/spec/game-modes.md §6 완료 기준 — 빠른 대국 / 정석 렌주
import { describe, it, expect } from 'vitest';
import { createGame, placeStone } from '../game.js';

describe('빠른 대국 (quick) — 오프닝 생략', () => {
  it('opening이 null이고 첫 수부터 바로 착수된다', () => {
    const g = createGame({ useOpening: false });
    expect(g.opening).toBeNull();

    const g2 = placeStone(g, 7, 7);
    expect(g2.board[7][7]).toBe('B');
    expect(g2.history).toHaveLength(1);
  });

  it('금수는 그대로 적용된다 — 흑 4-4는 반칙패 (forbidden.md §20)', () => {
    // 흑에게 4-4를 만들어 주는 국면을 구성한다.
    const g = createGame({ useOpening: false, playerColor: 'B' });
    const b = g.board;
    // 가로 4: (7,4)(7,5)(7,6) + 착수점 (7,7)
    b[7][4] = 'B'; b[7][5] = 'B'; b[7][6] = 'B';
    // 세로 4: (4,7)(5,7)(6,7) + 같은 착수점 (7,7)
    b[4][7] = 'B'; b[5][7] = 'B'; b[6][7] = 'B';

    const after = placeStone(g, 7, 7);
    expect(after.status).toBe('white-wins'); // 흑 반칙패
  });

  it('5목이면 정상 승리 판정', () => {
    let g = createGame({ useOpening: false });
    const b = g.board;
    b[7][3] = 'B'; b[7][4] = 'B'; b[7][5] = 'B'; b[7][6] = 'B';
    const after = placeStone(g, 7, 7);
    expect(after.status).toBe('black-wins');
  });
});

describe('정석 렌주 (renju) — 오프닝 유지 (회귀 없음)', () => {
  it('기본값은 오프닝이 있는 게임이다', () => {
    const g = createGame();
    expect(g.opening).not.toBeNull();
    expect(g.opening.step).toBe(1);
  });

  it('useOpening: true를 명시해도 동일하다', () => {
    const g = createGame({ useOpening: true });
    expect(g.opening).not.toBeNull();
  });
});
