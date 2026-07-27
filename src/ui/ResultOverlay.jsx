export default function ResultOverlay({ game, timeoutLoser, streaks, onNewGame, onExit }) {
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

        {/* 스트릭 — 감정이 가장 높은 시점 (docs/spec/streak.md §4-2)
            승리 + 2연승 이상일 때만 연승을 강조하고, 패배 시엔 강조하지 않는다. */}
        {streaks && (streaks.daily > 0 || (type === 'win' && streaks.win >= 2)) && (
          <div className="result-streaks">
            {type === 'win' && streaks.win >= 2 && (
              <span className="result-streak result-streak--win">{streaks.win}연승</span>
            )}
            {streaks.daily > 0 && (
              <span className="result-streak">{streaks.daily}일 연속</span>
            )}
          </div>
        )}

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
