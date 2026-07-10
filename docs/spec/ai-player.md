# AI 플레이어 인터페이스 스펙

> `docs/spec/ai.md` 알고리즘 스펙 전제.
> CPU의 모든 판단을 단일 인터페이스로 추상화하여 구현체를 교체 가능하게 만드는 아키텍처 스펙.

---

## 1. 목적

현재 `cpu.js`는 난이도별 알고리즘을 내부에 하드코딩하고, `Game.jsx`가 여러 함수를 직접 호출한다.
이를 **Strategy 패턴**으로 재설계하여:

- `Game.jsx`는 `AiPlayer` 인터페이스만 알고 구현체를 모른다.
- 알고리즘(Minimax, MCTS, Neural 등)을 코드 수정 없이 교체할 수 있다.
- 테스트 시 Mock 구현체를 주입할 수 있다.

---

## 2. AiPlayer 인터페이스

JS는 명시적 인터페이스가 없으므로 **JSDoc + 덕 타이핑**으로 정의한다.
모든 구현체는 아래 6개 메서드를 반드시 구현해야 한다.

```js
/**
 * @typedef {Object} AiPlayer
 *
 * 일반 대국
 * @property {(board: string[][], color: 'B'|'W') => {row:number, col:number}} getMove
 *
 * 오프닝: 지정 구역에 돌 배치
 * @property {(board, color, step, branch) => {row, col}} getOpeningMove
 *
 * 오프닝: 스왑 여부 결정
 * @property {(board, justPlayedColor: 'B'|'W') => boolean} shouldSwap
 *
 * 오프닝: 선택 1 vs 선택 2
 * @property {(board) => 1|2} selectBranch
 *
 * 오프닝: 후보 10개 제시 (흑)
 * @property {(board) => {row, col}[]} proposeOpeningCandidates
 *
 * 오프닝: 후보 중 1개 선택 (백)
 * @property {(board, candidates: {row,col}[]) => {row, col}} pickOpeningCandidate
 */
```

---

## 3. 팩토리

```js
// src/ai/createAiPlayer.js
createAiPlayer(difficulty: 'easy' | 'normal' | 'hard'): AiPlayer
```

| difficulty | 반환 구현체 |
|-----------|------------|
| `easy` | `HeuristicPlayer` |
| `normal` | `MinimaxPlayer({ depth: 2, candidateLimit: 10, defenseWeight: 1.0 })` |
| `hard` | `MinimaxPlayer({ depth: 6, candidateLimit: 8, defenseWeight: 1.2, vcf: true, tt: true, ext: 8, nodeBudget: 10000 })` |

---

## 4. 구현체

### 4-1. HeuristicPlayer (`src/ai/players/HeuristicPlayer.js`)

`docs/spec/ai.md §2` easy 로직 그대로 이전.

| 메서드 | 동작 |
|--------|------|
| `getMove` | 즉시 승리 → 즉시 차단 → 35% 랜덤(반경 3) → 휴리스틱 최선 |
| `getOpeningMove` | 오프닝 구역 내 최고 점수 수 |
| `shouldSwap` | 항상 `false` |
| `selectBranch` | 50% 확률로 1 또는 2 |
| `proposeOpeningCandidates` | 점수 순 상위 10개, 대칭 중복 제거 |
| `pickOpeningCandidate` | 후보 중 최고 점수 수 |

### 4-2. MinimaxPlayer (`src/ai/players/MinimaxPlayer.js`)

`docs/spec/ai.md §7` Minimax 로직 이전. 생성 시 파라미터 주입.

```js
new MinimaxPlayer({ depth, candidateLimit, defenseWeight, vcf = false, tt = false })
```

- `tt: true`이면 트랜스포지션 테이블 + 반복심화 탐색(`minimaxMoveTT`, `docs/spec/ai.md §7-4`)을 쓴다. depth 6을 실전 속도로.
- `ext`(연장 예산)·`nodeBudget`(최악 시간 캡)은 강제 수 탐색 연장(`docs/spec/ai.md §7-5`). 강제 수순을 깊이 읽어 강함↑, 캡으로 응답시간 제한.

| 메서드 | 동작 |
|--------|------|
| `getMove` | `vcf=true`이면 VCF 선행 → Minimax |
| `getOpeningMove` | 오프닝 구역 내 최고 점수 수 |
| `shouldSwap` | `scorePosition` 기반 돌당 평균 점수 vs threshold |
| `selectBranch` | 흑 포석 강도 평가 후 결정 |
| `proposeOpeningCandidates` | 점수 순 상위 10개, 대칭 중복 제거 |
| `pickOpeningCandidate` | 후보 중 최고 점수 수 |

---

## 5. 파일 구조

```
src/ai/
  createAiPlayer.js          ← 팩토리 (신규)
  players/
    HeuristicPlayer.js       ← easy 구현체 (신규, cpu.js에서 이전)
    MinimaxPlayer.js         ← normal/hard 구현체 (신규, cpu.js에서 이전)
  evaluate.js                ← 변경 없음
  minimax.js                 ← 변경 없음
  vcf.js                     ← 변경 없음
  cpu.js                     ← 제거 (구현체로 완전 이전 후)
```

---

## 6. Game.jsx 변경

`App.jsx`에서 팩토리를 호출해 생성한 `player`를 `Game`에 prop으로 주입한다.

```jsx
// App.jsx
const player = createAiPlayer(gameConfig.difficulty);
<Game player={player} onExit={...} />

// Game.jsx
export default function Game({ player, onExit }) {
  // player.getMove(board, color)
  // player.getOpeningMove(board, color, step, branch)
  // player.shouldSwap(board, justPlayedColor)
  // player.selectBranch(board)
  // player.proposeOpeningCandidates(board)
  // player.pickOpeningCandidate(board, candidates)
}
```

`difficulty` prop은 `Game.jsx`에서 제거된다. 난이도 정보는 이미 `player` 구현체에 캡슐화돼 있다.

---

## 7. 완료 기준 (Acceptance)

| ID | 조건 |
|----|------|
| AC-P1 | `createAiPlayer('easy')` 반환 객체가 6개 메서드를 모두 가진다 |
| AC-P2 | `createAiPlayer('normal')` 반환 객체가 6개 메서드를 모두 가진다 |
| AC-P3 | `createAiPlayer('hard')` 반환 객체가 6개 메서드를 모두 가진다 |
| AC-P4 | Mock AiPlayer 주입 시 `Game.jsx`가 정상 동작한다 (기존 게임 흐름 유지) |
| AC-P5 | 기존 70개 테스트 전부 통과 (회귀 없음) |

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-13 | 최초 작성. Strategy 패턴으로 AI 아키텍처 재설계. |
