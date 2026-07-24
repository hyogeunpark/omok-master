// Phase 3 완료 기준: 타라구치-10 오프닝 (FR-7, FR-7a~c)
import { describe, it, expect } from 'vitest';
import {
  isInOpeningZone, isCandidateDuplicate,
} from '../opening.js';
import {
  createGame, placeStone,
  performOpeningSwap, skipOpeningSwap,
  selectOpeningBranch, addOpeningCandidate, pickOpeningCandidate,
} from '../game.js';

// ─── 영역 제한 ────────────────────────────────────────────────────────────────

describe('오프닝 영역 제한 (phase-3.md §2)', () => {
  it('1수 — 정중앙(7,7)만 허용', () => {
    expect(isInOpeningZone(7, 7, 1)).toBe(true);
    expect(isInOpeningZone(6, 7, 1)).toBe(false);
    expect(isInOpeningZone(7, 8, 1)).toBe(false);
  });

  it('2수 — 3×3 안(6~8, 6~8)만 허용', () => {
    expect(isInOpeningZone(6, 6, 2)).toBe(true);
    expect(isInOpeningZone(8, 8, 2)).toBe(true);
    expect(isInOpeningZone(5, 7, 2)).toBe(false);
    expect(isInOpeningZone(7, 9, 2)).toBe(false);
  });

  it('3수 — 5×5 안(5~9, 5~9)만 허용', () => {
    expect(isInOpeningZone(5, 5, 3)).toBe(true);
    expect(isInOpeningZone(4, 7, 3)).toBe(false);
  });

  it('4수 — 7×7 안(4~10, 4~10)만 허용', () => {
    expect(isInOpeningZone(4, 4, 4)).toBe(true);
    expect(isInOpeningZone(3, 7, 4)).toBe(false);
  });

  it('5수 선택1 — 9×9 안(3~11, 3~11)만 허용', () => {
    expect(isInOpeningZone(3, 3, 5, 1)).toBe(true);
    expect(isInOpeningZone(2, 7, 5, 1)).toBe(false);
  });

  it('5수 선택2 후보 — 영역 제한 없음', () => {
    expect(isInOpeningZone(0, 0, 5, 2)).toBe(true);
    expect(isInOpeningZone(14, 14, 5, 2)).toBe(true);
  });

  it('6수 — 영역 제한 없음', () => {
    expect(isInOpeningZone(0, 0, 6)).toBe(true);
    expect(isInOpeningZone(14, 14, 6)).toBe(true);
  });
});

// ─── 오프닝 착수 강제 ──────────────────────────────────────────────────────────

describe('placeStone — 오프닝 영역 외 착수 무시', () => {
  it('1수는 정중앙이 아닌 곳 무시', () => {
    const g = createGame({ playerColor: 'B', useOpening: true });
    const g2 = placeStone(g, 5, 5);
    expect(g2.board[5][5]).toBeNull();
    expect(g2.opening.step).toBe(1);
  });

  it('정중앙 착수 후 step 유지, phase→await-swap', () => {
    const g = createGame({ playerColor: 'B', useOpening: true });
    const g2 = placeStone(g, 7, 7);
    expect(g2.board[7][7]).toBe('B');
    expect(g2.opening.phase).toBe('await-swap');
    expect(g2.opening.step).toBe(1);
  });
});

// ─── 스왑 ─────────────────────────────────────────────────────────────────────

describe('스왑 처리 (phase-3.md §2, §5-1)', () => {
  function gameAfterMove1(playerColor = 'B') {
    const g = createGame({ playerColor, useOpening: true });
    return placeStone(g, 7, 7); // 1수 착수
  }

  it('스왑 → 플레이어/CPU 색 교환', () => {
    const g2 = gameAfterMove1('B');          // player=B, cpu=W
    expect(g2.opening.phase).toBe('await-swap');
    const g3 = performOpeningSwap(g2);       // White(CPU) swaps
    expect(g3.playerColor).toBe('W');
    expect(g3.cpuColor).toBe('B');
    expect(g3.opening.step).toBe(2);
    expect(g3.opening.phase).toBe('place');
  });

  it('스왑 스킵 → 색 유지, 다음 step으로', () => {
    const g2 = gameAfterMove1('B');
    const g3 = skipOpeningSwap(g2);
    expect(g3.playerColor).toBe('B');
    expect(g3.cpuColor).toBe('W');
    expect(g3.opening.step).toBe(2);
  });
});

// ─── 4수 이후 분기 ────────────────────────────────────────────────────────────

describe('4수 이후 분기 선택 (phase-3.md §2)', () => {
  function gameAfterMove4() {
    let g = createGame({ playerColor: 'B', useOpening: true });
    g = placeStone(g, 7, 7);         // 1수 흑 중앙
    g = skipOpeningSwap(g);           // 스왑 패스
    g = placeStone(g, 6, 7);         // 2수 백 3×3
    g = skipOpeningSwap(g);
    g = placeStone(g, 5, 7);         // 3수 흑 5×5
    g = skipOpeningSwap(g);
    g = placeStone(g, 4, 7);         // 4수 백 7×7
    return g;
  }

  it('4수 후 phase=await-branch', () => {
    const g = gameAfterMove4();
    expect(g.opening.phase).toBe('await-branch');
    expect(g.opening.step).toBe(4);
  });

  it('선택 1 → 5수 phase=await-swap(흑), 이후 place(9×9)', () => {
    let g = gameAfterMove4();
    g = selectOpeningBranch(g, 1);
    expect(g.opening.branch).toBe(1);
    expect(g.opening.phase).toBe('await-swap'); // 흑 스왑 기회
    g = skipOpeningSwap(g);
    expect(g.opening.step).toBe(5);
    expect(g.opening.phase).toBe('place');
    // 9×9 밖 착수 무시
    const gBad = placeStone(g, 2, 7);
    expect(gBad.board[2][7]).toBeNull();
    // 9×9 안 착수 허용
    const gOk = placeStone(g, 3, 7);
    expect(gOk.board[3][7]).toBe('B');
  });

  it('선택 2 → phase=await-candidates', () => {
    let g = gameAfterMove4();
    g = selectOpeningBranch(g, 2);
    expect(g.opening.branch).toBe(2);
    expect(g.opening.phase).toBe('await-candidates');
  });
});

// ─── 선택 2 후보 ──────────────────────────────────────────────────────────────

describe('선택 2 후보 제시 (phase-3.md §5-1)', () => {
  it('후보 10개 제시 → phase=await-candidate-pick', () => {
    let g = createGame({ playerColor: 'B', useOpening: true });
    g = placeStone(g, 7, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 6, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 5, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 4, 7);
    g = selectOpeningBranch(g, 2);

    const positions = [
      [0,0],[1,1],[2,2],[3,3],[0,1],[1,0],[0,2],[2,0],[0,3],[3,0]
    ];
    for (const [r, c] of positions) {
      g = addOpeningCandidate(g, r, c);
    }
    expect(g.opening.candidates.length).toBe(10);
    expect(g.opening.phase).toBe('await-candidate-pick');
  });

  it('대칭 중복 후보는 추가 거부', () => {
    const candidates = [{ row: 0, col: 0 }]; // (0,0): dr=-7,dc=-7
    // 8방향 대칭 중 하나: (14,14) → dr=+7,dc=+7 → 대칭
    expect(isCandidateDuplicate(candidates, 14, 14)).toBe(true);
    // 비대칭 위치는 허용
    expect(isCandidateDuplicate(candidates, 0, 1)).toBe(false);
  });

  it('후보 중 하나 선택 → 흑 5수로 확정, step 6', () => {
    let g = createGame({ playerColor: 'B', useOpening: true });
    g = placeStone(g, 7, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 6, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 5, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 4, 7);
    g = selectOpeningBranch(g, 2);
    for (const [r, c] of [[0,0],[1,1],[2,2],[3,3],[0,1],[1,0],[0,2],[2,0],[0,3],[3,0]]) {
      g = addOpeningCandidate(g, r, c);
    }
    g = pickOpeningCandidate(g, 0, 0); // 백이 (0,0) 선택
    expect(g.board[0][0]).toBe('B');   // 흑 돌이 놓임
    expect(g.opening.step).toBe(6);
    expect(g.opening.phase).toBe('place');
  });
});

// ─── 오프닝 종료 후 ───────────────────────────────────────────────────────────

describe('오프닝 종료 후 일반 렌주 적용 (phase-3.md §2)', () => {
  function completeBranch1Opening() {
    let g = createGame({ playerColor: 'B', useOpening: true });
    g = placeStone(g, 7, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 6, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 5, 7);
    g = skipOpeningSwap(g);
    g = placeStone(g, 4, 7);
    g = selectOpeningBranch(g, 1);
    g = skipOpeningSwap(g);
    g = placeStone(g, 3, 7);  // 5수 흑 9×9
    g = skipOpeningSwap(g);
    g = placeStone(g, 10, 7); // 6수 백 임의
    return g;
  }

  it('6수 완료 후 opening=null', () => {
    const g = completeBranch1Opening();
    expect(g.opening).toBeNull();
  });

  it('오프닝 없으면 useOpening=false 시 opening=null', () => {
    const g = createGame({ useOpening: false });
    expect(g.opening).toBeNull();
  });
});
