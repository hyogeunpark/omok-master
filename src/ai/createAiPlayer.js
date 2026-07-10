// docs/spec/ai-player.md §3 팩토리
import { HeuristicPlayer } from './players/HeuristicPlayer.js';
import { MinimaxPlayer } from './players/MinimaxPlayer.js';

export function createAiPlayer(difficulty) {
  switch (difficulty) {
    case 'easy':
      return new HeuristicPlayer();
    case 'normal':
      return new MinimaxPlayer({ depth: 2, candidateLimit: 10, defenseWeight: 1.0 });
    case 'hard':
    default:
      // depth 6 + TT/반복심화(§7-4) + 강제 수 연장/node 캡(§7-5). 강제 수순을 깊이 읽어 d6보다 강함.
      return new MinimaxPlayer({
        depth: 6, candidateLimit: 8, defenseWeight: 1.2,
        vcf: true, tt: true, ext: 8, nodeBudget: 10000,
      });
  }
}
