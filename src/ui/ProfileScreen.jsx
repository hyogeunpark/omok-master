// docs/spec/nav.md §6 프로필 탭
import { loadRecords } from '../engine/records.js';

function computeStats(records) {
  const total = records.length;
  const win   = records.filter(r => r.result === 'win').length;
  const lose  = records.filter(r => r.result === 'lose').length;
  const draw  = records.filter(r => r.result === 'draw').length;
  const winRate = win + lose > 0 ? ((win / (win + lose)) * 100).toFixed(1) : null;

  const byDifficulty = ['easy', 'normal', 'hard'].map(diff => {
    const sub  = records.filter(r => r.difficulty === diff);
    const dWin  = sub.filter(r => r.result === 'win').length;
    const dLose = sub.filter(r => r.result === 'lose').length;
    const rate  = dWin + dLose > 0 ? ((dWin / (dWin + dLose)) * 100).toFixed(1) : null;
    return { diff, win: dWin, total: sub.length, rate };
  });

  return { total, win, lose, draw, winRate, byDifficulty };
}

const DIFF_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };

export default function ProfileScreen() {
  const records = loadRecords();
  const { total, win, lose, draw, winRate, byDifficulty } = computeStats(records);

  return (
    <div className="tab-screen">
      <header className="tab-screen-header">
        <h2 className="tab-screen-title">프로필</h2>
      </header>

      <div className="tab-screen-content">
        {total === 0 ? (
          <div className="tab-empty">
            <span className="tab-empty-icon">◉</span>
            <p>아직 대국 기록이 없습니다</p>
          </div>
        ) : (
          <>
            {/* 종합 통계 */}
            <section className="rules-section">
              <h3 className="rules-section-title">종합</h3>
              <div className="stats-grid">
                <div className="stats-cell">
                  <span className="stats-value">{total}</span>
                  <span className="stats-label">총 대국</span>
                </div>
                <div className="stats-cell stats-cell--win">
                  <span className="stats-value">{win}</span>
                  <span className="stats-label">승</span>
                </div>
                <div className="stats-cell">
                  <span className="stats-value">{lose}</span>
                  <span className="stats-label">패</span>
                </div>
                <div className="stats-cell">
                  <span className="stats-value">{draw}</span>
                  <span className="stats-label">무</span>
                </div>
                <div className="stats-cell stats-cell--rate">
                  <span className="stats-value">{winRate ?? '-'}{winRate && '%'}</span>
                  <span className="stats-label">승률</span>
                </div>
              </div>
            </section>

            {/* 난이도별 승률 */}
            <section className="rules-section">
              <h3 className="rules-section-title">난이도별</h3>
              <div className="difficulty-stats">
                {byDifficulty.map(({ diff, win: dw, total: dt, rate }) => (
                  <div key={diff} className="difficulty-stat-row">
                    <span className="difficulty-stat-label">{DIFF_LABEL[diff]}</span>
                    <span className="difficulty-stat-count">{dw} / {dt}국</span>
                    <span className="difficulty-stat-rate">{rate != null ? `${rate}%` : '-'}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
