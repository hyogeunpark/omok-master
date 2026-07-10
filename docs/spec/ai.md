# AI 스펙 — CPU 플레이어

> 전제: `index.md` §5 비기능 요구사항(성능: 보통 난이도에서 수백 ms 이내).
> 이 문서는 CPU AI의 알고리즘, 난이도 정의, 평가 함수 스펙을 정의한다.

---

## 1. 알고리즘 개요

- **easy**: 휴리스틱 1-ply (즉시 승리/차단 후 랜덤). 변경 없음.
- **normal / hard**: Minimax + Alpha-Beta Pruning (Negamax 방식).
- **후보 셀**: 기존 돌 주변 `SEARCH_RADIUS` 칸 이내의 빈 교점만 탐색 (전체 탐색 금지 — 성능).
- **구현 위치**: `src/ai/evaluate.js` (평가 함수), `src/ai/minimax.js` (탐색), `src/ai/vcf.js` (VCF 탐색), `src/ai/cpu.js` (진입점).

---

## 2. 난이도 정의

| 난이도 | 레이블 | 행동 |
|--------|--------|------|
| `easy` | 쉬움 | 즉시 이기는 수·즉시 막아야 하는 수 우선 처리. 이후 35% 확률로 **주변(반경 3) 랜덤 수**, 나머지는 휴리스틱 최선 수. 보드 전체 랜덤 금지 — 항상 게임 중심부 근처에 착수. |
| `normal` | 보통 | Minimax depth=2. 공격/방어 균형. |
| `hard` | 어려움 | VCF 선행 탐색 → Minimax depth=6 (TT+반복심화). 방어 가중치 1.2. |

### 2-1. 난이도별 파라미터

| 파라미터 | easy | normal | hard |
|----------|------|--------|------|
| `SEARCH_RADIUS` | 1 | 2 | 2 |
| `depth` | 0 (heuristic) | 2 | 6 (TT+반복심화) |
| `candidateLimit` | — | 10 | 8 |
| 공격 가중치 | — | 1.0 | 1.0 |
| 방어 가중치 | — | 1.0 | 1.2 |
| VCF 탐색 | 없음 | 없음 | 있음 (Minimax 전 선행) |
| `randomRate` | 0.35 | 없음 | 없음 |
| 랜덤 범위 | 반경 3 이내 | — | — |

---

## 3. 평가 함수 스펙

### 3-1. 방향

4방향(가로·세로·우하향 대각·우상향 대각) 각각 독립 계산 후 합산.

### 3-2. 패턴 점수표 (단방향 아님 — 양방향 합산 기준)

| 연속 수(count) | 열린 끝(openEnds) | 점수 |
|----------------|-------------------|------|
| 5 이상 | — | 100,000 (승리) |
| 4 | 2 | 10,000 (열린 4) |
| 4 | 1 | 1,000 (닫힌 4) |
| 4 | 0 | 0 |
| 3 | 2 | 500 (열린 3) |
| 3 | 1 | 100 (닫힌 3) |
| 3 | 0 | 0 |
| 2 | 2 | 50 |
| 2 | 1 | 10 |
| 1 | 2 | 5 |
| 1 | 1 | 1 |

- **openEnds**: 해당 방향의 양끝이 빈 교점이면 각 1씩 합산 (0~2).
- **count**: 착수 예정 돌 포함 연속 돌 수.

### 3-2-1. 점프 패턴 점수 (갭=1)

갭 1칸을 사이에 둔 패턴(`X_XX`, `XX_X`)은 갭을 채우면 연속 4가 되므로 open-3 수준으로 평가한다.

- **조건**: 한 방향에서 `돌-빈칸-돌...` 형태로, 빈칸이 정확히 1칸이고 양쪽 합산 돌 수가 3 이상.
- **점수**: 연속 패턴 점수표와 동일 기준 적용 (갭 포함 count 계산).
- **구현**: `cellStrength`에서 `countDirWithGap` 함수로 갭=1 패턴 추가 탐색 후 기존 연속 점수와 max 취함.
- **적용 범위**: `evaluateBoard`(Minimax 정적 평가)에서 사용하는 `cellStrength`에만 적용. `scorePosition`(이동 후보 평가)은 이미 올바르게 처리되므로 변경 없음.

### 3-3. 셀 점수 계산

```
cellScore(row, col) =
  Σ patternScore(myColor, dir)  × attackWeight
  + Σ patternScore(oppColor, dir) × defenseWeight
  + centerBonus(row, col)
```

- `centerBonus`: 중앙(7,7) 기준 거리가 가까울수록 소량의 보너스 (최대 8점). 동점 시 중앙 선호.

### 3-4. 복합 위협 보너스

한 돌이 2방향 이상에서 동시에 위협 패턴을 형성할 때 추가 보너스를 부여한다.
상대가 한 수로 막을 수 없는 상황을 정확히 평가하기 위해 사용.

#### 3-4-1. cellStrength 복합 보너스 (evaluateBoard용 — 전 난이도)

이미 착수된 돌을 평가할 때, 방향별 점수 상위 2개를 기준으로 보너스 적용.

| 조합 (상위 2방향) | 보너스 |
|------------------|--------|
| 열린4(10000+) + 4류(1000+) | +8,000 |
| 닫힌4(1000+) + 닫힌4(1000+) | +5,000 |
| 닫힌4(1000+) + 열린3(500+) | +4,000 |
| 열린3(500+) + 열린3(500+) | +3,000 |

#### 3-4-2. scorePosition 복합 보너스 (이동 후보 정렬용 — 전 난이도)

`getOrderedCandidates`의 이동 후보 정렬 시 `scorePosition`에도 동일 복합 보너스 적용.
복합 위협 수가 후보 목록 상위에 배치되어 Alpha-Beta 가지치기 효율 향상.

| 조건 | 보너스 |
|------|--------|
| §3-4-1 compositeBonus 동일 기준 | 동일 값 적용 |

---

## 3-5. VCF (Victory by Continuous Four) 탐색

### 3-5-1. 개요

4-in-a-row 위협을 연속으로 만들어 상대가 계속 막는 동안 강제로 승리하는 수순.
Minimax와 별개로 동작하며, Minimax 탐색 **전에** 선행 실행한다.

**방어 우선 예외 (중요)**: VCF는 상대가 내 4를 강제로 막는다고 가정하므로, **상대가 지금 당장 5목을 완성할 수 있는 국면에서는 VCF를 신뢰할 수 없다**(상대가 내 4를 무시하고 먼저 이긴다). 따라서 `getMove`는 상대 즉시-5 위협이 있으면 **VCF를 생략**하고 `minimaxMove`로 넘겨 차단하게 한다(minimax는 즉시 승리→즉시 차단을 우선). 내가 이번 수로 5목을 만들 수 있으면 minimax가 그 승리를 먼저 둔다.
(근거: Arena 복기에서 hard의 패배 중 일부가 "상대 즉시-5를 무시하고 VCF 공격을 둠"으로 확인됨.)

### 3-5-2. 알고리즘

```
vcfSearch(board, color, maxDepth):
  winThreats = 지금 바로 5목이 되는 자리들
  if len(winThreats) >= 1: return winThreats[0]   // 즉시 승리
  if maxDepth <= 0: return null

  fourThreats = 착수 시 4-in-a-row(열린/닫힌)가 생기는 자리들

  for each (r, c) in fourThreats:
    place color at (r, c)
    forcedBlocks = 착수 후 color 기준 즉시 5목이 되는 자리들 (상대 강제 응수)

    if len(forcedBlocks) == 0 or >= 2:
      restore → return (r, c)   // 막을 수 없거나 동시에 두 곳 위협

    place opp at forcedBlocks[0]
    result = vcfSearch(board, color, maxDepth - 2)
    restore both

    if result != null: return (r, c)

  return null
```

- `maxDepth = 10` (5쌍) — 실전 VCF 수순 대부분 커버.
- 흑의 경우 `isForbidden` 자리 제외.

### 3-5-3. 적용 범위

| 난이도 | VCF |
|--------|-----|
| easy | 미적용 |
| normal | 미적용 |
| hard | minimaxMove 호출 전 선행 실행 |

### 3-5-4. 구현 파일

`src/ai/vcf.js` (신규)

---

## 4. 성능 제약

- 보통·어려움 난이도 기준, 수 선택에 **500ms 이내** 완료 (`index.md §5`).
- `SEARCH_RADIUS=2` 기준 후보 셀은 최대 ~100개이나, `candidateLimit`으로 탐색 분기를 제한.
- 트랜스포지션 테이블 미사용 — 현재 depth 수준에서 불필요.

---

## 7. Minimax 알고리즘 스펙

### 7-1. Negamax + Alpha-Beta

```
negamax(board, depth, α, β, color):
  if depth == 0: return evaluateBoard(board, color)

  candidates = getOrderedCandidates(board, color, radius=2, limit=candidateLimit)
  best = -∞
  for (r, c) in candidates:
    place color at (r, c)
    if checkWin(board, r, c, color): score = WIN_SCORE + depth
    else: score = -negamax(board, depth-1, -β, -α, opp)
    restore (r, c)
    best = max(best, score)
    α = max(α, best)
    if α ≥ β: break  // prune
  return best
```

- `WIN_SCORE = 100000`. depth 보너스로 빠른 승리를 선호.
- `evaluateBoard(board, color)` = Σ cellStrength(color) - Σ cellStrength(opp).
- `cellStrength(board, r, c, color)`: 이미 착수된 돌의 패턴 강도 (4방향 합산).

### 7-2. 수 정렬 (Move Ordering)

효율적인 Alpha-Beta 가지치기를 위해 후보 수를 다음 순서로 정렬:

1. **즉시 승리**: `hasImmediate(board, r, c, color)` — 즉시 반환
2. **즉시 차단**: `hasImmediate(board, r, c, opp)` — 다음 우선순위
3. **휴리스틱 정렬**: `scorePosition` 내림차순, 상위 `candidateLimit`개만 탐색

### 7-3. 구현 파일

- `src/ai/evaluate.js`: `hasImmediate`, `cellStrength`, `evaluateBoard` 추가 export
- `src/ai/minimax.js` (신규): `getOrderedCandidates`, `alphabeta`, `minimaxMove`
- `src/ai/cpu.js`: normal/hard에서 `minimaxMove` 호출로 변경

### 7-4. 트랜스포지션 테이블 + 반복심화 (깊은 탐색 최적화)

깊은 탐색(depth 6)을 실전 속도로 내기 위한 최적화. **동작(선택 수)은 바꾸지 않고 속도만 개선**하는 것이 목표다.
Arena 측정: `d6 vs d4 = 0.75`(깊이가 강함) but d6은 5~6배 느림 → TT로 실전화. `minimaxMoveTT`로 별도 구현하고, 검증 통과 시 hard에 적용한다(기존 `minimaxMove`는 유지).

**Zobrist 해싱**
- 초기화 시 각 (교점 225 × 색 2)에 **시드 PRNG(mulberry32, seed 고정)**로 32비트 난수 2벌(`Z1`,`Z2`)을 만든다. `Math.random` 미사용 → 재현 가능.
- 국면 해시 = 놓인 돌들의 `Z1`/`Z2` XOR 누적 + 착수 색 side 키. 착수/해제 시 **증분 XOR**(자기역원)로 O(1) 갱신.
- TT 키는 `h1`(Map 키), 충돌 방지용 `h2`를 엔트리에 저장해 조회 시 일치 검사(사실상 64비트).

**TT 엔트리 & 알파-베타 경계**
```
entry = { h2, depth, score, flag, move }   // flag: EXACT | LOWER | UPPER
조회: entry.depth >= 요청 depth 이고 h2 일치 시
  EXACT → score 반환
  LOWER → alpha = max(alpha, score)
  UPPER → beta  = min(beta, score)
  alpha >= beta → score 반환(컷)
저장: bestScore <= alphaOrig → UPPER / bestScore >= beta → LOWER / else EXACT
```
- TT는 **한 수 계산 동안만** 유지(매 `getMove` 새로 생성). 세대 간 오염 없음.

**반복심화 (Iterative Deepening)**
- depth 2 → 4 → 6 순으로 재탐색. 얕은 결과의 **최선 수를 다음 깊이에서 먼저 시도**해 알파-베타 컷을 늘린다.
- TT의 저장 `move`도 정렬 우선순위로 사용.

**정확성/성능 요건**
- 같은 depth에서 `minimaxMoveTT`는 `minimaxMove`와 **동등한 가치의 수**를 반환한다(전술 퍼즐 동일 통과).
- 같은 depth 고정 국면에서 TT판이 **더 빠르거나 최소 동등**해야 한다.
- **채택 검증**: `d6-tt vs d4` 승률(≈0.75 유지)과 **1수 평균 시간**을 Arena로 측정해, 강함 유지 + 실전 속도(§4, 500ms 지향) 확보 시에만 hard를 depth 6으로 올린다. 미달 시 d4 유지.
- **검증 결과(2026-07-10, 채택됨)**: 32개 국면에서 `minimaxMoveTT`가 plain과 **100% 동일 수**(정확성 확인). 속도 **2.9배**(중반 264ms→91ms/move, 500ms 안). 강함은 d6=plain 수준, d4 상대 우위 유지. → **hard를 depth 6 + TT로 채택**.

---

## 5. 오프닝 스왑 판단

CPU가 스왑 여부를 결정할 때 `evaluate.js`의 `scorePosition`을 재사용한다.

### 5-1. 스왑 판단 로직

직전에 착수한 색(`justPlayedColor`)의 돌들을 순회하며 각 위치의 공격 점수를 합산한 뒤,
**돌 수(stoneCount)로 나눠 1돌당 평균 점수**를 구한다. 이를 난이도별 threshold와 비교.

```
swapScore = Σ scorePosition(board, r, c, justPlayedColor, 1.0, 0) / stoneCount
swap if swapScore > perStoneThreshold
```

- `defenseWeight=0`: 상대 색이 아닌 해당 색 자체의 위치 강도만 측정.
- 돌 수 정규화 이유: 오프닝은 1~2수이므로 절대 총점이 매우 낮아 고정 threshold 사용 불가.

### 5-2. 난이도별 1돌당 threshold

| 난이도 | threshold | 비고 |
|--------|-----------|------|
| hard | 22 | 중앙이나 연결된 포석이면 스왑 |
| normal | 26 | 명확히 좋은 포석일 때만 스왑 |
| easy | 스왑 안 함 | 랜덤 플레이 |

- 중앙 1수(7,7) 기준 점수 ≈ 28 → hard·normal 모두 스왑.
- 5×5 외곽 1수 기준 점수 ≈ 24 → hard 스왑, normal 스왑 안 함.

---

## 6. Phase별 적용 범위

| Phase | 적용 규칙 |
|-------|-----------|
| Phase 1 | 기본 평가 함수. 금수 없음. |
| Phase 2 | CPU가 흑일 때 금수 자리를 후보에서 제외 (`isForbidden` 호출). |
| Phase 3 | 오프닝 스왑 판단에 `evaluate.js` 재사용 (§5). |

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-08 | 최초 작성. |
| 2026-06-09 | §5 스왑 판단 로직 추가: 돌 수 정규화 + 난이도별 1돌당 threshold. |
| 2026-06-09 | §7 Minimax 알고리즘 추가: Negamax+Alpha-Beta, depth/candidateLimit 파라미터, 수 정렬 스펙. |
| 2026-06-10 | §3-2-1 점프 패턴 점수 추가: 갭=1 패턴을 open-3 수준으로 평가, cellStrength 개선 스펙. |
| 2026-06-10 | §3-4 복합 위협 보너스 세분화: cellStrength 복합 보너스(전 난이도) + doubleThreatBonus 열린3+열린3 추가. |
| 2026-06-10 | §3-5 VCF 탐색 추가: hard 전용, Minimax 전 선행 실행, maxDepth=10(5쌍). |
| 2026-06-10 | 스펙-코드 정합성 정리: doubleThreat 데드 파라미터 제거, scorePosition에 compositeBonus 통합, §1/§2 VCF 반영. |
| 2026-07-10 | §3-5-1 방어 우선 예외 추가: 상대 즉시-5 위협 시 VCF 생략(Arena 복기로 발견한 패착 버그 수정). |
| 2026-07-10 | §7-4 TT+반복심화 추가, hard를 depth 4→6으로 상향(2.9배 가속, 검증 채택). |
