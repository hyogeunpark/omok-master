// docs/spec/nav.md §5 기보 탭
import { useState } from 'react';
import { loadRecords, clearRecords } from '../engine/records.js';

const DIFFICULTY_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };
const COLOR_LABEL      = { B: '흑', W: '백' };
const RESULT_LABEL     = { win: '승', lose: '패', draw: '무' };

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function RecordsScreen() {
  const [records, setRecords] = useState(() => loadRecords());

  const handleClear = () => {
    clearRecords();
    setRecords([]);
  };

  return (
    <div className="tab-screen">
      <header className="tab-screen-header">
        <h2 className="tab-screen-title">기보</h2>
        {records.length > 0 && (
          <button className="tab-header-btn" onClick={handleClear}>전체 삭제</button>
        )}
      </header>

      <div className="tab-screen-content">
        {records.length === 0 ? (
          <div className="tab-empty">
            <span className="tab-empty-icon">◫</span>
            <p>아직 대국 기록이 없습니다</p>
          </div>
        ) : (
          <div className="records-list">
            {records.map((r) => (
              <div key={r.id} className={`record-card record-card--${r.result}`}>
                <div className="record-result">{RESULT_LABEL[r.result]}</div>
                <div className="record-info">
                  <span className="record-meta">{DIFFICULTY_LABEL[r.difficulty]} · {COLOR_LABEL[r.myColor]}번</span>
                  <span className="record-moves">{r.moves.length}수</span>
                </div>
                <div className="record-date">{formatDate(r.date)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
