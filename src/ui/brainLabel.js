// CPU 두뇌(탐색 방식) 표시 — 난이도 카드·게임 화면 공용 (docs/spec/ai.md §2-2, docs/spec/game-hud.md)

// 난이도 카드용 한 줄 문구
export const BRAIN_LABEL = {
  easy: '1수 앞 · 즉시 위협만',
  normal: '2수 앞 미니맥스',
  hard: '6수 앞 · 강제수 읽기 (VCF)',
};

// 게임 HUD readout용 구조화 메타 — 깊이 숫자는 모노, 태그는 pill로 렌더 (docs/spec/game-hud.md §4)
export const BRAIN_META = {
  easy: { depth: 1, method: '즉시 위협만' },
  normal: { depth: 2, method: '미니맥스' },
  hard: { depth: 6, method: '강제수 읽기', tag: 'VCF' },
};
