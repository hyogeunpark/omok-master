// docs/spec/ai-arena.md §9 완료 기준 AC-A8~A11
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emptyBoard } from '../../../engine/board.js';
import { evaluateBoard } from '../../evaluate.js';
import { saveGames, loadGames, reviewGame } from '../review.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omok-arena-'));
afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('saveGames / loadGames', () => {
  it('AC-A8: 저장 후 로드하면 기보가 손실 없이 복원된다 (round-trip)', () => {
    const records = [
      {
        playerB: 'X', playerW: 'Y', winner: 'B', reason: 'FIVE',
        moves: [{ row: 7, col: 7, color: 'B' }, { row: 8, col: 8, color: 'W' }],
      },
      {
        playerB: 'Y', playerW: 'X', winner: 'draw', reason: 'DRAW',
        moves: [{ row: 0, col: 0, color: 'B' }],
      },
    ];
    const file = path.join(tmpDir, 'games.jsonl');
    saveGames(records, file);
    const loaded = loadGames(file);
    expect(loaded).toEqual(records);
  });
});

describe('reviewGame', () => {
  it('AC-A9 / AC-A11: delta를 두는 색 관점 evaluateBoard로 계산한다', () => {
    const record = {
      playerB: 'X', playerW: 'Y', winner: 'draw', reason: 'DRAW',
      moves: [
        { row: 7, col: 7, color: 'B' },
        { row: 7, col: 8, color: 'W' },
        { row: 8, col: 7, color: 'B' },
      ],
    };
    const review = reviewGame(record);

    // ply1(흑)의 기대값을 엔진 evaluateBoard로 직접 재현 → 재사용 검증
    const b0 = emptyBoard();
    const before = evaluateBoard(b0, 'B');
    b0[7][7] = 'B'; // 내 착수
    b0[7][8] = 'W'; // 상대 응수(다음 ply)
    const after = evaluateBoard(b0, 'B');

    const m1 = review.timeline[0];
    expect(m1.ply).toBe(1);
    expect(m1.color).toBe('B');
    expect(m1.scoreBefore).toBe(before);
    expect(m1.scoreAfter).toBe(after);
    expect(m1.delta).toBe(after - before);
  });

  it('AC-A9: 임계값 이하 급락 수를 blunder=true로 표시한다', () => {
    // 백이 흑의 승리를 저지하지 못하고 5목을 내주는 기보
    const record = winByBlackFiveRecord();
    const review = reviewGame(record, { blunderDrop: 5000 });
    // 승리를 허용한 백의 마지막 수는 blunder여야 한다
    const whiteBlunders = review.blunders.filter((b) => b.color === 'W');
    expect(whiteBlunders.length).toBeGreaterThan(0);
  });

  it('AC-A10: 명백한 패착에서 turningPly가 진 두뇌(백)의 그 수를 가리킨다', () => {
    const record = winByBlackFiveRecord();
    const review = reviewGame(record);
    expect(review.turningPly).not.toBe(null);
    const turn = review.timeline[review.turningPly - 1];
    expect(turn.color).toBe('W');        // 진 두뇌
    expect(turn.blunder).toBe(true);
    // 5목 완성을 허용한 직전 백의 수(ply 8)여야 한다
    expect(review.turningPly).toBe(8);
  });
});

// 흑이 (7,2)~(7,6) 가로 5목으로 이기는 기보.
// 백은 ply8에서 (7,6) 봉쇄를 놓쳐 다음 수에 5목을 내준다.
function winByBlackFiveRecord() {
  return {
    playerB: 'X', playerW: 'Y', winner: 'B', reason: 'FIVE',
    moves: [
      { row: 7, col: 2, color: 'B' }, // 1
      { row: 7, col: 1, color: 'W' }, // 2  왼쪽 봉쇄
      { row: 7, col: 3, color: 'B' }, // 3
      { row: 0, col: 0, color: 'W' }, // 4
      { row: 7, col: 4, color: 'B' }, // 5
      { row: 0, col: 1, color: 'W' }, // 6
      { row: 7, col: 5, color: 'B' }, // 7  닫힌 4 (오른쪽 7,6 열림)
      { row: 0, col: 2, color: 'W' }, // 8  ← 패착: (7,6) 미봉쇄
      { row: 7, col: 6, color: 'B' }, // 9  5목 완성
    ],
  };
}
