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
      // depth 6 + 트랜스포지션 테이블/반복심화 (docs/spec/ai.md §7-4). d4보다 강하며 실전 속도 확보.
      return new MinimaxPlayer({ depth: 6, candidateLimit: 8, defenseWeight: 1.2, vcf: true, tt: true });
  }
}
