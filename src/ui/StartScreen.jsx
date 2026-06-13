const DIFFICULTIES = [
  { key: 'easy',   label: '쉬움',   desc: 'AI가 가끔 실수해요',     level: '01' },
  { key: 'normal', label: '보통',   desc: '균형 잡힌 대국',         level: '02' },
  { key: 'hard',   label: '어려움', desc: '집중해야 이길 수 있어요', level: '03' },
];

export default function StartScreen({ onStart }) {
  return (
    <div className="start-screen">
      <header className="start-header">
        <div className="start-logo">
          <span className="start-logo-stone start-logo-black" />
          <span className="start-logo-stone start-logo-white" />
        </div>
        <h1 className="start-title">오목</h1>
        <p className="start-subtitle">OMOK · ZEN</p>
      </header>

      <main className="start-main">
        <p className="start-section-label">난이도 선택</p>
        <div className="difficulty-list">
          {DIFFICULTIES.map(({ key, label, desc, level }) => (
            <button
              key={key}
              className="difficulty-card"
              onClick={() => onStart(key)}
            >
              <span className="difficulty-level">{level}</span>
              <div className="difficulty-text">
                <span className="difficulty-label">{label}</span>
                <span className="difficulty-desc">{desc}</span>
              </div>
              <span className="difficulty-arrow">→</span>
            </button>
          ))}
        </div>
      </main>

      <footer className="start-footer">
        <div className="start-rules">
          <span>15×15 바둑판</span>
          <span>·</span>
          <span>5목 연속 승리</span>
          <span>·</span>
          <span>렌주 금수</span>
          <span>·</span>
          <span>타라구치-10 오프닝</span>
        </div>
      </footer>

    </div>
  );
}
