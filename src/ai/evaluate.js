// docs/ai.md §3 평가 함수 스펙 기반
import { BOARD_SIZE, inBounds } from '../engine/board.js';

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

function countDir(board, row, col, color, dr, dc) {
  let count = 0;
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && board[r][c] === color) {
    count++;
    r += dr; c += dc;
  }
  const open = inBounds(r, c) && board[r][c] === null;
  return { count, open };
}

// docs/ai.md §3-2 점수표
function patternScore(count, openEnds) {
  if (count >= 5) return 100000;
  if (count === 4) {
    if (openEnds === 2) return 10000;
    if (openEnds === 1) return 1000;
    return 0;
  }
  if (count === 3) {
    if (openEnds === 2) return 500;
    if (openEnds === 1) return 100;
    return 0;
  }
  if (count === 2) {
    if (openEnds === 2) return 50;
    if (openEnds === 1) return 10;
    return 0;
  }
  if (count === 1) {
    if (openEnds === 2) return 5;
    if (openEnds === 1) return 1;
  }
  return 0;
}

// docs/ai.md §3-3 centerBonus
function centerBonus(row, col) {
  const dr = row - 7, dc = col - 7;
  return Math.max(0, 8 - Math.sqrt(dr * dr + dc * dc));
}

// 특정 색 기준 한 방향의 패턴 점수 — board를 임시 변형 후 복원
function dirScore(board, row, col, color, dr, dc) {
  const pos = countDir(board, row, col, color, dr, dc);
  const neg = countDir(board, row, col, color, -dr, -dc);
  const count = 1 + pos.count + neg.count;
  const openEnds = (pos.open ? 1 : 0) + (neg.open ? 1 : 0);
  return patternScore(count, openEnds);
}

// 복합 위협 보너스 — docs/spec/ai.md §3-4-1
function compositeBonus(scores) {
  const [top1, top2] = [...scores].sort((a, b) => b - a);
  if (top1 >= 10000 && top2 >= 1000) return 8000;
  if (top1 >= 1000  && top2 >= 1000) return 5000;
  if (top1 >= 1000  && top2 >= 500)  return 4000;
  if (top1 >= 500   && top2 >= 500)  return 3000;
  return 0;
}

// docs/ai.md §3-3: 공격/방어 점수 합산 + 복합 위협 보너스 (이동 후보 정렬용)
// attackWeight, defenseWeight는 호출부에서 docs/ai.md §2-1 파라미터 주입
export function scorePosition(board, row, col, color, attackWeight = 1.0, defenseWeight = 1.0) {
  const opp = color === 'B' ? 'W' : 'B';
  let score = 0;

  board[row][col] = color;
  const atkScores = DIRS.map(([dr, dc]) => dirScore(board, row, col, color, dr, dc));
  score += atkScores.reduce((s, v) => s + v, 0) * attackWeight;
  score += compositeBonus(atkScores);
  board[row][col] = null;

  board[row][col] = opp;
  for (const [dr, dc] of DIRS) score += dirScore(board, row, col, opp, dr, dc) * defenseWeight;
  board[row][col] = null;

  score += centerBonus(row, col);
  return score;
}

// docs/spec/ai.md §3-4-2 이중 위협 보너스 (hard 전용 — scorePosition용)
export function doubleThreatBonus(board, row, col, color) {
  board[row][col] = color;
  const scores = DIRS.map(([dr, dc]) => dirScore(board, row, col, color, dr, dc));
  board[row][col] = null;
  return compositeBonus(scores);
}

// 갭=1 점프 패턴 탐색 — docs/spec/ai.md §3-2-1
function dirScoreWithGap(board, row, col, color, dr, dc) {
  const pos = countDir(board, row, col, color, dr, dc);
  const neg = countDir(board, row, col, color, -dr, -dc);

  // 갭 없는 연속 점수
  const baseCount = 1 + pos.count + neg.count;
  const baseEnds  = (pos.open ? 1 : 0) + (neg.open ? 1 : 0);
  const baseScore = patternScore(baseCount, baseEnds);

  // 갭=1: 양방향 중 한쪽에서 빈칸 1개 건너 돌이 이어지는지 확인
  let gapScore = 0;
  for (const [mainDir, crossDir] of [[1, -1], [-1, 1]]) {
    const main  = mainDir === 1  ? pos : neg;
    const cross = crossDir === 1 ? pos : neg;
    // 해당 방향 끝이 열려 있을 때(빈칸) 한 칸 더 탐색
    if (!main.open) continue;
    const gr = row + dr * mainDir * (1 + main.count + 1);
    const gc = col + dc * mainDir * (1 + main.count + 1);
    if (!inBounds(gr, gc) || board[gr][gc] !== color) continue;
    // 갭 너머 같은 색 돌 확인 → 점프 패턴 성립
    const beyond = countDir(board, gr, gc, color, dr * mainDir, dc * mainDir);
    const gapCount = 1 + main.count + 1 + beyond.count + cross.count; // 갭 포함 전체 연결 수
    const gapEnds  = (beyond.open ? 1 : 0) + (cross.open ? 1 : 0);
    gapScore = Math.max(gapScore, patternScore(gapCount, gapEnds));
  }

  return Math.max(baseScore, gapScore);
}

// 이미 착수된 돌의 패턴 강도 — 4방향 합산 + 복합 위협 보너스 (docs/spec/ai.md §7-1, §3-2-1, §3-4-1)
export function cellStrength(board, row, col, color) {
  const scores = DIRS.map(([dr, dc]) => dirScoreWithGap(board, row, col, color, dr, dc));
  return scores.reduce((s, v) => s + v, 0) + compositeBonus(scores);
}

// Minimax 정적 평가 — 현재 플레이어 기준 (docs/spec/ai.md §7-1)
export function evaluateBoard(board, color) {
  const opp = color === 'B' ? 'W' : 'B';
  let score = 0;
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === color) score += cellStrength(board, r, c, color);
      else if (board[r][c] === opp) score -= cellStrength(board, r, c, opp);
    }
  return score;
}

// 즉시 승리 여부 — (r,c)에 color 착수 시 5목 완성 (docs/spec/ai.md §7-2)
export function hasImmediate(board, row, col, color) {
  board[row][col] = color;
  let win = false;
  for (const [dr, dc] of DIRS) {
    let cnt = 1;
    for (const s of [1, -1]) {
      let r = row + dr * s, c = col + dc * s;
      while (inBounds(r, c) && board[r][c] === color) { cnt++; r += dr * s; c += dc * s; }
    }
    if (cnt >= 5) { win = true; break; }
  }
  board[row][col] = null;
  return win;
}

// 후보 셀: 기존 돌 주변 radius 이내 빈 교점 (docs/ai.md §1)
export function getCandidates(board, radius) {
  const candidates = new Set();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = r + dr, nc = c + dc;
          if (inBounds(nr, nc) && board[nr][nc] === null) {
            candidates.add(nr * BOARD_SIZE + nc);
          }
        }
      }
    }
  }
  if (candidates.size === 0) candidates.add(7 * BOARD_SIZE + 7); // 빈 보드 → 중앙
  return Array.from(candidates).map(k => ({ row: Math.floor(k / BOARD_SIZE), col: k % BOARD_SIZE }));
}
