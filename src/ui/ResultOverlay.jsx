export default function ResultOverlay({ game, timeoutLoser, onNewGame, onExit }) {
  const isOver = game.status !== 'playing' || !!timeoutLoser;
  if (!isOver) return null;

  let isWin, isDraw;
  if (timeoutLoser) {
    isWin  = timeoutLoser === 'cpu';
    isDraw = false;
  } else {
    isWin  = (game.status === 'black-wins' && game.playerColor === 'B') ||
             (game.status === 'white-wins' && game.playerColor === 'W');
    isDraw = game.status === 'draw';
  }

  const type     = isDraw ? 'draw' : isWin ? 'win' : 'lose';
  const mainText = isDraw ? '무승부' : isWin ? '승리' : '패배';
  const subText  = timeoutLoser
    ? (isWin ? '시간 초과 승리' : '시간 초과')
    : isDraw
    ? '비겼습니다'
    : isWin
    ? '완벽한 승리입니다'
    : '분발하세요';

  let winColor = null, winDot = null;
  if (!isDraw) {
    const winnerColor = timeoutLoser
      ? (timeoutLoser === 'player' ? game.cpuColor : game.playerColor)
      : (game.status === 'black-wins' ? 'B' : 'W');
    winColor = winnerColor === 'B' ? '흑' : '백';
    winDot   = winnerColor === 'B' ? 'b' : 'w';
  }

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
