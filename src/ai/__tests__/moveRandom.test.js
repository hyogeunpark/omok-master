// docs/spec/ai.md §7-6 — 최선점 근처 랜덤 선택
import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { hasImmediate } from '../evaluate.js';
import { minimaxMove, minimaxMoveTT } from '../minimax.js';

function place(stones) {
  const b = emptyBoard();
  for (const [r, c, col] of stones) b[r][c] = col;
  return b;
}
const key = (m) => `${m.row},${m.col}`;

describe('minimaxMove/TT — margin=0 결정적', () => {
  it('margin 0이면 같은 판에서 항상 같은 수 (기존 동작)', () => {
    const stones = [[7, 7, 'B'], [7, 8, 'W'], [6, 7, 'B'], [8, 8, 'W']];
    const a = minimaxMove(place(stones), 'W', 4, 8, 0);
    const b = minimaxMove(place(stones), 'W', 4, 8, 0);
    expect(a).toEqual(b);
    const c = minimaxMoveTT(place(stones), 'W', 6, 8, 8, Infinity, 0);
    const d = minimaxMoveTT(place(stones), 'W', 6, 8, 8, Infinity, 0);
    expect(c).toEqual(d);
  });
});

describe('minimaxMove — margin>0 안전성 (전술 절대 유지)', () => {
  it('즉시 승리 수는 margin 커도 반드시 둔다', () => {
    const b = place([[7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 2, 'W']]);
    for (let i = 0; i < 20; i++) {
      const m = minimaxMove(place([[7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 6, 'B'], [7, 2, 'W']]), 'B', 4, 8, 5000);
      expect(hasImmediate(b, m.row, m.col, 'B')).toBe(true);
    }
  });

  it('상대 즉시-5 위협은 margin 커도 반드시 차단한다', () => {
    // 백 4목(7,3~6), 왼쪽 (7,2)=흑 → 유일 차단점 (7,7)
    for (let i = 0; i < 20; i++) {
      const m = minimaxMove(place([[7, 3, 'W'], [7, 4, 'W'], [7, 5, 'W'], [7, 6, 'W'], [7, 2, 'B']]), 'B', 4, 8, 5000);
      expect(m).toEqual({ row: 7, col: 7 });
    }
  });
});

describe('minimaxMove — margin>0 다양성', () => {
  it('열린 국면에서 여러 판이면 여러 수가 나온다', () => {
    const stones = [[7, 7, 'B'], [7, 9, 'W']]; // 초반 열린 국면
    const seen = new Set();
    for (let i = 0; i < 40; i++) {
      seen.add(key(minimaxMove(place(stones), 'W', 2, 10, 400)));
    }
    expect(seen.size).toBeGreaterThan(1); // 결정적이면 1
  });
});
