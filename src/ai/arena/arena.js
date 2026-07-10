// docs/spec/ai-arena.md §5 — 두뇌 자동 대전 하네스 (순수 JS, DOM/React 비의존)
import { emptyBoard, inBounds } from '../../engine/board.js';
import { checkWin, checkDraw } from '../../engine/win.js';
import { isForbidden } from '../../engine/forbidden.js';

// 시드 PRNG (mulberry32) — Math.random 미사용, 시드 재현 가능
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// §5-4 판마다 서로 다른 시작 국면을 만들 무작위 오프닝 세트 (시드 기반)
export function randomOpenings(count, options = {}) {
  const { stones = 4, seed = 1, radius = 4 } = options;
  const rng = mulberry32(seed);
  const CENTER = 7;
  const books = [];
  for (let g = 0; g < count; g++) {
    const board = emptyBoard();
    const moves = [];
    let color = 'B';
    let guard = 0;
    while (moves.length < stones && guard < 10000) {
      guard++;
      const row = CENTER + Math.floor(rng() * (2 * radius + 1)) - radius;
      const col = CENTER + Math.floor(rng() * (2 * radius + 1)) - radius;
      if (!inBounds(row, col) || board[row][col] !== null) continue;
      if (color === 'B' && isForbidden(board, row, col, 'B')) continue;
      board[row][col] = color;
      moves.push({ row, col });
      color = color === 'B' ? 'W' : 'B';
    }
    books.push(moves);
  }
  return books;
}

const clock = () => (typeof performance !== 'undefined' ? performance.now() : 0);

function isLegal(board, move) {
  return (
    move != null &&
    Number.isInteger(move.row) &&
    Number.isInteger(move.col) &&
    inBounds(move.row, move.col) &&
    board[move.row][move.col] === null
  );
}

// §5-1 한 판을 끝까지 둔다
export function playGame(playerB, playerW, options = {}) {
  const { maxMoves = 225, openingMoves = [] } = options;
  const board = emptyBoard();
  const history = [];
  let thinkMsB = 0;
  let thinkMsW = 0;

  const result = (winner, reason, offender = null) => ({
    winner,
    moves: history.length,
    reason,
    offender,
    thinkMsB,
    thinkMsW,
    history,
  });

  // 강제 초기 수 배치 (흑, 백, 흑… 순)
  let color = 'B';
  for (const m of openingMoves) {
    board[m.row][m.col] = color;
    history.push({ row: m.row, col: m.col, color });
    color = color === 'B' ? 'W' : 'B';
  }

  while (history.length < maxMoves) {
    const player = color === 'B' ? playerB : playerW;
    const opp = color === 'B' ? 'W' : 'B';

    let move;
    const t0 = clock();
    try {
      move = player.getMove(board, color);
    } catch {
      return result(opp, 'EXCEPTION', color);
    } finally {
      const dt = clock() - t0;
      if (color === 'B') thinkMsB += dt;
      else thinkMsW += dt;
    }

    if (!isLegal(board, move)) {
      return result(opp, 'ILLEGAL_MOVE', color);
    }

    // 흑 금수 자리 착수 → 흑 패 (5목 완성 수는 isForbidden이 false 반환)
    if (color === 'B' && isForbidden(board, move.row, move.col, 'B')) {
      return result('W', 'FORBIDDEN_MOVE', 'B');
    }

    board[move.row][move.col] = color;
    history.push({ row: move.row, col: move.col, color });

    if (checkWin(board, move.row, move.col, color)) {
      return result(color, 'FIVE');
    }
    if (checkDraw(board)) {
      return result('draw', 'DRAW');
    }
    color = opp;
  }

  return result('draw', 'MAX_MOVES');
}

const nameOf = (player, fallback) => player.name || player.constructor?.name || fallback;

// §5-2 두 두뇌를 games판 맞붙인다 (색 교대로 선공 이점 상쇄)
export function playMatch(playerA, playerB, options = {}) {
  const { games = 100, alternate = true, onGame } = options;
  const nameA = options.labelA ?? nameOf(playerA, 'A');
  const nameB = options.labelB ?? nameOf(playerB, 'B');

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let illegalA = 0;
  let illegalB = 0;
  let totalMoves = 0;

  for (let i = 0; i < games; i++) {
    const aIsBlack = alternate ? i % 2 === 0 : true;
    const black = aIsBlack ? playerA : playerB;
    const white = aIsBlack ? playerB : playerA;
    const openingMoves = options.makeOpening ? options.makeOpening(i) : options.openingMoves;
    const r = playGame(black, white, { ...options, openingMoves });
    totalMoves += r.moves;

    // 흑/백 결과를 A/B로 환원
    const sideOf = (c) => (c === 'B') === aIsBlack ? 'A' : 'B';
    if (r.winner === 'draw') draws++;
    else if (sideOf(r.winner) === 'A') winsA++;
    else winsB++;

    if (r.offender) {
      if (sideOf(r.offender) === 'A') illegalA++;
      else illegalB++;
    }

    // 같은 한 판에서 기보 수집 (중복 대국 없이 저장·집계 동시)
    if (onGame) {
      onGame({
        playerB: aIsBlack ? nameA : nameB,
        playerW: aIsBlack ? nameB : nameA,
        winner: r.winner,
        reason: r.reason,
        moves: r.history,
      });
    }
  }

  const total = winsA + winsB + draws;
  return {
    nameA,
    nameB,
    winsA,
    winsB,
    draws,
    winRateA: total ? winsA / total : 0,
    avgMoves: total ? totalMoves / total : 0,
    illegalA,
    illegalB,
  };
}

// §5-3 라운드로빈 — 모든 두뇌 쌍을 맞붙이고 승점순 순위 산출
export function runTournament(entries, options = {}) {
  const table = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const m = playMatch(a.player, b.player, { ...options, labelA: a.name, labelB: b.name });
      table.push({ ...m, nameA: a.name, nameB: b.name });
    }
  }

  const stats = new Map(
    entries.map((e) => [
      e.name,
      { name: e.name, wins: 0, losses: 0, draws: 0, points: 0, illegal: 0 },
    ]),
  );
  for (const m of table) {
    const A = stats.get(m.nameA);
    const B = stats.get(m.nameB);
    A.wins += m.winsA;
    A.losses += m.winsB;
    A.draws += m.draws;
    A.illegal += m.illegalA;
    B.wins += m.winsB;
    B.losses += m.winsA;
    B.draws += m.draws;
    B.illegal += m.illegalB;
  }
  for (const s of stats.values()) {
    s.points = s.wins * 3 + s.draws;
  }
  const standings = [...stats.values()].sort((a, b) => b.points - a.points);
  return { table, standings };
}
