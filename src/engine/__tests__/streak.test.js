// docs/spec/streak.md §6 완료 기준 — 출석/연승 스트릭
import { describe, it, expect } from 'vitest';
import { computeStreaks } from '../streak.js';

// 로컬 시간대 기준 '오늘로부터 n일 전'의 ISO 문자열
function daysAgo(n, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// records는 최신순(unshift) 저장 — 테스트도 최신순으로 만든다
function rec(n, result, hour = 12) {
  return { id: `${n}-${result}-${hour}`, date: daysAgo(n, hour), result };
}

describe('기록 없음', () => {
  it('모든 값이 0이다', () => {
    const s = computeStreaks([]);
    expect(s).toEqual({ daily: 0, dailyBest: 0, win: 0, winBest: 0, playedToday: false });
  });
});

describe('출석 스트릭 (docs/spec/streak.md §2-1)', () => {
  it('같은 날 여러 판을 둬도 1일로 계산된다', () => {
    const s = computeStreaks([rec(0, 'win', 20), rec(0, 'lose', 15), rec(0, 'win', 10)]);
    expect(s.daily).toBe(1);
    expect(s.playedToday).toBe(true);
  });

  it('어제까지 3일 연속 + 오늘 한 판 → 4가 된다', () => {
    const s = computeStreaks([rec(0, 'win'), rec(1, 'lose'), rec(2, 'win'), rec(3, 'win')]);
    expect(s.daily).toBe(4);
  });

  it('마지막이 어제면 스트릭이 유지된다 (오늘 두면 이어짐)', () => {
    const s = computeStreaks([rec(1, 'win'), rec(2, 'win')]);
    expect(s.daily).toBe(2);
    expect(s.playedToday).toBe(false);
  });

  it('이틀 이상 쉬면 현재는 0, 최고 기록은 보존된다', () => {
    // 5·6·7일 전 3일 연속 → 그 뒤 공백
    const s = computeStreaks([rec(5, 'win'), rec(6, 'win'), rec(7, 'win')]);
    expect(s.daily).toBe(0);
    expect(s.dailyBest).toBe(3);
  });
});

describe('연승 스트릭 (docs/spec/streak.md §2-2)', () => {
  it('승 +1 / 패 초기화', () => {
    // 최신순: 승, 승, 패, 승
    const s = computeStreaks([rec(0, 'win'), rec(1, 'win'), rec(2, 'lose'), rec(3, 'win')]);
    expect(s.win).toBe(2);
  });

  it('무승부는 연승을 유지하되 증가시키지 않는다', () => {
    // 최신순: 무, 승, 승
    const s = computeStreaks([rec(0, 'draw'), rec(1, 'win'), rec(2, 'win')]);
    expect(s.win).toBe(2);
  });

  it('최고 연승이 보존된다', () => {
    // 최신순: 패, 승×3
    const s = computeStreaks([rec(0, 'lose'), rec(1, 'win'), rec(2, 'win'), rec(3, 'win')]);
    expect(s.win).toBe(0);
    expect(s.winBest).toBe(3);
  });
});

describe('하위 호환', () => {
  it('mode 필드가 없는 기존 레코드도 오류 없이 집계된다', () => {
    const legacy = [
      { id: '1', date: daysAgo(0), result: 'win', difficulty: 'hard' },
      { id: '2', date: daysAgo(1), result: 'win', difficulty: 'hard' },
    ];
    const s = computeStreaks(legacy);
    expect(s.daily).toBe(2);
    expect(s.win).toBe(2);
  });

  it('잘못된 날짜/결과가 섞여도 예외를 던지지 않는다', () => {
    const dirty = [{ id: 'x', date: 'not-a-date', result: 'win' }, rec(0, 'win')];
    expect(() => computeStreaks(dirty)).not.toThrow();
  });
});
