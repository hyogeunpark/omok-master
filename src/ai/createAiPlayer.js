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
      return new MinimaxPlayer({ depth: 4, candidateLimit: 8, defenseWeight: 1.2, vcf: true });
  }
}
