// docs/spec/ai-player.md §7 완료 기준 AC-P1~P3
import { describe, it, expect } from 'vitest';
import { createAiPlayer } from '../createAiPlayer.js';

const INTERFACE = [
  'getMove',
  'getOpeningMove',
  'shouldSwap',
  'selectBranch',
  'proposeOpeningCandidates',
  'pickOpeningCandidate',
];

for (const difficulty of ['easy', 'normal', 'hard']) {
  describe(`createAiPlayer('${difficulty}')`, () => {
    it('AiPlayer 인터페이스 6개 메서드를 모두 가진다', () => {
      const player = createAiPlayer(difficulty);
      for (const method of INTERFACE) {
        expect(typeof player[method], `${method} 누락`).toBe('function');
      }
    });
  });
}
