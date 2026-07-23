// docs/spec/ai-arena.md §9 완료 기준 AC-A15~A18
import { describe, it, expect } from 'vitest';
import { isInOpeningZone } from '../../../engine/opening.js';
import { mulberry32 } from '../arena.js';
import { createAiPlayer } from '../../createAiPlayer.js';
import { MinimaxPlayer } from '../../players/MinimaxPlayer.js';
import { playOpeningGame } from '../openingArena.js';

function firstEmpty(board) {
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++)
      if (board[r][c] === null) return { row: r, col: c };
  return null;
}

function firstInZone(board, step, branch) {
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++)
      if (board[r][c] === null && isInOpeningZone(r, c, step, branch)) return { row: r, col: c };
  return firstEmpty(board);
}

// 설정 가능한 Mock 두뇌 (오프닝 6종 + getMove)
function mockBrain({ swap = false, branch = 1, openingMove } = {}) {
  return {
    getMove: (b) => firstEmpty(b),
    getOpeningMove: openingMove ?? ((b, color, step, br) => firstInZone(b, step, br)),
    shouldSwap: () => swap,
    selectBranch: () => branch,
    proposeOpeningCandidates: (b) => {
      const out = [];
      for (let r = 0; r < 15 && out.length < 10; r++)
        for (let c = 0; c < 15 && out.length < 10; c++)
          if (b[r][c] === null) out.push({ row: r, col: c });
      return out;
    },
    pickOpeningCandidate: (b, cands) => cands[0],
  };
}

describe('playOpeningGame', () => {
  it('AC-A15: 오프닝을 진행하고 승자를 판정해 종료한다 (무한 루프 없음)', () => {
    const r = playOpeningGame(createAiPlayer('normal'), createAiPlayer('normal'), { aStartColor: 'B' });
    expect(['A', 'B', 'draw']).toContain(r.winner);
    expect(r.reason).toBeTruthy();
    expect(r.moves.length).toBeGreaterThanOrEqual(6); // 오프닝 6수 이상
  });

  it('AC-A16: 첫 수는 정중앙(7,7)이고 오프닝 수는 구역 안이다', () => {
    const r = playOpeningGame(mockBrain(), mockBrain(), { aStartColor: 'B' });
    expect(r.moves[0]).toMatchObject({ row: 7, col: 7 });
    // 2~4수는 각 구역(3×3, 5×5, 7×7) 안 (스왑은 위치가 아닌 색만 바꾼다)
    expect(isInOpeningZone(r.moves[1].row, r.moves[1].col, 2)).toBe(true);
    expect(isInOpeningZone(r.moves[2].row, r.moves[2].col, 3)).toBe(true);
    expect(isInOpeningZone(r.moves[3].row, r.moves[3].col, 4)).toBe(true);
  });

  it('AC-A17: 스왑 결정이 swaps 집계에 반영된다', () => {
    const never = playOpeningGame(mockBrain({ swap: false, branch: 1 }), mockBrain({ swap: false, branch: 1 }), { aStartColor: 'B' });
    expect(never.swaps).toBe(0);

    const always = playOpeningGame(mockBrain({ swap: true, branch: 1 }), mockBrain({ swap: true, branch: 1 }), { aStartColor: 'B' });
    expect(always.swaps).toBeGreaterThanOrEqual(1);
  });

  it('AC-A19: rng를 주면 오프닝 place가 구역 내 무작위이고 같은 시드는 재현된다', () => {
    // 오프닝 rng 재현성만 검증하므로 두뇌는 결정적(margin 0)이어야 한다.
    const detBrain = () => new MinimaxPlayer({ depth: 2, candidateLimit: 10, defenseWeight: 1.0 });
    const brains = () => [detBrain(), detBrain()];
    const g1 = playOpeningGame(...brains(), { aStartColor: 'B', rng: mulberry32(42) });
    const g2 = playOpeningGame(...brains(), { aStartColor: 'B', rng: mulberry32(42) });
    const gDiff = playOpeningGame(...brains(), { aStartColor: 'B', rng: mulberry32(7) });

    // 1수는 여전히 중앙, 오프닝 수는 구역 안
    expect(g1.moves[0]).toMatchObject({ row: 7, col: 7 });
    expect(isInOpeningZone(g1.moves[1].row, g1.moves[1].col, 2)).toBe(true);
    // 같은 시드 → 동일 기보 (재현)
    expect(g1.moves).toEqual(g2.moves);
    // 다른 시드 → 다른 기보 (다양화)
    expect(g1.moves).not.toEqual(gDiff.moves);
  });

  it('AC-A18: getOpeningMove가 구역 밖을 반환하면 그 두뇌가 ILLEGAL_MOVE로 진다', () => {
    // brainA(흑, step1)가 정중앙 대신 (0,0)을 반환 → 구역 밖
    const bad = mockBrain({ openingMove: () => ({ row: 0, col: 0 }) });
    const r = playOpeningGame(bad, mockBrain(), { aStartColor: 'B' });
    expect(r.reason).toBe('ILLEGAL_MOVE');
    expect(r.offender).toBe('A');
    expect(r.winner).toBe('B');
  });
});
