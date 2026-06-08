// FR-8: 마지막 수 마커, 승리한 5목 강조
const SIZE = 15;
const CELL = 36;
const PAD = CELL;
const W = CELL * (SIZE - 1) + PAD * 2;
const STONE_R = CELL / 2 - 2;

const STARS = [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]];

export default function Board({ board, onPlace, lastMove, winningLine, disabled, forbiddenCells }) {
  const winSet = winningLine
    ? new Set(winningLine.map(({ row, col }) => `${row},${col}`))
    : null;

  const cx = c => PAD + c * CELL;
  const cy = r => PAD + r * CELL;

  return (
    <div className="board-wrapper">
      <svg
        viewBox={`0 0 ${W} ${W}`}
        className="board-svg"
      >
        <rect width={W} height={W} fill="#dcb06a" />

        {Array.from({ length: SIZE }, (_, i) => (
          <g key={i}>
            <line x1={PAD} y1={cy(i)} x2={cx(SIZE - 1)} y2={cy(i)} stroke="#8b6914" strokeWidth={0.8} />
            <line x1={cx(i)} y1={PAD} x2={cx(i)} y2={cy(SIZE - 1)} stroke="#8b6914" strokeWidth={0.8} />
          </g>
        ))}

        {STARS.map(([r, c]) => (
          <circle key={`s${r}${c}`} cx={cx(c)} cy={cy(r)} r={3} fill="#8b6914" />
        ))}

        {board.map((row, r) => row.map((cell, c) => {
          if (!cell) return null;
          const isWin = winSet?.has(`${r},${c}`);
          const isLast = !isWin && lastMove?.row === r && lastMove?.col === c;
          const fill = cell === 'B' ? '#1a1a1a' : '#f0f0f0';
          const markerFill = cell === 'B' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';
          return (
            <g key={`${r},${c}`}>
              <circle cx={cx(c)} cy={cy(r)} r={STONE_R} fill={fill} stroke={cell === 'B' ? '#000' : '#bbb'} strokeWidth={1} />
              {isWin && <circle cx={cx(c)} cy={cy(r)} r={STONE_R * 0.38} fill={markerFill} />}
              {isLast && <circle cx={cx(c)} cy={cy(r)} r={STONE_R * 0.28} fill={markerFill} />}
            </g>
          );
        }))}

        {/* FR-6: 흑 차례 금수 표시 */}
        {forbiddenCells?.map(({ row: r, col: c }) => (
          <g key={`f${r},${c}`}>
            <line x1={cx(c) - 5} y1={cy(r) - 5} x2={cx(c) + 5} y2={cy(r) + 5} stroke="#e00" strokeWidth={1.5} />
            <line x1={cx(c) + 5} y1={cy(r) - 5} x2={cx(c) - 5} y2={cy(r) + 5} stroke="#e00" strokeWidth={1.5} />
          </g>
        ))}

        {!disabled && board.map((row, r) => row.map((cell, c) => {
          if (cell) return null;
          return (
            <rect
              key={`click${r},${c}`}
              x={cx(c) - CELL / 2} y={cy(r) - CELL / 2}
              width={CELL} height={CELL}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onPlace(r, c)}
            />
          );
        }))}
      </svg>
    </div>
  );
}
