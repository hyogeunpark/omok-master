// FR-8: 마지막 수 마커, 승리한 5목 강조
const SIZE = 15;
const CELL = 36;
const PAD  = CELL;
const W    = CELL * (SIZE - 1) + PAD * 2;
const STONE_R = CELL / 2 - 2;

const HOSHI = [
  [3,3],[3,7],[3,11],
  [7,3],[7,7],[7,11],
  [11,3],[11,7],[11,11],
];

// 카야 나무 결 줄기 — 미세한 사선으로 목재 질감 표현
const GRAIN_LINES = Array.from({ length: 24 }, (_, i) => {
  const spacing = W / 20;
  const y0 = -W * 0.08 + i * spacing;
  return {
    x1: 0, y1: y0,
    x2: W, y2: y0 - W * 0.055,
    opacity: i % 3 === 1 ? 0.09 : 0.045,
    width:   i % 4 === 0 ? 1.4  : 0.8,
  };
});

export default function Board({
  board, onPlace, lastMove, winningLine,
  disabled, forbiddenCells, zoneRange, candidateMarkers,
}) {
  const winSet = winningLine
    ? new Set(winningLine.map(({ row, col }) => `${row},${col}`))
    : null;

  const cx = c => PAD + c * CELL;
  const cy = r => PAD + r * CELL;

  return (
    <div className="board-wrapper">
      <svg viewBox={`0 0 ${W} ${W}`} className="board-svg">
        <defs>
          {/* 카야 나무 베이스 그라디언트 */}
          <linearGradient id="woodGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#d4a455" />
            <stop offset="35%"  stopColor="#c08828" />
            <stop offset="65%"  stopColor="#b07018" />
            <stop offset="100%" stopColor="#c89030" />
          </linearGradient>

          {/* 흑돌 그라디언트 — 상단 좌측에 광원 */}
          <radialGradient id="blackStone" cx="38%" cy="30%" r="62%">
            <stop offset="0%"   stopColor="#5a5a5a" />
            <stop offset="55%"  stopColor="#1c1c1c" />
            <stop offset="100%" stopColor="#080808" />
          </radialGradient>

          {/* 백돌 그라디언트 */}
          <radialGradient id="whiteStone" cx="38%" cy="30%" r="62%">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="55%"  stopColor="#f0ede6" />
            <stop offset="100%" stopColor="#d4d0c6" />
          </radialGradient>

          {/* 돌 그림자 필터 */}
          <filter id="stoneShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="1" dy="2.5" stdDeviation="2.5"
              floodColor="#000" floodOpacity="0.55" />
          </filter>
        </defs>

        {/* ① 바둑판 베이스 — 카야 나무 */}
        <rect width={W} height={W} fill="url(#woodGrad)" />

        {/* ② 나무 결 */}
        {GRAIN_LINES.map((g, i) => (
          <line key={i}
            x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}
            stroke="rgba(90,45,5,1)"
            strokeWidth={g.width}
            opacity={g.opacity}
          />
        ))}

        {/* ③ 바둑판 테두리 */}
        <rect
          x={PAD * 0.46} y={PAD * 0.46}
          width={W - PAD * 0.92} height={W - PAD * 0.92}
          fill="none"
          stroke="rgba(70,38,5,0.35)"
          strokeWidth={1.5}
          rx={2}
        />

        {/* ④ 격자 선 */}
        {Array.from({ length: SIZE }, (_, i) => (
          <g key={i}>
            <line
              x1={cx(0)} y1={cy(i)} x2={cx(SIZE - 1)} y2={cy(i)}
              stroke="rgba(38,18,4,0.72)" strokeWidth={0.9}
            />
            <line
              x1={cx(i)} y1={cy(0)} x2={cx(i)} y2={cy(SIZE - 1)}
              stroke="rgba(38,18,4,0.72)" strokeWidth={0.9}
            />
          </g>
        ))}

        {/* ⑤ 화점 (9개) */}
        {HOSHI.map(([r, c]) => (
          <circle
            key={`h${r}${c}`}
            cx={cx(c)} cy={cy(r)} r={3.8}
            fill="rgba(38,18,4,0.75)"
          />
        ))}

        {/* ⑥ Phase 3: 오프닝 허용 영역 표시 */}
        {zoneRange && (() => {
          const { minR, maxR, minC, maxC } = zoneRange;
          const x1 = cx(minC) - CELL / 2, y1 = cy(minR) - CELL / 2;
          const x2 = cx(maxC) + CELL / 2, y2 = cy(maxR) + CELL / 2;
          return (
            <rect
              x={x1} y={y1} width={x2 - x1} height={y2 - y1}
              fill="rgba(212,175,55,0.07)"
              stroke="#d4af37" strokeWidth={1.5}
              strokeDasharray="6 3" rx={4}
            />
          );
        })()}

        {/* ⑦ 돌 */}
        {board.map((row, r) => row.map((cell, c) => {
          if (!cell) return null;
          const isWin  = winSet?.has(`${r},${c}`);
          const isLast = !isWin && lastMove?.row === r && lastMove?.col === c;
          const fill   = cell === 'B' ? 'url(#blackStone)' : 'url(#whiteStone)';
          const stroke = cell === 'B' ? '#111' : '#c8c4bc';
          const winDot = 'rgba(212,175,55,0.92)';
          const lastDot = cell === 'B' ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)';
          return (
            <g key={`${r},${c}`} filter="url(#stoneShadow)">
              <circle
                cx={cx(c)} cy={cy(r)} r={STONE_R}
                fill={fill} stroke={stroke} strokeWidth={0.5}
              />
              {isWin  && <circle cx={cx(c)} cy={cy(r)} r={STONE_R * 0.36} fill={winDot}  />}
              {isLast && <circle cx={cx(c)} cy={cy(r)} r={STONE_R * 0.24} fill={lastDot} />}
            </g>
          );
        }))}

        {/* ⑧ Phase 3: 선택2 후보 마커 */}
        {candidateMarkers?.map(({ row: r, col: c }, i) => (
          <g key={`cand${r},${c}`}>
            <circle
              cx={cx(c)} cy={cy(r)} r={STONE_R * 0.65}
              fill="rgba(100,185,255,0.42)"
              stroke="rgba(100,185,255,0.88)" strokeWidth={1.3}
            />
            <text
              x={cx(c)} y={cy(r) + 4.5}
              textAnchor="middle" fontSize={11}
              fill="#fff" fontWeight="700"
              fontFamily="Inter, sans-serif"
            >
              {i + 1}
            </text>
          </g>
        ))}

        {/* ⑨ FR-6: 흑 차례 금수 표시 */}
        {forbiddenCells?.map(({ row: r, col: c }) => (
          <g key={`f${r},${c}`}>
            <line
              x1={cx(c) - 5} y1={cy(r) - 5} x2={cx(c) + 5} y2={cy(r) + 5}
              stroke="#ff3333" strokeWidth={2} strokeLinecap="round"
            />
            <line
              x1={cx(c) + 5} y1={cy(r) - 5} x2={cx(c) - 5} y2={cy(r) + 5}
              stroke="#ff3333" strokeWidth={2} strokeLinecap="round"
            />
          </g>
        ))}

        {/* ⑩ 클릭 영역 */}
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
