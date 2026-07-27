// docs/spec/streak.md — 기보 기록에서 스트릭을 파생한다 (순수 JS, 저장소 없음)

// 로컬 시간대 기준 날짜 키(YYYY-MM-DD). 유효하지 않으면 null.
export function dayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 날짜 키를 일 단위 정수로 (연속 판정용)
export function dayNumber(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function todayNumber() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

/**
 * 날짜 번호 목록에서 연속 스트릭을 구한다 (docs/spec/streak.md §2-1).
 * 대국 출석과 데일리 퍼즐(docs/spec/puzzle.md §6)이 공유한다.
 * @param {number[]} dayNums 중복 없는 날짜 번호 목록(정렬 무관)
 * @returns {{current:number, best:number, isToday:boolean}}
 */
export function dailyStreakOf(dayNums) {
  const days = [...new Set(dayNums)].sort((a, b) => b - a); // 최신순
  if (days.length === 0) return { current: 0, best: 0, isToday: false };

  const today = todayNumber();
  const isToday = days[0] === today;

  // 현재 스트릭: 마지막이 오늘 또는 어제여야 살아있다
  let current = 0;
  if (days[0] === today || days[0] === today - 1) {
    current = 1;
    for (let i = 1; i < days.length; i++) {
      if (days[i] === days[i - 1] - 1) current++;
      else break;
    }
  }

  // 최고 기록: 전 구간에서 가장 긴 연속
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = days[i] === days[i - 1] - 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  return { current, best, isToday };
}

/**
 * 기록 배열에서 출석/연승 스트릭을 계산한다.
 * @param {Array} records `loadRecords()` 결과 (최신순). 각 항목은 { date, result } 필요.
 * @returns {{daily:number, dailyBest:number, win:number, winBest:number, playedToday:boolean}}
 */
export function computeStreaks(records) {
  const list = Array.isArray(records) ? records : [];
  const empty = { daily: 0, dailyBest: 0, win: 0, winBest: 0, playedToday: false };
  if (list.length === 0) return empty;

  // ── 출석 스트릭 (§2-1) — 날짜별로 하루 1회만 센다
  const dayNums = list.map(r => dayKey(r?.date)).filter(Boolean).map(dayNumber);
  const { current: daily, best: dailyBest, isToday: playedToday } = dailyStreakOf(dayNums);

  // ── 연승 스트릭 (§2-2) — 승 +1, 패 초기화, 무 유지
  let win = 0;
  let counting = true;
  for (const r of list) {
    if (r?.result === 'win') {
      if (counting) win++;
    } else if (r?.result === 'lose') {
      counting = false;
    }
    // 'draw'는 유지(증가도 초기화도 없음)
    if (!counting) break;
  }

  let winBest = 0;
  let run = 0;
  for (const r of list) {
    if (r?.result === 'win') {
      run++;
      if (run > winBest) winBest = run;
    } else if (r?.result === 'lose') {
      run = 0;
    }
  }

  return { daily, dailyBest, win, winBest, playedToday };
}
