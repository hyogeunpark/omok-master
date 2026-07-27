// docs/spec/puzzle.md — 날짜별 문제 선택, 정답 판정, 퍼즐 기록/스트릭 (순수 JS)
import { emptyBoard } from './board.js';
import { dayKey, dayNumber, todayNumber, dailyStreakOf } from './streak.js';
import bank from '../puzzles/bank.json';

const STORAGE_KEY = 'omok_puzzles';
export const MAX_ATTEMPTS = 3;          // §5 시도 3회
const EPOCH = dayNumber('2026-07-27');  // §4 이 날을 #1로 한다

export const PUZZLE_COUNT = bank.puzzles.length;

// ── §4 오늘의 문제 선택 (날짜 → 결정적 매핑)

/** 오늘(또는 지정일)의 퍼즐 번호. 1부터 시작. */
export function puzzleNumber(date = new Date()) {
  const key = dayKey(date instanceof Date ? date.toISOString() : date);
  if (!key) return 1;
  return dayNumber(key) - EPOCH + 1;
}

/** 번호에 해당하는 퍼즐. 은행이 소진되면 순환한다. */
export function puzzleByNumber(n) {
  if (PUZZLE_COUNT === 0) return null;
  // 번호가 음수(기준일 이전)여도 안전하게 순환시킨다
  const idx = ((n - 1) % PUZZLE_COUNT + PUZZLE_COUNT) % PUZZLE_COUNT;
  return bank.puzzles[idx];
}

/**
 * §4-1 이미 푼 문제가 배정되면 아직 풀지 않은 문제로 대체한다.
 * 대체도 결정적이다 — 같은 날 다시 열어도 같은 문제가 나온다.
 */
export function todayPuzzle(date = new Date(), log = loadPuzzleLog()) {
  const n = puzzleNumber(date);
  const assigned = puzzleByNumber(n);
  if (!assigned) return null;

  const solvedIds = new Set(
    Object.values(log).map(v => v?.id).filter(Boolean)
  );
  if (!solvedIds.has(assigned.id)) return assigned;

  const unseen = bank.puzzles.filter(p => !solvedIds.has(p.id));
  if (unseen.length === 0) return assigned; // 전부 푼 경우 대체 불가
  return unseen[((n % unseen.length) + unseen.length) % unseen.length];
}

/** 퍼즐 데이터(좌표 목록) → 15×15 보드 */
export function puzzleBoard(puzzle) {
  const board = emptyBoard();
  if (!puzzle) return board;
  for (const [r, c] of puzzle.b) board[r][c] = 'B';
  for (const [r, c] of puzzle.w) board[r][c] = 'W';
  return board;
}

/** §5 정답 판정 — 정답은 복수일 수 있다 */
export function isSolution(puzzle, row, col) {
  if (!puzzle) return false;
  return puzzle.solution.some(([r, c]) => r === row && c === col);
}

// ── §6 기록 (localStorage) — { 'YYYY-MM-DD': { solved, attempts } }

export function loadPuzzleLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function saveLog(log) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // 저장 실패는 무시한다 (사파리 프라이빗 모드 등)
  }
}

/** 오늘 기록. 아직 풀지 않았으면 null. */
export function todayResult(log = loadPuzzleLog(), date = new Date()) {
  const key = dayKey(date instanceof Date ? date.toISOString() : date);
  return key ? (log[key] ?? null) : null;
}

/** §5 하루에 한 번만 — 이미 푼 날인지 */
export function isSolvedToday(log = loadPuzzleLog(), date = new Date()) {
  return todayResult(log, date) !== null;
}

/** 결과 기록. 이미 기록된 날은 덮어쓰지 않는다. id는 §4-1 대체 판정에 쓴다. */
export function recordResult({ solved, attempts, id }, date = new Date()) {
  const log = loadPuzzleLog();
  const key = dayKey(date instanceof Date ? date.toISOString() : date);
  if (!key || log[key]) return log;
  log[key] = id ? { solved: !!solved, attempts, id } : { solved: !!solved, attempts };
  saveLog(log);
  return log;
}

/** §6 퍼즐 스트릭 — 성공한 날만 연속으로 센다. 대국 출석과 독립. */
export function puzzleStreak(log = loadPuzzleLog()) {
  const solvedDays = Object.entries(log)
    .filter(([, v]) => v?.solved)
    .map(([k]) => dayNumber(k))
    .filter(n => Number.isFinite(n));
  const { current, best } = dailyStreakOf(solvedDays);
  return { current, best };
}

// ── §7 공유 텍스트

const SHARE_URL = 'https://hyogeunpark.github.io/omok-master/';

/** 시도 표시 — 성공한 시도는 ◆, 실패한 시도는 ◇ */
export function attemptMarks({ solved, attempts }) {
  const marks = [];
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    if (i < attempts) marks.push('◇');
    else if (i === attempts) marks.push(solved ? '◆' : '◇');
    else marks.push('·');
  }
  return marks.join('');
}

export function shareText({ solved, attempts }, number, streak) {
  const lines = [`오목 퍼즐 #${number}`];
  lines.push(solved
    ? `${attemptMarks({ solved, attempts })} ${attempts}번째 시도에 성공`
    : `${attemptMarks({ solved, attempts })} 실패`);
  if (streak > 0) lines.push(`퍼즐 ${streak}일 연속`);
  lines.push(SHARE_URL);
  return lines.join('\n');
}

export { todayNumber };
