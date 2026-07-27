// docs/spec/puzzle.md §10 완료 기준 — 데일리 퍼즐
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { isForbidden } from '../forbidden.js';
import { hasImmediate } from '../../ai/evaluate.js';
import {
  PUZZLE_COUNT, MAX_ATTEMPTS,
  puzzleNumber, puzzleByNumber, todayPuzzle, puzzleBoard, isSolution,
  recordResult, isSolvedToday, todayResult, puzzleStreak,
  attemptMarks, shareText,
} from '../puzzle.js';

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(12, 0, 0, 0); return d; };
const key = (n) => { const d = iso(n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// Node 환경에서 localStorage 모킹 (records.test.js와 동일 관례)
let store = {};
const localStorageMock = {
  getItem:    (k)    => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v); },
  removeItem: (k)    => { delete store[k]; },
  clear:      ()     => { store = {}; },
};
beforeAll(() => vi.stubGlobal('localStorage', localStorageMock));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => localStorageMock.clear());

describe('문제은행', () => {
  it('문제가 하나 이상 있다', () => {
    expect(PUZZLE_COUNT).toBeGreaterThan(0);
  });

  it('모든 문제는 정답이 1개 이상이고, 정답 자리는 비어 있으며 금수가 아니다 (§10)', () => {
    for (let n = 1; n <= PUZZLE_COUNT; n++) {
      const p = puzzleByNumber(n);
      expect(p.solution.length).toBeGreaterThan(0);
      const board = puzzleBoard(p);
      for (const [r, c] of p.solution) {
        expect(board[r][c]).toBeNull();
        // 5목 완성은 금수 판정보다 우선하므로 예외
        if (!hasImmediate(board, r, c, 'B')) {
          expect(isForbidden(board, r, c, 'B')).toBe(false);
        }
      }
    }
  });
});

describe('날짜 → 문제 선택 (§4)', () => {
  it('같은 날짜면 항상 같은 문제다', () => {
    const d = new Date('2026-08-01T09:00:00');
    expect(todayPuzzle(d).id).toBe(todayPuzzle(d).id);
  });

  it('날짜가 바뀌면 번호가 1 증가한다', () => {
    const a = puzzleNumber(new Date('2026-08-01T09:00:00'));
    const b = puzzleNumber(new Date('2026-08-02T09:00:00'));
    expect(b).toBe(a + 1);
  });

  it('은행이 소진되면 순환한다', () => {
    expect(puzzleByNumber(1).id).toBe(puzzleByNumber(1 + PUZZLE_COUNT).id);
  });
});

describe('정답 판정 (§5)', () => {
  it('정답 좌표를 인정하고, 그 외는 오답이다', () => {
    const p = puzzleByNumber(1);
    const [r, c] = p.solution[0];
    expect(isSolution(p, r, c)).toBe(true);
    // 정답이 아닌 임의의 빈 칸
    const board = puzzleBoard(p);
    let wrong = null;
    for (let rr = 0; rr < 15 && !wrong; rr++)
      for (let cc = 0; cc < 15; cc++)
        if (board[rr][cc] === null && !isSolution(p, rr, cc)) { wrong = [rr, cc]; break; }
    expect(isSolution(p, wrong[0], wrong[1])).toBe(false);
  });
});

describe('기록 / 하루 한 번 (§5, §6)', () => {
  it('기록 전에는 오늘 결과가 없다', () => {
    expect(isSolvedToday()).toBe(false);
    expect(todayResult()).toBeNull();
  });

  it('기록하면 오늘 결과가 남고, 재기록해도 덮어쓰지 않는다', () => {
    recordResult({ solved: true, attempts: 2 });
    expect(isSolvedToday()).toBe(true);
    expect(todayResult()).toEqual({ solved: true, attempts: 2 });

    recordResult({ solved: false, attempts: 3 });
    expect(todayResult()).toEqual({ solved: true, attempts: 2 }); // 그대로
  });
});

describe('퍼즐 스트릭 (§6) — 대국 출석과 독립', () => {
  const seed = (entries) => localStorage.setItem('omok_puzzles', JSON.stringify(entries));

  it('성공한 날만 연속으로 센다', () => {
    seed({
      [key(0)]: { solved: true,  attempts: 1 },
      [key(1)]: { solved: true,  attempts: 2 },
      [key(2)]: { solved: false, attempts: 3 },
      [key(3)]: { solved: true,  attempts: 1 },
    });
    const s = puzzleStreak();
    expect(s.current).toBe(2); // 실패한 날에서 끊긴다
  });

  it('기록이 없으면 0이다', () => {
    expect(puzzleStreak()).toEqual({ current: 0, best: 0 });
  });

  it('이틀 이상 쉬면 현재는 0, 최고는 보존된다', () => {
    seed({
      [key(5)]: { solved: true, attempts: 1 },
      [key(6)]: { solved: true, attempts: 1 },
      [key(7)]: { solved: true, attempts: 1 },
    });
    const s = puzzleStreak();
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
  });

  it('대국 기록(omok_records)에 영향받지 않는다', () => {
    localStorage.setItem('omok_records', JSON.stringify([{ id: '1', date: iso(0).toISOString(), result: 'win' }]));
    expect(puzzleStreak().current).toBe(0); // 퍼즐은 안 풀었으므로 0
  });
});

describe('공유 텍스트 (§7)', () => {
  it('성공 시 시도 횟수와 스트릭을 담고, 정답 좌표는 노출하지 않는다', () => {
    const text = shareText({ solved: true, attempts: 2 }, 12, 5);
    expect(text).toContain('오목 퍼즐 #12');
    expect(text).toContain('2번째 시도에 성공');
    expect(text).toContain('퍼즐 5일 연속');
    expect(text).not.toMatch(/\d+\s*,\s*\d+/); // 좌표 형태 없음
  });

  it('실패 시 실패로 표기한다', () => {
    expect(shareText({ solved: false, attempts: 3 }, 3, 0)).toContain('실패');
  });

  it('시도 표시는 성공한 시도만 ◆다', () => {
    expect(attemptMarks({ solved: true, attempts: 2 })).toBe('◇◆·');
    expect(attemptMarks({ solved: false, attempts: MAX_ATTEMPTS })).toBe('◇◇◇');
  });
});
