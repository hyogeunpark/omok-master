// FR-3: 난이도 3단계 / FR-4: 되돌리기 / FR-5: 색 선택
export default function Controls({ game, difficulty, thinking, onUndo, onNewGame, onColorChange, onDifficultyChange }) {
  const canUndo = !thinking && game.history.length >= 2;

  return (
    <div className="controls">
      <div className="control-row">
        <span className="control-label">내 색</span>
        <div className="btn-group">
          {[['B', '흑 (선공)'], ['W', '백 (후공)']].map(([color, label]) => (
            <button
              key={color}
              className={game.playerColor === color ? 'active' : ''}
              onClick={() => onColorChange(color)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-row">
        <span className="control-label">난이도</span>
        <div className="btn-group">
          {[['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']].map(([d, label]) => (
            <button
              key={d}
              className={difficulty === d ? 'active' : ''}
              onClick={() => onDifficultyChange(d)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="control-row">
        <button onClick={onUndo} disabled={!canUndo}>되돌리기</button>
        <button onClick={onNewGame}>새 게임</button>
      </div>

      {thinking && <div className="thinking-indicator">CPU 생각 중…</div>}
    </div>
  );
}
