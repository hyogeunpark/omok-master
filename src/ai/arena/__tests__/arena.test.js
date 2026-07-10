// docs/spec/ai-arena.md §9 완료 기준 AC-A1~A7
import { describe, it, expect } from 'vitest';
import { playGame, playMatch, runTournament, randomOpenings } from '../arena.js';
import { isForbidden } from '../../../engine/forbidden.js';

// 지정한 수 목록을 순서대로 반환하는 Mock 두뇌.
// moves 소진 후에는 fallback(board)으로 임의의 빈칸을 둔다.
function scriptedPlayer(name, moves, fallback) {
  let i = 0;
  return {
    name,
    getMove(board) {
      if (i < moves.length) return moves[i++];
      return fallback ? fallback(board) : firstEmpty(board);
    },
  };
}

function firstEmpty(board) {
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++)
      if (board[r][c] === null) return { row: r, col: c };
  return null;
}

describe('playGame', () => {
  it('AC-A1: 5목을 완성하면 그 색이 이기고 reason=FIVE', () => {
    // 흑: (7,0)~(7,4) 가로 5목. 백은 방해 안 되는 먼 곳에.
    const black = scriptedPlayer('B', [
      { row: 7, col: 0 }, { row: 7, col: 1 }, { row: 7, col: 2 },
      { row: 7, col: 3 }, { row: 7, col: 4 },
    ]);
    const white = scriptedPlayer('W', [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    ]);
    const r = playGame(black, white);
    expect(r.winner).toBe('B');
    expect(r.reason).toBe('FIVE');
    expect(r.offender).toBe(null);
  });

  it('AC-A2: 흑이 금수(3-3) 자리를 두면 백 승, reason=FORBIDDEN_MOVE', () => {
    // 흑이 (7,7)에 두면 삼삼이 되도록 배치.
    // 가로: (7,5),(7,6) + (7,7) → 열린3 / 세로: (5,7),(6,7) + (7,7) → 열린3
    const black = scriptedPlayer('B', [
      { row: 7, col: 5 }, { row: 7, col: 6 }, { row: 5, col: 7 }, { row: 6, col: 7 },
      { row: 7, col: 7 }, // ← 삼삼 금수
    ]);
    const white = scriptedPlayer('W', [
      { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 0, col: 3 },
    ]);
    const r = playGame(black, white);
    expect(r.winner).toBe('W');
    expect(r.reason).toBe('FORBIDDEN_MOVE');
    expect(r.offender).toBe('B');
  });

  it('AC-A3: 점유된 교점을 반환하면 그 두뇌 패, reason=ILLEGAL_MOVE', () => {
    const black = scriptedPlayer('B', [{ row: 7, col: 7 }, { row: 7, col: 7 }]); // 두 번째로 같은 칸
    const white = scriptedPlayer('W', [{ row: 0, col: 0 }]);
    const r = playGame(black, white);
    expect(r.winner).toBe('W');
    expect(r.reason).toBe('ILLEGAL_MOVE');
    expect(r.offender).toBe('B');
  });

  it('AC-A3: null을 반환하면 그 두뇌 패, reason=ILLEGAL_MOVE', () => {
    const black = { name: 'B', getMove: () => null };
    const white = scriptedPlayer('W', []);
    const r = playGame(black, white);
    expect(r.winner).toBe('W');
    expect(r.reason).toBe('ILLEGAL_MOVE');
    expect(r.offender).toBe('B');
  });

  it('AC-A4: getMove가 예외를 던지면 그 두뇌 패, reason=EXCEPTION', () => {
    const black = { name: 'B', getMove: () => { throw new Error('boom'); } };
    const white = scriptedPlayer('W', []);
    const r = playGame(black, white);
    expect(r.winner).toBe('W');
    expect(r.reason).toBe('EXCEPTION');
    expect(r.offender).toBe('B');
  });

  it('history에 전체 수순이 색과 함께 기록된다', () => {
    const black = scriptedPlayer('B', [{ row: 7, col: 7 }]);
    const white = scriptedPlayer('W', [{ row: 8, col: 8 }]);
    const black2 = scriptedPlayer('B', [{ row: 7, col: 7 }]);
    const white2 = scriptedPlayer('W', [{ row: 8, col: 8 }]);
    // 무한 진행 방지: 짧게 maxMoves로 컷
    const r = playGame(
      scriptedPlayer('B', [{ row: 7, col: 7 }, { row: 9, col: 9 }]),
      scriptedPlayer('W', [{ row: 8, col: 8 }]),
      { maxMoves: 3 },
    );
    expect(r.history[0]).toEqual({ row: 7, col: 7, color: 'B' });
    expect(r.history[1]).toEqual({ row: 8, col: 8, color: 'W' });
    void black; void white; void black2; void white2;
  });
});

describe('playMatch', () => {
  it('AC-A5: alternate=true면 A가 흑/백 절반씩 둔다', () => {
    const colorsA = [];
    const spy = (name) => ({
      name,
      getMove(board, color) {
        if (name === 'A') colorsA.push(color);
        return firstEmpty(board);
      },
    });
    // 흑·백 각 1수만 두도록 maxMoves=2 (A가 두 색을 모두 두는지 관찰).
    playMatch(spy('A'), spy('B'), { games: 10, alternate: true, maxMoves: 2 });
    const blackCount = colorsA.filter((c) => c === 'B').length;
    const whiteCount = colorsA.filter((c) => c === 'W').length;
    expect(blackCount).toBe(5);
    expect(whiteCount).toBe(5);
  });

  it('승패·무승부 집계와 winRateA가 일관된다', () => {
    // A는 항상 5목을 빠르게 만드는 강한 두뇌, B는 먼 곳에만 둔다.
    const strong = (name) => ({
      name,
      getMove(board) {
        // 가로 7행에 5목을 시도 (양쪽 두뇌 모두 같은 줄을 노려 승부가 갈리게)
        for (let c = 0; c < 5; c++) if (board[7][c] === null) return { row: 7, col: c };
        return firstEmpty(board);
      },
    });
    const passive = (name) => ({
      name,
      getMove: (board) => {
        for (let c = 14; c >= 0; c--) if (board[0][c] === null) return { row: 0, col: c };
        return firstEmpty(board);
      },
    });
    const m = playMatch(strong('A'), passive('B'), { games: 4, alternate: false });
    expect(m.winsA + m.winsB + m.draws).toBe(4);
    expect(m.winRateA).toBeCloseTo(m.winsA / 4);
  });
});

describe('randomOpenings', () => {
  it('AC-A12: 같은 seed는 같은 오프닝 세트를 낸다 (재현 가능)', () => {
    const a = randomOpenings(5, { stones: 4, seed: 42 });
    const b = randomOpenings(5, { stones: 4, seed: 42 });
    expect(a).toEqual(b);
  });

  it('AC-A12: 다른 seed는 (거의) 다른 오프닝을 낸다', () => {
    const a = randomOpenings(5, { stones: 4, seed: 1 });
    const b = randomOpenings(5, { stones: 4, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('AC-A12: 각 오프닝은 서로 다른 빈 교점이고 흑 좌표는 금수가 아니다', () => {
    const book = randomOpenings(20, { stones: 4, seed: 7 });
    for (const opening of book) {
      expect(opening.length).toBe(4);
      const seen = new Set();
      // playGame과 동일하게 흑,백,흑… 순으로 재생하며 검증
      const board = Array.from({ length: 15 }, () => Array(15).fill(null));
      let color = 'B';
      for (const { row, col } of opening) {
        const key = `${row},${col}`;
        expect(seen.has(key)).toBe(false); // 중복 없음
        expect(row >= 0 && row < 15 && col >= 0 && col < 15).toBe(true);
        if (color === 'B') {
          expect(isForbidden(board, row, col, 'B')).toBe(false);
        }
        seen.add(key);
        board[row][col] = color;
        color = color === 'B' ? 'W' : 'B';
      }
    }
  });
});

describe('makeOpening', () => {
  it('AC-A13: makeOpening을 주면 각 판이 그 초기 수로 시작한다', () => {
    const book = randomOpenings(2, { stones: 4, seed: 3 });
    const players = () => ({ getMove: (b) => firstEmpty(b) });
    let captured = null;
    // history를 캡처하기 위해 playMatch 대신 makeOpening 규칙을 직접 확인
    const r = playGame(players(), players(), { openingMoves: book[0], maxMoves: 4 });
    captured = r.history;
    // 초기 4수가 흑,백,흑,백 순으로 book[0] 좌표와 일치해야 한다
    const colors = ['B', 'W', 'B', 'W'];
    book[0].forEach((mv, i) => {
      expect(captured[i]).toEqual({ row: mv.row, col: mv.col, color: colors[i] });
    });
  });

  it('AC-A13: playMatch가 판마다 makeOpening(i)를 적용한다', () => {
    const book = randomOpenings(4, { stones: 2, seed: 9 });
    const openingsUsed = [];
    const recorder = () => ({
      getMove(board) {
        return firstEmpty(board);
      },
    });
    // makeOpening을 감싸 호출 인자를 기록
    playMatch(recorder(), recorder(), {
      games: 4,
      alternate: true,
      maxMoves: 2, // 초기 수만으로 이미 채워지므로 곧 종료
      makeOpening: (i) => {
        openingsUsed.push(i);
        return book[i];
      },
    });
    expect(openingsUsed).toEqual([0, 1, 2, 3]);
  });
});

describe('onGame', () => {
  it('AC-A14: onGame이 판마다 GameRecord를 한 번씩 넘기고 승자 집계가 결과와 일치한다', () => {
    const strong = (name) => ({
      name,
      getMove(board) {
        for (let c = 0; c < 5; c++) if (board[7][c] === null) return { row: 7, col: c };
        return firstEmpty(board);
      },
    });
    const passive = (name) => ({
      name,
      getMove: (board) => {
        for (let c = 14; c >= 0; c--) if (board[0][c] === null) return { row: 0, col: c };
        return firstEmpty(board);
      },
    });
    const records = [];
    const m = playMatch(strong('A'), passive('B'), {
      games: 6,
      alternate: true,
      onGame: (r) => records.push(r),
    });
    // 판 수만큼 정확히 한 번씩
    expect(records.length).toBe(6);
    // onGame 기보의 승자 집계 == MatchResult 집계 (같은 한 판에서 나옴)
    let winsA = 0, winsB = 0, draws = 0;
    records.forEach((r, i) => {
      const aIsBlack = i % 2 === 0; // alternate=true
      if (r.winner === 'draw') draws++;
      else if ((r.winner === 'B') === aIsBlack) winsA++;
      else winsB++;
      // 흑/백 이름이 색 교대를 반영
      expect(r.playerB).toBe(aIsBlack ? 'A' : 'B');
      expect(r.playerW).toBe(aIsBlack ? 'B' : 'A');
    });
    expect(winsA).toBe(m.winsA);
    expect(winsB).toBe(m.winsB);
    expect(draws).toBe(m.draws);
  });

  it('AC-A14: runTournament는 entry 이름으로 기보를 구분한다 (같은 구현체라도)', () => {
    // 둘 다 같은 구현(name 없음)이지만 entry 이름이 다르다
    const mk = () => ({ getMove: (b) => firstEmpty(b) });
    const entries = [
      { name: 'BrainX', player: mk() },
      { name: 'BrainY', player: mk() },
    ];
    const records = [];
    runTournament(entries, { games: 2, maxMoves: 4, onGame: (r) => records.push(r) });
    const names = new Set(records.flatMap((r) => [r.playerB, r.playerW]));
    expect(names).toEqual(new Set(['BrainX', 'BrainY']));
  });
});

describe('runTournament', () => {
  it('AC-A6: N개 두뇌 → N(N-1)/2 매치 + 승점순 standings', () => {
    const mk = (name) => ({ name, player: { name, getMove: (b) => firstEmpty(b) } });
    const entries = [mk('X'), mk('Y'), mk('Z')];
    const { table, standings } = runTournament(entries, { games: 2, maxMoves: 4 });
    expect(table.length).toBe(3); // 3*2/2
    expect(standings.length).toBe(3);
    // 승점 내림차순 정렬 확인
    for (let i = 1; i < standings.length; i++) {
      expect(standings[i - 1].points).toBeGreaterThanOrEqual(standings[i].points);
    }
  });
});
