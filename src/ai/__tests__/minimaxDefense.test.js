// docs/spec/ai.md §3-5-1 방어 우선 예외 — 상대 즉시-5 위협 시 VCF 생략하고 차단
import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { createAiPlayer } from '../createAiPlayer.js';

describe('hard getMove — VCF 방어 우선', () => {
  it('상대 즉시-5 위협이 있으면 VCF 공격 대신 차단한다', () => {
    const board = emptyBoard();
    // 백: (7,3~6) 4목, 왼쪽 (7,2)=흑으로 막힘 → 즉시-5 자리는 (7,7) 하나
    board[7][3] = board[7][4] = board[7][5] = board[7][6] = 'W';
    board[7][2] = 'B';
    // 흑: (10,3~5) 열린3 — VCF가 이걸로 공격을 시도할 만한 형태
    board[10][3] = board[10][4] = board[10][5] = 'B';

    const move = createAiPlayer('hard').getMove(board, 'B');
    // 백의 즉시-5(7,7)를 반드시 막아야 한다 (공격 10줄로 새면 다음 수에 짐)
    expect(move).toEqual({ row: 7, col: 7 });
  });

  it('상대 즉시 위협이 없으면 VCF 선행은 그대로 동작한다 (회귀)', () => {
    const board = emptyBoard();
    // 흑 열린4 → 즉시 승리 수가 있는 국면 (VCF/즉승 반환)
    board[7][3] = board[7][4] = board[7][5] = board[7][6] = 'B';
    const move = createAiPlayer('hard').getMove(board, 'B');
    // (7,2) 또는 (7,7)로 5목 완성
    expect(move.row).toBe(7);
    expect([2, 7]).toContain(move.col);
  });
});
