// docs/spec/nav.md §4 규칙 탭

// 돌 배치를 받아 미니 보드 렌더링 (· 빈칸, B 흑, W 백, X 금수)
function MiniBoard({ rows }) {
  return (
    <div className="mini-board">
      {rows.map((row, r) => (
        <div key={r} className="mini-board-row">
          {row.map((cell, c) => (
            <div key={c} className="mini-cell">
              {cell === 'B' && <div className="mini-stone mini-stone--b" />}
              {cell === 'W' && <div className="mini-stone mini-stone--w" />}
              {cell === 'X' && <div className="mini-stone mini-stone--x" />}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const DOUBLE_THREE = [
  ['·','·','·','·','·','·','·'],
  ['·','B','B','X','B','·','·'],
  ['·','·','·','B','·','·','·'],
  ['·','·','·','B','·','·','·'],
  ['·','·','·','·','·','·','·'],
];

const DOUBLE_FOUR = [
  ['·','·','·','·','·','·','·'],
  ['·','B','B','X','B','·','·'],
  ['·','·','·','B','·','·','·'],
  ['·','·','·','B','·','·','·'],
  ['·','·','·','B','·','·','·'],
];

const OVERLINE = [
  ['·','·','·','·','·','·','·'],
  ['·','B','B','X','B','B','B'],
  ['·','·','·','·','·','·','·'],
];

export default function RulesScreen() {
  return (
    <div className="tab-screen">
      <header className="tab-screen-header">
        <h2 className="tab-screen-title">게임 규칙</h2>
      </header>

      <div className="tab-screen-content">

        {/* 기본 규칙 */}
        <section className="rules-section">
          <h3 className="rules-section-title">기본 규칙</h3>
          <ul className="rules-list">
            <li>15 × 15 격자판의 <strong>교점</strong>에 번갈아 돌을 놓습니다.</li>
            <li>흑이 먼저 시작하며, 가로·세로·대각선 중 한 방향으로 <strong>5개 연속</strong>이면 승리합니다.</li>
            <li>보드가 모두 채워지고 승자가 없으면 <strong>무승부</strong>입니다.</li>
          </ul>
        </section>

        {/* 렌주 금수 */}
        <section className="rules-section">
          <h3 className="rules-section-title">렌주 금수 (흑 전용)</h3>
          <p className="rules-desc">흑은 아래 수를 둘 수 없습니다. 백에게는 적용되지 않습니다.</p>

          <div className="rules-forbidden-list">
            <div className="rules-forbidden-item">
              <div className="rules-forbidden-label">
                <span className="rules-forbidden-badge">3-3 금수</span>
                <span className="rules-forbidden-note">열린 3이 두 방향 이상 동시 생성</span>
              </div>
              <MiniBoard rows={DOUBLE_THREE} />
            </div>

            <div className="rules-forbidden-item">
              <div className="rules-forbidden-label">
                <span className="rules-forbidden-badge">4-4 금수</span>
                <span className="rules-forbidden-note">4목이 두 방향 이상 동시 생성</span>
              </div>
              <MiniBoard rows={DOUBLE_FOUR} />
            </div>

            <div className="rules-forbidden-item">
              <div className="rules-forbidden-label">
                <span className="rules-forbidden-badge">장목 금수</span>
                <span className="rules-forbidden-note">6목 이상 연속 (백에게는 승리)</span>
              </div>
              <MiniBoard rows={OVERLINE} />
            </div>
          </div>
          <p className="rules-legend"><span className="mini-stone mini-stone--x rules-legend-stone" /> = 착수 불가(금수)</p>
        </section>

        {/* 타라구치-10 오프닝 */}
        <section className="rules-section">
          <h3 className="rules-section-title">타라구치-10 오프닝</h3>
          <p className="rules-desc">공정한 시작을 위한 오프닝 절차입니다.</p>
          <ol className="rules-opening-list">
            <li><strong>1~3수 배치</strong> — 흑이 1·3수(흑), 백이 2수(백)를 지정 구역에 배치합니다.</li>
            <li><strong>스왑 선택</strong> — 각 단계마다 지정된 플레이어가 흑·백을 교환할지 선택합니다.</li>
            <li><strong>5수 선택</strong> — 백이 진행 방식(스왑 후 9×9 구역 / 후보 10개 중 선택)을 결정합니다.</li>
          </ol>
          <p className="rules-desc">CPU는 난이도에 따라 스왑·후보 선택을 자동으로 판단합니다.</p>
        </section>

      </div>
    </div>
  );
}
