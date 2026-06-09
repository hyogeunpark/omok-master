// Phase 3 — 타라구치-10 오프닝 상태기계 (docs/phase-3.md)
const CENTER = 7;

// 각 수별 허용 영역 (step → {minR,maxR,minC,maxC} | null)
const ZONES = [
  null,                                                // [0] unused
  null,                                                // [1] 1수: 정중앙 특수 처리
  { minR: 6, maxR: 8, minC: 6, maxC: 8 },             // [2] 2수: 3×3
  { minR: 5, maxR: 9, minC: 5, maxC: 9 },             // [3] 3수: 5×5
  { minR: 4, maxR: 10, minC: 4, maxC: 10 },           // [4] 4수: 7×7
  { minR: 3, maxR: 11, minC: 3, maxC: 11 },           // [5] 5수 선택1: 9×9
];

export function getZoneRange(step, branch) {
  if (step === 1) return { minR: 7, maxR: 7, minC: 7, maxC: 7 };
  if (step >= 6) return null; // 6수: 제한 없음
  if (step === 5 && branch === 2) return null; // 선택2 후보: 제한 없음
  return ZONES[step] ?? null;
}

export function isInOpeningZone(row, col, step, branch = null) {
  if (step === 1) return row === CENTER && col === CENTER;
  if (step >= 6) return true;
  if (step === 5 && branch === 2) return true;
  const z = ZONES[step];
  if (!z) return true;
  return row >= z.minR && row <= z.maxR && col >= z.minC && col <= z.maxC;
}

// 선택2: 후보가 기존 후보와 8방향 대칭 중복인지 확인
export function isCandidateDuplicate(candidates, row, col) {
  if (candidates.some(c => c.row === row && c.col === col)) return true;
  const dr = row - CENTER, dc = col - CENTER;
  const syms = [
    [-dr, dc], [dr, -dc], [-dr, -dc],
    [dc, dr], [dc, -dr], [-dc, dr], [-dc, -dr],
  ].map(([r, c]) => ({ row: CENTER + r, col: CENTER + c }));
  return syms.some(s => candidates.some(c => c.row === s.row && c.col === s.col));
}

// 스왑 권리 보유자: 특정 step 착수 직후 어느 색이 스왑 가능한지
// 1수 후→백, 2수 후→흑, 3수 후→백, 선택1 5수 전→흑(phase await-swap after branch), 5수 후→백
export function swapOwnerAfterStep(step, branch, subPhase) {
  // subPhase: 'after-place' | 'after-branch1'
  if (step === 1) return 'W';
  if (step === 2) return 'B';
  if (step === 3) return 'W';
  if (step === 4 && branch === 1 && subPhase === 'after-branch1') return 'B'; // 5수 전
  if (step === 5 && branch === 1) return 'W'; // 5수 후
  return null;
}

export function createOpeningState() {
  return {
    step: 1,
    // 'place' | 'await-swap' | 'await-branch' | 'await-candidates' | 'await-candidate-pick'
    phase: 'place',
    branch: null,
    candidates: [], // 선택2 후보 목록
  };
}
