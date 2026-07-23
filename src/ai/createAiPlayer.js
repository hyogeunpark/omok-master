// docs/spec/ai-player.md §3 팩토리
import { HeuristicPlayer } from './players/HeuristicPlayer.js';
import { MinimaxPlayer } from './players/MinimaxPlayer.js';

export function createAiPlayer(difficulty) {
  switch (difficulty) {
    case 'easy':
      return new HeuristicPlayer();
    case 'normal':
      // §7-6 전 구간 랜덤(margin 100) — 얕은 평가라 무손실, 판 모양 다양화.
      return new MinimaxPlayer({ depth: 2, candidateLimit: 10, defenseWeight: 1.0, margin: 100 });
    case 'hard':
    default:
      // depth 6 + TT/반복심화(§7-4) + 강제 수 연장/node 캡(§7-5). 강제 수순을 깊이 읽어 d6보다 강함.
      // §7-6 초반(돌 ≤12)만 랜덤(margin 600) — 오프닝 모양 다양화, 이후 최선으로 강함 유지.
      return new MinimaxPlayer({
        depth: 6, candidateLimit: 8, defenseWeight: 1.2,
        vcf: true, tt: true, ext: 8, nodeBudget: 10000,
        margin: 600, randomUntilStones: 12,
      });
  }
}
