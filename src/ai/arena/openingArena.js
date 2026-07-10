// docs/spec/ai-arena.md §5-5, §5-6 — 오프닝(타라구치-10) 포함 대전.
// 엔진의 오프닝 상태기계를 그대로 재사용한다(재구현 금지).
import {
  createGame,
  placeStone,
  performOpeningSwap,
  skipOpeningSwap,
  selectOpeningBranch,
  addOpeningCandidate,
  pickOpeningCandidate,
} from '../../engine/game.js';
import { isInOpeningZone } from '../../engine/opening.js';
import { mulberry32 } from './arena.js';

// §5-5-1 오프닝 place 다양화 — 구역 내 무작위 빈칸 (1수는 정중앙만)
function randomZoneMove(board, step, branch, rng) {
  const cells = [];
  for (let r = 0; r < 15; r++)
    for (let c = 0; c < 15; c++)
      if (board[r][c] === null && isInOpeningZone(r, c, step, branch)) cells.push({ row: r, col: c });
  if (cells.length === 0) return null;
  return cells[Math.floor(rng() * cells.length)];
}

// 현재 상태에서 '행동해야 할 색' (Game.jsx getCpuOpeningAction과 동일 규칙)
function actionColor(game) {
  const op = game.opening;
  if (!op) return game.currentTurn; // 오프닝 종료 → 일반 대국
  const { phase, step, branch } = op;
  if (phase === 'place') return game.currentTurn;
  if (phase === 'await-swap') {
    if (step === 1) return 'W';
    if (step === 2) return 'B';
    if (step === 3) return 'W';
    if (step === 4 && branch === 1) return 'B';
    if (step === 5 && branch === 1) return 'W';
    return null;
  }
  if (phase === 'await-branch') return 'W';
  if (phase === 'await-candidates') return 'B';
  if (phase === 'await-candidate-pick') return 'W';
  return null;
}

// 한 상태에서 해당 두뇌의 행동을 적용 (Game.jsx의 CPU 핸들러와 동일)
function applyAction(game, brain) {
  const op = game.opening;
  const snap = () => game.board.map((r) => [...r]);

  if (!op) {
    const color = game.currentTurn;
    const m = brain.getMove(snap(), color);
    return placeStone(game, m.row, m.col);
  }
  switch (op.phase) {
    case 'place': {
      const m = brain.getOpeningMove(snap(), game.currentTurn, op.step, op.branch);
      return placeStone(game, m.row, m.col);
    }
    case 'await-swap': {
      const justPlayed = op.step % 2 === 1 ? 'B' : 'W';
      return brain.shouldSwap(snap(), justPlayed) ? performOpeningSwap(game) : skipOpeningSwap(game);
    }
    case 'await-branch':
      return selectOpeningBranch(game, brain.selectBranch(snap()));
    case 'await-candidates': {
      let next = game;
      for (const { row, col } of brain.proposeOpeningCandidates(snap())) {
        next = addOpeningCandidate(next, row, col);
      }
      return next;
    }
    case 'await-candidate-pick': {
      const pick = brain.pickOpeningCandidate(snap(), op.candidates);
      return pickOpeningCandidate(game, pick.row, pick.col);
    }
    default:
      return game;
  }
}

// 상태가 진전됐는지 (무진전 = 반칙/멈춤 감지)
function progressed(before, after) {
  return (
    before.histLen !== after.history.length ||
    before.phase !== after.opening?.phase ||
    before.step !== after.opening?.step ||
    before.turn !== after.currentTurn ||
    before.candLen !== (after.opening?.candidates?.length ?? -1) ||
    (before.phase != null && after.opening == null)
  );
}

const snapshot = (game) => ({
  histLen: game.history.length,
  phase: game.opening?.phase ?? null,
  step: game.opening?.step ?? null,
  turn: game.currentTurn,
  candLen: game.opening?.candidates?.length ?? -1,
});

// §5-5 오프닝 포함 단판
export function playOpeningGame(brainA, brainB, options = {}) {
  const { aStartColor = 'B', maxMoves = 225, rng = null } = options;
  let game = createGame({ playerColor: aStartColor, useOpening: true });
  // brainA = player 역할(playerColor), brainB = cpu 역할(cpuColor). 스왑을 자동 추종.
  const brainOf = (color) => (color === game.playerColor ? brainA : brainB);
  const sideOfBrain = (brain) => (brain === brainA ? 'A' : 'B');

  let swaps = 0;
  let guard = 0;
  const GUARD_MAX = 500;

  const result = (winner, winnerColor, reason, offender = null) => ({
    winner,
    winnerColor,
    reason,
    offender,
    swaps,
    aColor: game.playerColor,
    moves: game.history,
  });

  while (game.status === 'playing' && game.history.length < maxMoves && guard < GUARD_MAX) {
    guard++;
    const color = actionColor(game);
    if (color == null) break; // 도달 불가(방어)
    const brain = brainOf(color);
    const wasPlace = game.opening == null || game.opening.phase === 'place';
    const playerColorBefore = game.playerColor;
    const before = snapshot(game);

    let next;
    try {
      // §5-5-1 다양화: 오프닝 place 수를 구역 내 무작위로 (1수 중앙은 그대로)
      if (rng && game.opening && game.opening.phase === 'place') {
        const m = randomZoneMove(game.board, game.opening.step, game.opening.branch, rng);
        next = m ? placeStone(game, m.row, m.col) : applyAction(game, brain);
      } else {
        next = applyAction(game, brain);
      }
    } catch {
      const off = sideOfBrain(brain);
      return result(off === 'A' ? 'B' : 'A', color === 'B' ? 'W' : 'B', 'EXCEPTION', off);
    }

    // 반칙(place가 무진전) → 행동 두뇌 패
    if (wasPlace && next.history.length === before.histLen && next.status === 'playing') {
      const off = sideOfBrain(brain);
      return result(off === 'A' ? 'B' : 'A', color === 'B' ? 'W' : 'B', 'ILLEGAL_MOVE', off);
    }
    if (next.playerColor !== playerColorBefore) swaps++;

    if (!progressed(before, next)) break; // 예기치 못한 멈춤 → 무승부 처리
    game = next;
  }

  // 결과 판정
  if (game.status === 'black-wins' || game.status === 'white-wins') {
    const winnerColor = game.status === 'black-wins' ? 'B' : 'W';
    const lastColor = game.history[game.history.length - 1]?.color;
    // 백승 + 마지막이 흑수 = 흑 금수패
    const reason = winnerColor === 'W' && lastColor === 'B' ? 'FORBIDDEN' : 'FIVE';
    const winner = winnerColor === game.playerColor ? 'A' : 'B';
    return result(winner, winnerColor, reason);
  }
  if (game.status === 'draw') return result('draw', 'draw', 'DRAW');
  return result('draw', 'draw', 'MAX_MOVES');
}

const nameOf = (b, fallback) => b.name || b.constructor?.name || fallback;

// §5-6 오프닝 포함 매치 — aStartColor 교대로 다판, A/B 기준 집계
export function openingMatch(brainA, brainB, options = {}) {
  const { games = 100, onGame, seed = null } = options;
  const nameA = options.labelA ?? nameOf(brainA, 'A');
  const nameB = options.labelB ?? nameOf(brainB, 'B');

  let winsA = 0;
  let winsB = 0;
  let draws = 0;
  let illegalA = 0;
  let illegalB = 0;
  let totalMoves = 0;
  let totalSwaps = 0;

  for (let i = 0; i < games; i++) {
    const aStartColor = i % 2 === 0 ? 'B' : 'W';
    // 판마다 시드 seed+i 기반 rng (모든 매치가 같은 시드열 공유 → 공정·재현)
    const rng = seed != null ? mulberry32(seed + i) : undefined;
    const r = playOpeningGame(brainA, brainB, { ...options, aStartColor, rng });
    totalMoves += r.moves.length;
    totalSwaps += r.swaps;

    if (r.winner === 'draw') draws++;
    else if (r.winner === 'A') winsA++;
    else winsB++;

    if (r.offender === 'A') illegalA++;
    else if (r.offender === 'B') illegalB++;

    if (onGame) {
      // 종료 시점 색으로 라벨링 (스왑 반영)
      const aIsBlack = r.aColor === 'B';
      onGame({
        playerB: aIsBlack ? nameA : nameB,
        playerW: aIsBlack ? nameB : nameA,
        winner: r.winnerColor,
        reason: r.reason,
        moves: r.moves,
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
    avgSwaps: total ? totalSwaps / total : 0,
    illegalA,
    illegalB,
  };
}

// §5-6 오프닝 포함 라운드로빈
export function openingTournament(entries, options = {}) {
  const table = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      const m = openingMatch(a.player, b.player, { ...options, labelA: a.name, labelB: b.name });
      table.push({ ...m, nameA: a.name, nameB: b.name });
    }
  }

  const stats = new Map(
    entries.map((e) => [e.name, { name: e.name, wins: 0, losses: 0, draws: 0, points: 0, illegal: 0 }]),
  );
  for (const m of table) {
    const A = stats.get(m.nameA);
    const B = stats.get(m.nameB);
    A.wins += m.winsA; A.losses += m.winsB; A.draws += m.draws; A.illegal += m.illegalA;
    B.wins += m.winsB; B.losses += m.winsA; B.draws += m.draws; B.illegal += m.illegalB;
  }
  for (const s of stats.values()) s.points = s.wins * 3 + s.draws;
  const standings = [...stats.values()].sort((a, b) => b.points - a.points);
  return { table, standings };
}
