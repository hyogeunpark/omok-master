// docs/spec/ai-arena.md §6 — 기보 저장 & 자동 복기(패착 분석). 순수 JS.
import fs from 'node:fs';
import { emptyBoard } from '../../engine/board.js';
import { evaluateBoard } from '../evaluate.js';

// §6-3 패착 임계값 기본값 (evaluate.js 스케일: 열린4=10000, 사=1000, 열린3=500)
export const DEFAULT_BLUNDER_DROP = 5000;

// §6-1 기보 저장 — JSONL append (한 줄 = 한 대국)
export function saveGames(records, path) {
  const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.appendFileSync(path, lines);
}

export function loadGames(path) {
  const text = fs.readFileSync(path, 'utf8');
  return text
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}

// §6-2 한 대국을 재생하며 매 수의 국면을 평가, 패착을 표시
export function reviewGame(record, options = {}) {
  const { blunderDrop = DEFAULT_BLUNDER_DROP } = options;
  const moves = record.moves;
  const board = emptyBoard();
  const timeline = [];

  for (let i = 0; i < moves.length; i++) {
    const { row, col, color } = moves[i];

    // 착수 직전, 두는 색 관점
    const scoreBefore = evaluateBoard(board, color);

    // 내 착수 반영
    board[row][col] = color;

    // 상대의 즉시 응수(다음 ply)까지 반영 후, 같은 색 관점.
    // 마지막 수라 응수가 없으면 착수 직후 점수를 쓴다.
    const reply = moves[i + 1];
    let placedReply = false;
    if (reply) {
      board[reply.row][reply.col] = reply.color;
      placedReply = true;
    }
    const scoreAfter = evaluateBoard(board, color);
    if (placedReply) {
      board[reply.row][reply.col] = null; // 응수는 되돌림 (다음 반복에서 정식 반영)
    }

    const delta = scoreAfter - scoreBefore;
    timeline.push({
      ply: i + 1,
      color,
      move: { row, col },
      scoreBefore,
      scoreAfter,
      delta,
      blunder: delta <= -blunderDrop,
    });
  }

  const blunders = timeline.filter((m) => m.blunder);

  // §6-3 turningPly — 진 두뇌가 둔 수 중 delta 최저
  let turningPly = null;
  if (record.winner === 'B' || record.winner === 'W') {
    const loser = record.winner === 'B' ? 'W' : 'B';
    const loserMoves = timeline.filter((m) => m.color === loser);
    if (loserMoves.length > 0) {
      const worst = loserMoves.reduce((a, b) => (b.delta < a.delta ? b : a));
      turningPly = worst.ply;
    }
  }

  return { winner: record.winner, timeline, blunders, turningPly };
}
