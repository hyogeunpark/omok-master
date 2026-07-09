// docs/spec/ai-arena.md §7 — CLI 실행 스크립트 (Node 직접 실행, 빌드 불필요)
//
//   node scripts/arena.mjs                 # easy/normal/hard 라운드로빈, 각 매치 20판
//   node scripts/arena.mjs --games 100     # 판 수 지정
//   node scripts/arena.mjs --save games.jsonl    # 전 대국 기보 저장(복기용)
//   node scripts/arena.mjs --review games.jsonl  # 저장된 기보 복기 → 패착 요약
//   node scripts/arena.mjs --verbose       # 사고시간 컬럼 추가
import { createAiPlayer } from '../src/ai/createAiPlayer.js';
import { runTournament, randomOpenings } from '../src/ai/arena/arena.js';
import { saveGames, loadGames, reviewGame } from '../src/ai/arena/review.js';

function parseArgs(argv) {
  const opts = { games: 20, verbose: false, save: null, review: null, openings: 4, seed: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--games') opts.games = Number(argv[++i]);
    else if (a === '--openings') opts.openings = Number(argv[++i]);
    else if (a === '--seed') opts.seed = Number(argv[++i]);
    else if (a === '--verbose') opts.verbose = true;
    else if (a === '--save') opts.save = argv[++i];
    else if (a === '--review') opts.review = argv[++i];
  }
  return opts;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function padStart(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function entries() {
  return [
    { name: 'Heuristic(easy)', player: createAiPlayer('easy') },
    { name: 'Minimax(d2)', player: createAiPlayer('normal') },
    { name: 'Minimax(d4)', player: createAiPlayer('hard') },
  ];
}

function reviewMode(file) {
  const games = loadGames(file);
  console.log(`\nReview — ${games.length} games from ${file}\n`);
  games.forEach((g, idx) => {
    const rv = reviewGame(g);
    const nBlunder = rv.blunders.length;
    const turn = rv.turningPly ? `ply ${rv.turningPly}` : '—';
    console.log(
      `#${padStart(idx + 1, 3)}  ${pad(`${g.playerB}(B) vs ${g.playerW}(W)`, 40)}` +
        `승자 ${pad(g.winner, 5)} 패착 ${padStart(nBlunder, 2)}  turning ${turn}`,
    );
  });
}

function tournamentMode(opts) {
  const list = entries();
  const collected = [];
  const saveHook = opts.save
    ? (record) => collected.push(record)
    : null;

  // §5-4 시드 기반 오프닝 북 — 결정적 두뇌 표본 다양화. 모든 매치가 같은 북을 공유(공정).
  const book = opts.openings > 0
    ? randomOpenings(opts.games, { stones: opts.openings, seed: opts.seed })
    : null;
  const makeOpening = book ? (i) => book[i] : undefined;
  // onGame으로 집계와 같은 한 판에서 기보를 모은다 (게임을 두 번 두지 않음)
  const matchOpts = { games: opts.games, makeOpening, onGame: saveHook ?? undefined };

  const openingDesc = book
    ? `${opts.openings} random opening stones (seed ${opts.seed})`
    : 'empty start (deterministic brains → fixed samples)';
  console.log(
    `\nArena — ${list.length} brains, ${opts.games} games/match, alternating colors\n` +
      `Openings: ${openingDesc}\n`,
  );

  const { table, standings } = runTournament(list, matchOpts);

  if (saveHook) {
    saveGames(collected, opts.save);
    console.log(`\n기보 ${collected.length}판을 ${opts.save}에 저장했습니다 (복기: --review ${opts.save}).`);
  }

  const head = opts.verbose
    ? `${pad('Match', 34)}${padStart('winA', 6)}${padStart('winB', 6)}${padStart('draw', 6)}${padStart('winRateA', 10)}${padStart('msA', 8)}${padStart('msB', 8)}`
    : `${pad('Match', 34)}${padStart('winA', 6)}${padStart('winB', 6)}${padStart('draw', 6)}${padStart('winRateA', 10)}`;
  console.log(head);
  for (const m of table) {
    let line =
      pad(`${m.nameA} vs ${m.nameB}`, 34) +
      padStart(m.winsA, 6) +
      padStart(m.winsB, 6) +
      padStart(m.draws, 6) +
      padStart(m.winRateA.toFixed(2), 10);
    console.log(line);
  }

  console.log(
    `\n${pad('Standings', 20)}${padStart('W', 5)}${padStart('L', 5)}${padStart('D', 5)}${padStart('Pts', 6)}${padStart('illegal', 9)}`,
  );
  for (const s of standings) {
    console.log(
      pad(s.name, 20) +
        padStart(s.wins, 5) +
        padStart(s.losses, 5) +
        padStart(s.draws, 5) +
        padStart(s.points, 6) +
        padStart(s.illegal, 9),
    );
  }
}

const opts = parseArgs(process.argv.slice(2));
if (opts.review) {
  reviewMode(opts.review);
} else {
  tournamentMode(opts);
}
