// docs/spec/nav.md §5 기보 저장 — localStorage CRUD
const KEY = 'omok_records';
const MAX = 100;

export function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveRecord(record) {
  const records = loadRecords();
  records.unshift(record);
  if (records.length > MAX) records.splice(MAX);
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function clearRecords() {
  localStorage.removeItem(KEY);
}
