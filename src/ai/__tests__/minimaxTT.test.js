// docs/spec/ai.md §7-4 — TT+반복심화는 동작(선택 수)을 바꾸지 않고 속도만 개선
import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { minimaxMove, minimaxMoveTT } from '../minimax.js';

function place(stones) {
  const b = emptyBoard();
  for (const [r, c, col] of stones) b[r][c] = col;
  return b;
}

describe('minimaxMoveTT — 정확성 (기존 minimaxMove와 동등)', () => {
  it('즉시 승리 수를 둔다', () => {
    const b = place([[7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 2, 'W']]);
    expect(minimaxMoveTT(b, 'B', 4, 8)).toEqual({ row: 7, col: 7 });
  });

  it('상대 즉시-5를 차단한다', () => {
    const b = place([[7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'], [7, 6, 'W'], [7, 2, 'B']]);
    expect(minimaxMoveTT(b, 'B', 4, 8)).toEqual({ row: 7, col: 7 });
  });

  it('이중4 fork 국면에서 plain과 같은 승리 수를 낸다', () => {
    const stones = [[4, 7, 'B'], [5, 7, 'B'], [6, 7, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B']];
    const plain = minimaxMove(place(stones), 'B', 4, 8);
    const tt = minimaxMoveTT(place(stones), 'B', 4, 8);
    expect(tt).toEqual(plain);
  });

  it('같은 depth에서 minimaxMove와 동일한 수를 낸다 (여러 국면)', () => {
    const positions = [
      [[7, 7, 'B'], [7, 8, 'W'], [6, 7, 'B'], [8, 8, 'W']],
      [[7, 7, 'W'], [8, 7, 'B'], [7, 8, 'W'], [6, 6, 'B'], [7, 9, 'W']],
      [[7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'], [7, 2, 'B'], [10, 10, 'B']],
    ];
    for (const stones of positions) {
      const toMove = stones.length % 2 === 0 ? 'B' : 'W';
      const b1 = place(stones);
      const b2 = place(stones);
      const plain = minimaxMove(b1, toMove, 4, 8);
      const tt = minimaxMoveTT(b2, toMove, 4, 8);
      expect(tt).toEqual(plain);
    }
  });

  it('탐색 후 board를 원상복구한다 (부작용 없음)', () => {
    const stones = [[7, 7, 'B'], [7, 8, 'W'], [6, 7, 'B']];
    const b = place(stones);
    const snapshot = JSON.stringify(b);
    minimaxMoveTT(b, 'W', 4, 8);
    expect(JSON.stringify(b)).toBe(snapshot);
  });
});

describe('minimaxMoveTT — 강제 수 연장 + node 캡 (docs/spec/ai.md §7-5)', () => {
  it('연장(ext>0)해도 기본 전술을 정확히 둔다', () => {
    const win = place([[7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 2, 'W']]);
    expect(minimaxMoveTT(win, 'B', 6, 8, 8)).toEqual({ row: 7, col: 7 });
    const block = place([[7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'], [7, 6, 'W'], [7, 2, 'B']]);
    expect(minimaxMoveTT(block, 'B', 6, 8, 8)).toEqual({ row: 7, col: 7 });
  });

  it('AC-W1: onDepth가 반복심화 각 깊이마다 호출되고 최종 수는 동일하다', () => {
    const stones = [[7, 7, 'W'], [8, 7, 'B'], [7, 8, 'W'], [6, 6, 'B'], [7, 9, 'W']];
    const seen = [];
    const withCb = minimaxMoveTT(place(stones), 'B', 6, 8, 8, Infinity, (d) => seen.push(d));
    const without = minimaxMoveTT(place(stones), 'B', 6, 8, 8);
    expect(seen).toEqual([2, 4, 6]);       // 반복심화 깊이 보고
    expect(withCb).toEqual(without);       // 콜백이 결과를 바꾸지 않음
  });

  it('node 캡이 걸려도 합법 수를 반환하고 board를 복구한다', () => {
    const stones = [[7, 7, 'B'], [7, 8, 'W'], [6, 7, 'B'], [8, 8, 'W'], [7, 6, 'B']];
    const b = place(stones);
    const snapshot = JSON.stringify(b);
    const m = minimaxMoveTT(b, 'W', 6, 8, 8, 200); // 아주 작은 예산 → 캡 발동
    expect(b[m.row][m.col]).toBe(null); // 빈 칸
    expect(JSON.stringify(b)).toBe(snapshot); // 부작용 없음
  });
});
