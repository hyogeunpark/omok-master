import { describe, it, expect } from 'vitest';
import { emptyBoard } from '../../engine/board.js';
import { vcfSearch } from '../vcf.js';

// AC-V1: 즉시 이기는 수 반환
describe('vcfSearch — 즉시 승리', () => {
  it('4-in-a-row 완성 수를 반환한다', () => {
    const board = emptyBoard();
    board[7][3] = board[7][4] = board[7][5] = board[7][6] = 'B';
    const move = vcfSearch(board, 'B', 10);
    expect(move).toBeTruthy();
    expect(move.row).toBe(7);
    expect(move.col === 2 || move.col === 7).toBe(true);
  });
});

// AC-V2: 4-위협 연쇄 탐지
// B: 세로 open-3 (5,5)(6,5)(7,5) + 가로 open-3 (5,5)(5,6)(5,7), W at (4,5) 세로 위 막힘
// 가능한 VCF 첫 수: (8,5) → 세로 닫힌4 or (5,8) → 가로 열린4 (둘 다 유효)
describe('vcfSearch — 4-위협 연쇄 탐지', () => {
  it('VCF 수순의 첫 수를 반환한다', () => {
    const board = emptyBoard();
    board[5][5] = board[6][5] = board[7][5] = 'B'; // 세로 open-3
    board[4][5] = 'W';                              // 세로 위쪽 막힘
    board[5][6] = board[5][7] = 'B';               // 가로 open-3 (5,5 공유)

    const move = vcfSearch(board, 'B', 10);
    // VCF 수순이 존재하므로 null이 아닌 수를 반환해야 함
    // (5,4)/(5,8) 열린4 또는 (8,5) 닫힌4 연쇄 모두 유효한 첫 수
    expect(move).toBeTruthy();
  });
});

// AC-V3: VCF 수순이 없으면 null 반환
describe('vcfSearch — VCF 없음', () => {
  it('단순 초기 보드에서 null을 반환한다', () => {
    const board = emptyBoard();
    board[7][7] = 'B';
    board[7][8] = 'W';
    const move = vcfSearch(board, 'B', 10);
    expect(move).toBeNull();
  });
});

// AC-V4: W(백) VCF 수순도 탐지
describe('vcfSearch — W 기준 VCF', () => {
  it('W 4-in-a-row 완성 수를 반환한다', () => {
    const board = emptyBoard();
    board[7][3] = board[7][4] = board[7][5] = board[7][6] = 'W';
    const move = vcfSearch(board, 'W', 10);
    expect(move).toBeTruthy();
    expect(move.row).toBe(7);
    expect(move.col === 2 || move.col === 7).toBe(true);
  });
});

// AC-V5: 성능 — 복잡한 중반 보드에서 200ms 이내
describe('vcfSearch — 성능', () => {
  it('중반 보드에서 200ms 이내 완료', () => {
    const board = emptyBoard();
    const moves = [
      [7,7,'B'],[7,8,'W'],[6,7,'B'],[8,7,'W'],
      [7,6,'B'],[7,9,'W'],[5,7,'B'],[9,7,'W'],
      [6,6,'B'],[8,8,'W'],
    ];
    for (const [r, c, color] of moves) board[r][c] = color;

    const start = Date.now();
    vcfSearch(board, 'B', 10);
    expect(Date.now() - start).toBeLessThan(200);
  });
});
