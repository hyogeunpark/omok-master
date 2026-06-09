# AI 스펙 — CPU 플레이어

> 전제: `index.md` §5 비기능 요구사항(성능: 보통 난이도에서 수백 ms 이내).
> 이 문서는 CPU AI의 알고리즘, 난이도 정의, 평가 함수 스펙을 정의한다.

---

## 1. 알고리즘 개요

- **easy**: 휴리스틱 1-ply (즉시 승리/차단 후 랜덤). 변경 없음.
- **normal / hard**: Minimax + Alpha-Beta Pruning (Negamax 방식).
- **후보 셀**: 기존 돌 주변 `SEARCH_RADIUS` 칸 이내의 빈 교점만 탐색 (전체 탐색 금지 — 성능).
- **구현 위치**: `src/ai/evaluate.js` (평가 함수), `src/ai/minimax.js` (탐색), `src/ai/cpu.js` (진입점).

---

## 2. 난이도 정의

| 난이도 | 레이블 | 행동 |
|--------|--------|------|
| `easy` | 쉬움 | 즉시 이기는 수·즉시 막아야 하는 수 우선 처리. 이후 35% 확률로 **주변(반경 3) 랜덤 수**, 나머지는 휴리스틱 최선 수. 보드 전체 랜덤 금지 — 항상 게임 중심부 근처에 착수. |
| `normal` | 보통 | Minimax depth=2. 공격/방어 균형. |
| `hard` | 어려움 | Minimax depth=4 + 이중 위협(double-threat) 감지. |

### 2-1. 난이도별 파라미터

| 파라미터 | easy | normal | hard |
|----------|------|--------|------|
| `SEARCH_RADIUS` | 1 | 2 | 2 |
| `depth` | 0 (heuristic) | 2 | 4 |
| `candidateLimit` | — | 10 | 8 |
| 공격 가중치 | — | 1.0 | 1.0 |
| 방어 가중치 | — | 1.0 | 1.2 |
| 이중 위협 보너스 | 없음 | 없음 | 있음 |
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

### 3-3. 셀 점수 계산

```
cellScore(row, col) =
  Σ patternScore(myColor, dir)  × attackWeight
  + Σ patternScore(oppColor, dir) × defenseWeight
  + centerBonus(row, col)
```

- `centerBonus`: 중앙(7,7) 기준 거리가 가까울수록 소량의 보너스 (최대 8점). 동점 시 중앙 선호.

### 3-4. 이중 위협 보너스 (hard 전용)

한 수로 4점 이상 패턴을 **2방향 이상** 동시에 만드는 경우 추가 보너스(+5,000).
→ 상대가 한 수로 막을 수 없는 수를 선호하게 만든다.

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
