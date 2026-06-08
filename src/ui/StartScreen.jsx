// FR-9: Kick-off 페이지 — 난이도 선택 후 게임 시작
const DIFFICULTIES = [
  { key: 'easy',   label: '쉬움',   desc: 'AI가 가끔 실수해요' },
  { key: 'normal', label: '보통',   desc: '균형 잡힌 대국' },
  { key: 'hard',   label: '어려움', desc: '집중해야 이길 수 있어요' },
];

export default function StartScreen({ onStart }) {
  return (
    <div className="start-screen">
      <h1 className="start-title">오목</h1>
      <p className="start-subtitle">난이도를 선택하세요</p>
      <div className="difficulty-list">
        {DIFFICULTIES.map(({ key, label, desc }) => (
          <button
            key={key}
            className="difficulty-card"
            onClick={() => onStart(key)}
          >
            <span className="difficulty-label">{label}</span>
            <span className="difficulty-desc">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
