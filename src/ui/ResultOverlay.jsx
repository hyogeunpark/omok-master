export default function ResultOverlay({ game, onNewGame, onExit }) {
  if (game.status === 'playing') return null;

  const isWin =
    (game.status === 'black-wins' && game.playerColor === 'B') ||
    (game.status === 'white-wins' && game.playerColor === 'W');
  const isDraw = game.status === 'draw';
  const type = isDraw ? 'draw' : isWin ? 'win' : 'lose';

  const mainText = isDraw ? '무승부' : isWin ? '승리' : '패배';
  const subText  = isDraw
    ? '비겼습니다'
    : isWin
    ? '완벽한 승리입니다'
    : '분발하세요';

  const winColor = game.status === 'black-wins' ? '흑' : game.status === 'white-wins' ? '백' : null;
  const winDot   = game.status === 'black-wins' ? 'b' : 'w';

  return (
    <div className={`result-overlay result-overlay--${type}`}>
      {type === 'win' && <div className="result-rays" />}
      <div className="result-center">
        <div className={`result-main-text result-main-text--${type}`}>{mainText}</div>

        {winColor && (
          <div className="result-badge">
            <i className={`stone-dot stone-dot--${winDot} stone-dot--md`} />
            <span>{winColor} 승리</span>
          </div>
        )}

        {type === 'win' && <div className="result-divider" />}

        <p className="result-sub">{subText}</p>

        <div className="result-overlay-btns">
          <button className="result-overlay-btn result-overlay-btn--primary" onClick={onNewGame}>
            새 게임
          </button>
          <button className="result-overlay-btn result-overlay-btn--ghost" onClick={onExit}>
            처음으로
          </button>
        </div>
      </div>
    </div>
  );
}
