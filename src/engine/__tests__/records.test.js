// docs/spec/nav.md §5 기보 저장 완료 기준 (AC-N4, AC-N6)
import { vi, describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { saveRecord, loadRecords, clearRecords } from '../records.js';

// Node 환경에서 localStorage 모킹
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

function makeRecord(overrides = {}) {
  return {
    id: '1',
    date: new Date().toISOString(),
    difficulty: 'normal',
    myColor: 'B',
    result: 'win',
    moves: [{ row: 7, col: 7, color: 'B' }],
    ...overrides,
  };
}

describe('loadRecords', () => {
  it('저장된 기록이 없으면 빈 배열 반환', () => {
    expect(loadRecords()).toEqual([]);
  });

  it('저장된 기록을 반환한다', () => {
    saveRecord(makeRecord({ id: 'abc' }));
    expect(loadRecords()).toHaveLength(1);
    expect(loadRecords()[0].id).toBe('abc');
  });
});

describe('saveRecord', () => {
  it('기록을 저장한다', () => {
    saveRecord(makeRecord({ id: 'x' }));
    expect(loadRecords()[0].id).toBe('x');
  });

  it('최신 기록이 앞에 위치한다', () => {
    saveRecord(makeRecord({ id: '1' }));
    saveRecord(makeRecord({ id: '2' }));
    const records = loadRecords();
    expect(records[0].id).toBe('2');
    expect(records[1].id).toBe('1');
  });

  it('100건 초과 시 오래된 기록부터 삭제된다', () => {
    for (let i = 0; i < 100; i++) saveRecord(makeRecord({ id: String(i) }));
    saveRecord(makeRecord({ id: 'new' }));
    const records = loadRecords();
    expect(records).toHaveLength(100);
    expect(records[0].id).toBe('new');
    expect(records.find(r => r.id === '0')).toBeUndefined();
  });

  it('result 필드가 정확히 저장된다', () => {
    saveRecord(makeRecord({ id: 'lose-test', result: 'lose' }));
    expect(loadRecords()[0].result).toBe('lose');
  });
});

describe('clearRecords — AC-N6', () => {
  it('모든 기록을 삭제한다', () => {
    saveRecord(makeRecord({ id: 'r1' }));
    saveRecord(makeRecord({ id: 'r2' }));
    clearRecords();
    expect(loadRecords()).toEqual([]);
  });
});
