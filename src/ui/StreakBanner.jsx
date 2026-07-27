// docs/spec/streak.md §4 — 스트릭 노출 공용 컴포넌트
// variant: 'banner'(시작 화면 상단) | 'bar'(기보 탭 요약)

export default function StreakBanner({ streaks, variant = 'banner' }) {
  const { daily, dailyBest, win, winBest, playedToday } = streaks;

  // §4-1 기록이 없으면 표시하지 않는다 (빈 지표는 동기를 주지 않는다)
  if (daily === 0 && dailyBest === 0 && win === 0 && winBest === 0) return null;

  if (variant === 'bar') {
    return (
      <div className="streak-bar">
        <div className="streak-bar-item">
          <span className="streak-bar-label">출석</span>
          <span className="streak-bar-value">{daily}<em>일</em></span>
          <span className="streak-bar-best">최고 {dailyBest}일</span>
        </div>
        <span className="streak-bar-sep" />
        <div className="streak-bar-item">
          <span className="streak-bar-label">연승</span>
          <span className="streak-bar-value">{win}<em>연승</em></span>
          <span className="streak-bar-best">최고 {winBest}연승</span>
        </div>
      </div>
    );
  }

  // §4-1 시작 화면 배너 — 출석이 주인공
  // 스트릭이 끊긴 상태(daily=0)에 '0일 연속'을 크게 띄우면 의욕을 꺾는다 → 재시작 유도로 대체
  if (daily === 0) {
    return (
      <div className="streak-banner streak-banner--idle">
        <div className="streak-main">
          <span className="streak-flame" aria-hidden="true">◇</span>
          <span className="streak-idle-text">오늘 한 판으로 다시 시작</span>
        </div>
        <span className="streak-sub">최고 {dailyBest}일</span>
      </div>
    );
  }

  return (
    <div className="streak-banner">
      <div className="streak-main">
        <span className="streak-flame" aria-hidden="true">◆</span>
        <span className="streak-days">{daily}</span>
        <span className="streak-unit">일 연속</span>
      </div>
      <div className="streak-side">
        {playedToday
          ? <span className="streak-sub">최고 {dailyBest}일</span>
          : <span className="streak-nudge">오늘 한 판이면 {daily + 1}일째</span>}
        {win >= 2 && <span className="streak-win">{win}연승 중</span>}
      </div>
    </div>
  );
}
