# AI 대전(Arena) 스펙

> `docs/spec/ai-player.md`(AiPlayer 인터페이스)와 `docs/spec/ai.md`(알고리즘) 전제.
> 두 개 이상의 두뇌(AiPlayer 구현체)를 자동으로 맞붙여 **두뇌별 강함·특성을 정량 비교**하기 위한 하네스 스펙.

---

## 1. 목적

Strategy 패턴(`ai-player.md`)으로 두뇌를 교체 가능하게 만든 것을 활용하여:

- 두뇌 A vs 두뇌 B를 사람 개입 없이 **다수 대국** 자동 실행.
- 승률·평균 수순·평균 사고시간을 집계해 **두뇌별 장단점을 데이터로 파악**.
- 그 결과를 근거로 파라미터를 조정하거나 **더 강한 두뇌를 도출**하는 실험 기반을 제공.

이 스펙은 **오프라인 실험 도구**다. 게임 UI(`src/ui`)와 무관하며, Node에서 단독 실행한다.

---

## 2. 범위

### 범위 안
- 두 두뇌를 맞붙이는 단판 대국 실행 (`playGame`).
- 색 교대·다판 반복으로 승률을 내는 매치 (`playMatch`).
- 여러 두뇌를 서로 다 붙이는 라운드로빈 (`runTournament`).
- 결과 집계·표 출력.
- **기보 저장** — 대국 전체 수순을 파일로 남겨 나중에 되짚기 (§6).
- **자동 복기(패착 분석)** — 매 수의 국면 점수를 매겨 **패착 수를 프로그램이 짚어준다** (§6). 두뇌 업그레이드의 직접 신호.
- **오프닝 포함 대전** — 타라구치-10 오프닝(스왑·분기·후보)까지 두 두뇌가 진행하는 실전형 대전 (§5-5). 자유 착수 대전과 **별도 모드**.

### 범위 밖
- 두뇌 파라미터 자동 탐색(자동 튜닝/유전 알고리즘). 결과 해석과 파라미터 결정은 **사람이 한다**.
- 패착 국면을 회귀/학습용 position 세트로 **자동 추출**하는 것 — 향후 확장(§10).
- 신경망 학습·self-play 데이터 생성.

---

## 3. 규칙 적용

Arena 대국은 렌주 룰을 그대로 적용한다. `docs/index.md §4` 공통 규칙 + `docs/spec/forbidden.md` 금수 규칙 전제.

- 15×15, 흑 선공, 흑·백 1수씩 교대.
- 승리: 한 방향 5목(흑 장목은 승리 아님).
- **흑 금수**: 흑이 금수 자리(3-3, 4-4, 장목)에 착수 → **즉시 흑 패**(백 승).
- 판이 다 차고 승자 없음 → 무승부.

### 3-1. 반칙 처리 (중요)

두뇌가 반환한 수가 규칙 위반이면 **그 두뇌의 즉시 패배**로 처리하고 사유를 기록한다. 이는 버그 탐지 신호로도 쓴다.

| 반칙 | 판정 | 사유 코드 |
|------|------|-----------|
| 점유된 교점 / 보드 밖 / `null` 반환 | 반환 두뇌 패 | `ILLEGAL_MOVE` |
| 흑이 금수 자리에 착수 | 흑 패 | `FORBIDDEN_MOVE` |
| `getMove`가 예외 throw | 반환 두뇌 패 | `EXCEPTION` |

---

## 4. 결정성(Determinism) 주의

- `MinimaxPlayer`는 입력이 같으면 **항상 같은 수**를 둔다. 따라서 같은 두뇌 쌍·같은 선공은 **매번 동일한 기보**가 나온다 → 여러 판을 돌려도 표본이 1개다.
- `HeuristicPlayer`는 35% 확률 랜덤이 있어 판마다 달라진다.

→ **결정적 두뇌끼리의 매치는 다판을 돌려도 승률이 0/100으로 고정**된다. 이를 감안하여:
- 색 교대(§5-2)로 최소 선공/후공 2케이스는 확보한다.
- 표본 다양화가 필요하면 `openingMoves`(§5-1) 옵션으로 **무작위 초기 수 n개**를 강제 배치한 뒤 대국을 시작한다. 초기 수는 시드 기반이어야 재현 가능하다.

---

## 5. API

파일: `src/ai/arena/arena.js` (순수 JS, DOM/React 비의존).

### 5-1. `playGame(playerB, playerW, options) => GameResult`

한 판을 끝까지 둔다.

```js
/**
 * @param {AiPlayer} playerB  흑을 두는 두뇌
 * @param {AiPlayer} playerW  백을 두는 두뇌
 * @param {Object}   [options]
 * @param {number}   [options.maxMoves=225]   안전 상한(초과 시 무승부 처리)
 * @param {{row,col}[]} [options.openingMoves] 대국 전 강제 배치할 초기 수(흑,백,흑…순)
 * @returns {GameResult}
 */
```

```js
/**
 * @typedef {Object} GameResult
 * @property {'B'|'W'|'draw'} winner
 * @property {number} moves                 총 착수 수
 * @property {string|null} reason           'FIVE'|'FORBIDDEN_MOVE'|'ILLEGAL_MOVE'|'EXCEPTION'|'DRAW'|'MAX_MOVES'
 * @property {'B'|'W'|null} offender         반칙으로 진 두뇌(반칙 아니면 null)
 * @property {number} thinkMsB              흑 총 사고시간(ms)
 * @property {number} thinkMsW              백 총 사고시간(ms)
 * @property {{row,col,color}[]} history     기보(재현·디버깅용)
 */
```

대국 루프(의사코드):

```
board = emptyBoard()
openingMoves 있으면 순서대로 배치
color = 'B'
while moves < maxMoves:
  player = (color==='B') ? playerB : playerW
  move = time( player.getMove(board, color) )     // 예외 → offender 패
  검증(move):                                       // 점유/범위/null → offender 패
    위반이면 return 패배 결과
  if color==='B' and isForbidden(board, move) → 흑 패 (FORBIDDEN_MOVE)
  board에 착수 반영
  if checkWin(board, move, color) → color 승 (FIVE)
  if checkDraw(board)            → 무승부 (DRAW)
  color = 상대색
return 무승부 (MAX_MOVES)
```

> 엔진 재사용: `emptyBoard`(board.js), `isForbidden`(forbidden.js), `checkWin`·`checkDraw`(win.js). Arena는 판정 로직을 **재구현하지 않는다**.

### 5-2. `playMatch(playerA, playerB, options) => MatchResult`

두 두뇌를 `games`판 맞붙인다. **색을 매 판 교대**해 선공 이점을 상쇄한다.

```js
/**
 * @param {number} [options.games=100]      총 판 수(짝수 권장)
 * @param {boolean}[options.alternate=true] true면 홀짝 판마다 선공 교대
 * @param {(i:number)=>{row,col}[]} [options.makeOpening]
 *        판마다 강제 초기 수를 주는 함수. i는 매치 내 판 번호(0부터).
 *        지정 시 각 판은 이 초기 수로 시작한다(§5-4). 결정적 두뇌 표본 다양화용.
 * @param {(record: GameRecord)=>void} [options.onGame]
 *        각 판이 끝날 때마다 그 판의 GameRecord(§6-1)를 넘겨받는 콜백.
 *        집계와 동시에 기보를 수집해 **게임을 한 번만 두게** 한다(중복 대국 방지).
 * @param {string} [options.labelA]  GameRecord/결과에 쓸 A의 표시 이름(미지정 시 player.name)
 * @param {string} [options.labelB]  GameRecord/결과에 쓸 B의 표시 이름
 * @returns {MatchResult}
 */
```

> `makeOpening(i)`는 **판 번호 i의 순수 함수**여야 한다. 같은 i는 어느 매치에서든 같은 초기 수를 내야, 모든 두뇌 쌍이 **동일한 시작 국면**을 놓고 겨뤄 비교가 공정하다.
>
> `onGame`으로 넘어오는 `GameRecord`의 `playerB`/`playerW`는 **그 판에서 실제로 흑/백을 둔 두뇌 이름**이다(색 교대 반영). 기보 저장과 승률 집계가 **같은 한 판**에서 나오므로 둘이 항상 일치한다.

```js
/**
 * @typedef {Object} MatchResult
 * @property {string} nameA
 * @property {string} nameB
 * @property {number} winsA        A 승수(색 무관)
 * @property {number} winsB
 * @property {number} draws
 * @property {number} winRateA     winsA / (winsA+winsB+draws)
 * @property {number} avgMoves
 * @property {number} illegalA     A의 반칙패 횟수
 * @property {number} illegalB
 */
```

### 5-3. `runTournament(entries, options) => TournamentResult`

여러 두뇌를 라운드로빈으로 전부 맞붙인다.

```js
/**
 * @param {{name:string, player:AiPlayer}[]} entries
 * @param {Object} [options]  playMatch 옵션 전달
 * @returns {{ table: MatchResult[], standings: {name, wins, losses, draws, points}[] }}
 */
```

- 승점: 승 3 / 무 1 / 패 0. `standings`는 승점 내림차순 정렬.
- 반칙패도 패로 집계하되 `illegal*` 카운트로 별도 노출(버그 두뇌 식별용).
- `options.onGame`을 그대로 하위 `playMatch`에 전달하고, 각 매치의 `labelA`/`labelB`를 **entry의 `name`**으로 지정한다. 따라서 `onGame` 기보의 두뇌 이름은 `d2`/`d4`처럼 entry 이름으로 구분된다(같은 `MinimaxPlayer`라도).

### 5-4. `randomOpenings(count, options) => {row,col}[][]`

§4에서 경고한 **결정성 문제**를 푸는 헬퍼. `MinimaxPlayer`처럼 결정적인 두뇌는 같은 시작 국면에서 매번 같은 기보를 낳는다. 판마다 **무작위 초기 수 몇 개를 강제로 깔아** 서로 다른 시작 국면을 만든다.

```js
/**
 * @param {number} count               만들 오프닝 개수(= 매치 판 수)
 * @param {Object} [options]
 * @param {number} [options.stones=4]   한 오프닝당 강제 착수 수(흑,백,흑…)
 * @param {number} [options.seed=1]     시드 — 같은 시드는 같은 오프닝 세트(재현 가능)
 * @param {number} [options.radius=4]   중앙(7,7) 기준 배치 반경
 * @returns {{row,col}[][]}             count개의 오프닝. 각 오프닝은 stones개의 좌표
 */
```

- **시드 기반 결정성**: 같은 `seed`는 항상 같은 오프닝 세트를 낸다(재현 가능). 내부 난수는 시드 PRNG를 쓰고 `Math.random`을 쓰지 않는다.
- 좌표는 중앙 반경 내 **서로 다른 빈 교점**이며, 흑 차례 좌표는 **금수 자리를 피한다**(`isForbidden`).
- 색은 배치 순서대로 흑·백·흑… 교대(= `playGame`의 `openingMoves` 적용 규칙과 동일).
- 사용법: `const book = randomOpenings(games, { stones, seed }); playMatch(a, b, { games, makeOpening: (i) => book[i] })`.

### 5-5. 오프닝 포함 대전 — `playOpeningGame(brainA, brainB, options) => OpeningResult`

자유 착수(§5-1~5-4)와 **별도 모드**. 두 두뇌가 **타라구치-10 오프닝**(스왑·분기·후보 제시/선택)까지
진행한 뒤 일반 렌주로 이어 둔다. **엔진의 오프닝 상태기계를 그대로 재사용**한다(재구현 금지):
`createGame({useOpening:true})` + `placeStone`/`performOpeningSwap`/`skipOpeningSwap`/`selectOpeningBranch`/`addOpeningCandidate`/`pickOpeningCandidate` (`src/engine/game.js`).

**두뇌↔색 매핑**: `brainA`는 "player 역할"(=`game.playerColor`), `brainB`는 "cpu 역할"(=`game.cpuColor`)을 맡는다.
스왑은 `playerColor`/`cpuColor`를 교환하므로, 각 두뇌가 맡는 색은 스왑을 따라 자동으로 바뀐다
(스왑 = "그 두뇌가 상대 색을 넘겨받음"). 어느 색이 행동할지는 상태마다 하나로 정해진다:

| 상태(phase) | 행동 색 | 두뇌 호출 (Game.jsx와 동일) |
|-------------|---------|------------------------------|
| `place` | `currentTurn` | `getOpeningMove(board, color, step, branch)` |
| `await-swap` | swapOwner(step,branch) | `shouldSwap(board, justPlayed)` |
| `await-branch` | `W` | `selectBranch(board)` |
| `await-candidates` | `B` | `proposeOpeningCandidates(board)` |
| `await-candidate-pick` | `W` | `pickOpeningCandidate(board, candidates)` |
| 오프닝 종료 후 | `currentTurn` | `getMove(board, color)` |

```js
/**
 * @param {AiPlayer} brainA, brainB
 * @param {Object} [options]
 * @param {'B'|'W'} [options.aStartColor='B']  brainA가 시작 시 맡을 색(공정성 위해 매 판 교대)
 * @param {number}  [options.maxMoves=225]
 * @param {()=>number} [options.rng]  주면 오프닝 **place 수를 구역 내 무작위**로 둔다(§5-5-1).
 *                                     스왑·분기·후보 결정은 여전히 두뇌가 한다.
 * @returns {OpeningResult}
 */
/**
 * @typedef {Object} OpeningResult
 * @property {'A'|'B'|'draw'} winner   두뇌 기준 승자
 * @property {'B'|'W'|'draw'} winnerColor
 * @property {string} reason           'FIVE'|'FORBIDDEN'|'DRAW'|'MAX_MOVES'|'ILLEGAL_MOVE'|'EXCEPTION'
 * @property {'A'|'B'|null} offender    반칙으로 진 두뇌
 * @property {number} swaps            성사된 스왑 횟수
 * @property {'B'|'W'} aColor          종료 시 brainA의 색
 * @property {{row,col,color}[]} moves  기보(오프닝 포함)
 */
```

- 오프닝 중에는 금수 판정이 없다(스펙 `opening.md §5`). 6수 완료 후부터 금수·승패 판정(엔진이 처리).
- `getOpeningMove`가 구역 밖/점유 자리를 반환해 `placeStone`이 무진전이면 그 두뇌 **반칙패**(`ILLEGAL_MOVE`).

#### 5-5-1. 결정성 & 다양화 (`rng`)

`MinimaxPlayer`는 결정적이라 `rng` 없이 같은 `aStartColor`면 오프닝 대국도 **완전히 동일**하다.
따라서 Minimax끼리는 색 배정 2케이스만 나오고(다판 돌려도 표본 2개), §4의 결정성 문제가 재현된다.

`rng`(시드 PRNG)를 주면 **오프닝 `place` 수를 해당 구역 내 무작위 빈칸**으로 둔다(1수는 정중앙 강제라 무작위 없음). 이렇게 시작 국면을 흔들면:
- 위치가 다양해져 **판마다 다른 대국**이 나온다(진짜 표본 확보).
- 흑 금수 자리는 오프닝 중 금수 판정이 없으므로 그대로 두어도 되나, 구역 내 빈칸만 고른다.
- **스왑·분기(`selectBranch`)·후보(`propose`/`pick`) 결정은 여전히 두뇌가** 한다 → 오프닝 판단력은 계속 테스트된다(위치만 중립 무작위).
- 시드 기반이라 **재현 가능**(`Math.random` 미사용).

### 5-6. `openingTournament(entries, options)`

`playOpeningGame`을 `aStartColor` 교대로 다판 돌려 라운드로빈 집계. 반환·집계 형식은 §5-2/§5-3과 동일(A/B 기준).
`onGame`으로 넘기는 `GameRecord`의 `playerB`/`playerW`는 **종료 시점 색**으로 라벨링한다(스왑 반영).

- `options.seed`(숫자)를 주면 판 `i`마다 시드 `seed+i` 기반 `rng`를 만들어 §5-5-1 다양화를 적용한다.
  모든 매치가 같은 시드열을 공유해 **두뇌 쌍 간 비교가 공정**하고 **재현 가능**하다. `seed` 미지정 시 다양화 없음.

---

## 6. 복기(Review) & 기보 저장

승률(§5)은 *어느 두뇌가 센가*만 알려준다. 두뇌를 **왜/어디서** 고쳐야 하는지는
각 대국을 되짚어 **패착(blunder)을 찾아야** 나온다. 이 절이 그 신호를 만든다.

파일: `src/ai/arena/review.js` (순수 JS, DOM 비의존).

### 6-1. 기보 저장

`GameResult.history`가 이미 전체 수순을 담는다. 이를 대국 메타와 함께 **JSONL**(한 줄=한 대국)로 남긴다.

```js
/**
 * @typedef {Object} GameRecord
 * @property {string} playerB          흑 두뇌 이름
 * @property {string} playerW          백 두뇌 이름
 * @property {'B'|'W'|'draw'} winner
 * @property {string} reason           GameResult.reason
 * @property {{row,col,color}[]} moves  기보(= GameResult.history)
 */

// review.js
saveGames(records: GameRecord[], path: string): void   // JSONL append
loadGames(path: string): GameRecord[]
```

> `records.js`(localStorage용)는 UI 전용이다. Arena는 Node 파일시스템에 저장하므로 **별도 함수**를 둔다(형식은 호환되게 유지).

### 6-2. `reviewGame(record, options) => GameReview`

한 대국을 처음부터 재생하며 **매 수 직후 국면을 평가**하고, 평가가 급락한 수를 패착으로 표시한다.

```js
/**
 * @param {GameRecord} record
 * @param {Object} [options]
 * @param {number} [options.blunderDrop=?]  패착 판정 임계값(§6-3)
 * @returns {GameReview}
 */
```

```js
/**
 * @typedef {Object} MoveReview
 * @property {number} ply              몇 번째 수(1부터)
 * @property {'B'|'W'} color
 * @property {{row,col}} move
 * @property {number} scoreBefore      착수 직전, 두는 색 관점 국면 점수
 * @property {number} scoreAfter       상대 응수까지 반영 후, 두는 색 관점 국면 점수
 * @property {number} delta            scoreAfter − scoreBefore (음수 클수록 나쁜 수)
 * @property {boolean} blunder         delta ≤ −blunderDrop 이면 true
 */

/**
 * @typedef {Object} GameReview
 * @property {'B'|'W'|'draw'} winner
 * @property {MoveReview[]} timeline
 * @property {MoveReview[]} blunders   패착만 추린 목록(패한 색 위주 확인용)
 * @property {number|null} turningPly  진 두뇌의 delta 최저 수(가장 결정적인 패착)
 */
```

- 국면 점수는 엔진의 `evaluateBoard(board, color)`(evaluate.js)를 **그대로 재사용**한다. Arena는 평가 로직을 재구현하지 않는다.
- `scoreBefore`/`scoreAfter`는 항상 **그 수를 두는 색 관점**으로 통일한다(상대 관점 부호 반전 주의).

### 6-3. 패착 판정 기준

**왜 "응수까지" 보는가.** 내 돌을 놓은 직후만 내 관점으로 재보면 `evaluateBoard`는 내 점수가 항상 오르므로(delta는 늘 양수) 나쁜 수를 잡지 못한다. 그래서 **상대의 다음 한 수까지 반영한 국면**을 내 관점으로 재서, "내 수가 상대에게 강한 응수를 허용했는가"를 측정한다.

- `scoreBefore` = 착수 직전, 두는 색 관점 `evaluateBoard`.
- `scoreAfter` = 내 착수 + **상대의 즉시 응수(다음 ply)**까지 반영한 뒤, 같은(두는 색) 관점 `evaluateBoard`. 마지막 수라 응수가 없으면 착수 직후 점수를 쓴다.
- `delta = scoreAfter − scoreBefore`. 상대에게 결정적 응수를 내준 수일수록 크게 음수.
- `delta ≤ −blunderDrop`이면 그 수를 **패착**으로 표시한다.
- `blunderDrop` 기본값 = **5000**. `evaluate.js` 스케일(5목 100000, 열린4 10000, 사(닫힌4) 1000, 열린3 500) 기준, 상대에게 **열린4급 이상 응수**를 허용한 급락을 패착으로 본다. 실측 후 조정 가능.
- `turningPly`는 **진 두뇌**가 둔 수 중 delta가 가장 낮은 ply — "이 판을 뒤집은 한 수".

### 6-4. 활용 흐름 (두뇌 업그레이드 루프)

```
runTournament → 진 매치의 기보 saveGames로 저장
  → reviewGame으로 패착·turningPly 추출
  → 그 국면에서 두뇌가 왜 나쁜 수를 뒀는지 확인 (평가함수? 탐색깊이?)
  → 두뇌 파라미터/로직 수정
  → 다시 Arena로 재대전해 승률 개선 확인
```

---

## 7. 실행 스크립트

파일: `scripts/arena.mjs` (Node 직접 실행, 빌드 불필요).

```
node scripts/arena.mjs                 # 기본: easy/normal/hard 라운드로빈, 각 매치 20판
node scripts/arena.mjs --games 100     # 판 수 지정
node scripts/arena.mjs --openings 4    # 판마다 무작위 초기 수 4개(결정적 두뇌 다양화)
node scripts/arena.mjs --seed 42       # 오프닝 시드(같은 시드=같은 대국들, 재현 가능)
node scripts/arena.mjs --save games.jsonl   # 전 대국 기보 저장(복기용)
node scripts/arena.mjs --review games.jsonl # 저장된 기보 복기 → 패착 요약 출력
node scripts/arena.mjs --opening            # 타라구치-10 오프닝 포함 대전 모드(§5-5)
node scripts/arena.mjs --opening --seed 42  # 오프닝 위치 시드 다양화(결정적 두뇌 표본 확보)
```

> 기본으로 `--openings`를 켜 둔다(기본 4수). `--openings 0`이면 순수 시작(빈 판)에서 대국하며, 이때 결정적 두뇌끼리는 §4대로 표본이 1~2개로 고정된다.
>
> `--save`는 `onGame`(§5-2)으로 집계와 같은 한 판에서 기보를 모은다. 즉 **게임을 두 번 두지 않으며**, 저장된 기보와 출력된 순위표는 정확히 같은 대국이다.

출력 예시(형식만 규정, 수치는 예시):

```
Arena — 3 brains, 20 games/match, alternating colors

Match                          winA  winB  draw   winRateA
HeuristicPlayer vs Minimax(d2)    3    16     1       0.15
HeuristicPlayer vs Minimax(d4)    1    19     0       0.05
Minimax(d2)     vs Minimax(d4)    4    15     1       0.20

Standings                 W   L   D   Pts   illegal
Minimax(d4)              34   5   1   103    0
Minimax(d2)              20  18   2    62    0
HeuristicPlayer           4  35   1    13    0
```

- 사고시간 통계(`thinkMs*`)는 `--verbose` 시 추가 컬럼으로 노출한다.

---

## 8. 파일 구조

```
src/ai/arena/
  arena.js               ← playGame / playMatch / runTournament / randomOpenings (신규)
  openingArena.js        ← playOpeningGame / openingTournament (신규, 엔진 오프닝 재사용)
  review.js              ← saveGames / loadGames / reviewGame (신규)
  __tests__/
    arena.test.js        ← 대전 완료 기준 테스트 (신규)
    openingArena.test.js ← 오프닝 대전 완료 기준 테스트 (신규)
    review.test.js       ← 복기 완료 기준 테스트 (신규)
scripts/
  arena.mjs              ← CLI 실행 스크립트 (신규)
```

기존 `src/ai/`, `src/engine/` 파일은 **변경 없음**(재사용만).

---

## 9. 완료 기준 (Acceptance)

| ID | 조건 |
|----|------|
| AC-A1 | `playGame`에 5목을 두는 Mock 두뇌를 넣으면 `winner`가 올바르고 `reason==='FIVE'`다 |
| AC-A2 | 흑이 금수 자리를 반환하면 `winner==='W'`, `reason==='FORBIDDEN_MOVE'`, `offender==='B'`다 |
| AC-A3 | 두뇌가 점유된 교점/`null`을 반환하면 그 두뇌가 패하고 `reason==='ILLEGAL_MOVE'`다 |
| AC-A4 | `getMove`가 예외를 던지면 그 두뇌가 패하고 `reason==='EXCEPTION'`이며 매치가 중단되지 않는다 |
| AC-A5 | `playMatch(A, B, {games:10, alternate:true})`에서 A가 선공/후공 각 5판씩 둔다 |
| AC-A6 | `runTournament`가 N개 두뇌에 대해 N·(N−1)/2개 매치를 실행하고 승점순 `standings`를 반환한다 |
| AC-A7 | Arena는 판정에 엔진 함수(`checkWin`/`checkDraw`/`isForbidden`)만 쓰고 자체 재구현이 없다 |
| AC-A8 | `saveGames`로 저장한 뒤 `loadGames`로 읽으면 기보가 손실 없이 복원된다 (round-trip) |
| AC-A9 | `reviewGame`이 각 수의 `delta`를 두는 색 관점으로 계산하고, 임계값 이하 급락 수를 `blunder=true`로 표시한다 |
| AC-A10 | 명백한 패착(승리 저지 실패 등)을 심은 기보에서 `turningPly`가 그 수를 가리킨다 |
| AC-A11 | `reviewGame`은 국면 평가에 `evaluateBoard`만 쓰고 자체 재구현이 없다 |
| AC-A12 | `randomOpenings`는 같은 `seed`로 항상 같은 오프닝 세트를 내고(재현), 각 오프닝은 서로 다른 빈 교점이며 흑 좌표는 금수가 아니다 |
| AC-A13 | `playMatch`에 `makeOpening`을 주면 각 판이 그 초기 수로 시작한다(history 접두가 일치) |
| AC-A14 | `playMatch`에 `onGame`을 주면 판마다 GameRecord가 한 번씩 넘어오고, 그 승자 집계가 `winsA`/`winsB`/`draws`와 일치한다(단일 대국에서 저장·집계 동시) |
| AC-A15 | `playOpeningGame`이 오프닝(1~6수)을 엔진 규칙대로 진행하고 승자를 판정해 종료한다(무한 루프 없음) |
| AC-A16 | 오프닝 대국의 첫 수는 항상 정중앙(7,7)이고, 각 오프닝 수는 해당 구역(§opening.md) 안이다 |
| AC-A17 | 스왑을 항상 하는 Mock과 안 하는 Mock을 붙이면 `swaps` 집계가 결정에 부합한다 |
| AC-A18 | `getOpeningMove`가 구역 밖 자리를 반환하면 그 두뇌가 `ILLEGAL_MOVE`로 진다 |
| AC-A19 | `rng`를 주면 오프닝 place 수가 구역 내 무작위로 바뀌고(1수는 여전히 중앙), 같은 시드는 동일 대국을 재현한다 |
| AC-A20 | 기존 테스트 전부 통과(회귀 없음) |

---

## 10. 향후 확장 (Out of scope, 기록만)

- 파라미터 스윕 — `depth`/`defenseWeight` 격자 탐색 후 승률 히트맵.
- **패착 국면 자동 추출** — `reviewGame`의 `blunder` 국면을 회귀/학습용 position 세트로 뽑고, 두뇌 수정 후 그 국면 재검증까지 자동화.
- 결과를 근거로 한 신규 두뇌(`HybridPlayer` 등) 도출.

---

## 11. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-07-09 | 최초 작성. 두뇌 자동 대전 하네스 스펙 정의. |
| 2026-07-09 | 복기(§6) 추가 — 기보 저장 + `evaluateBoard` 기반 자동 패착 분석. |
| 2026-07-09 | 랜덤 오프닝(§5-4) 추가 — 시드 기반 `randomOpenings` + `makeOpening` 옵션으로 결정적 두뇌 표본 다양화. |
| 2026-07-09 | 오프닝 포함 대전(§5-5) 추가 — 타라구치-10 스왑/분기/후보까지 두 두뇌가 진행, 엔진 상태기계 재사용. |
| 2026-07-10 | 오프닝 모드 다양화(§5-5-1) 추가 — 시드 `rng`로 오프닝 place 수 무작위화, 결정적 두뇌 표본 확보. |
