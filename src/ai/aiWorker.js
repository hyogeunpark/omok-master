// docs/spec/ai-player.md §6-A — AI 탐색 Web Worker.
// 일반 대국 getMove를 별도 스레드에서 실행하고, 반복심화 깊이를 실시간 보고한다.
import { createAiPlayer } from './createAiPlayer.js';

const players = {};
const getPlayer = (difficulty) => (players[difficulty] ??= createAiPlayer(difficulty));

self.onmessage = (e) => {
  const { board, color, difficulty, reqId } = e.data;
  const player = getPlayer(difficulty);
  const onDepth = (depth) => self.postMessage({ type: 'depth', depth, reqId });

  try {
    const move = player.getMove(board, color, onDepth);
    self.postMessage({ type: 'move', move, reqId });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err && err.message || err), reqId });
  }
};
