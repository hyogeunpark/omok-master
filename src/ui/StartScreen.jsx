// docs/spec/game-modes.md §3 — 모드 선택 → 난이도 선택 2단계
import { useState, useMemo } from 'react';
import { BRAIN_LABEL } from './brainLabel.js';
import StreakBanner from './StreakBanner.jsx';
import { loadRecords } from '../engine/records.js';
import { computeStreaks } from '../engine/streak.js';
import { puzzleNumber, todayResult, PUZZLE_COUNT } from '../engine/puzzle.js';

// docs/spec/game-modes.md §2 모드 정의
const MODES = [
  {
    key: 'quick',
    label: '빠른 대국',
    desc: '바로 시작하는 한 판',
    rule: '오프닝 없음 · 금수 적용',
    recommended: true,
  },
  {
    key: 'renju',
    label: '정석 렌주',
    desc: '타라구치-10 오프닝부터',
    rule: '오프닝 있음 · 금수 적용',
    recommended: false,
  },
];

// brain: CPU 두뇌(탐색 방식) 표시 — docs/spec/ai.md §2 난이도 정의 기준
const DIFFICULTIES = [
  { key: 'easy',   label: '쉬움',   desc: 'AI가 가끔 실수해요',     brain: BRAIN_LABEL.easy,   level: '01' },
  { key: 'normal', label: '보통',   desc: '균형 잡힌 대국',         brain: BRAIN_LABEL.normal, level: '02' },
  { key: 'hard',   label: '어려움', desc: '집중해야 이길 수 있어요', brain: BRAIN_LABEL.hard,   level: '03' },
];

export default function StartScreen({ onStart, onPuzzle }) {
  const [mode, setMode] = useState(null);
  // docs/spec/streak.md §4-1 — 진입 시 스트릭 노출
  const streaks = useMemo(() => computeStreaks(loadRecords()), []);
  // docs/spec/puzzle.md §8 — 오늘의 퍼즐 카드
  const puzzleNo = useMemo(() => puzzleNumber(), []);
  const puzzleDone = useMemo(() => todayResult(), []);

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
        <StreakBanner streaks={streaks} />

        {/* 오늘의 퍼즐 — docs/spec/puzzle.md §8 */}
        {PUZZLE_COUNT > 0 && !mode && (
          <button className="puzzle-card" onClick={onPuzzle}>
            <div className="puzzle-card-text">
              <span className="puzzle-card-title">
                오늘의 퍼즐
                <span className="puzzle-card-no">#{puzzleNo}</span>
              </span>
              <span className="puzzle-card-desc">
                {puzzleDone
                  ? (puzzleDone.solved ? `${puzzleDone.attempts}번째 시도에 성공` : '오늘은 실패 — 결과 보기')
                  : '이기는 한 수를 찾아보세요'}
              </span>
            </div>
            <span className={`puzzle-card-state${puzzleDone ? (puzzleDone.solved ? ' puzzle-card-state--ok' : ' puzzle-card-state--no') : ''}`}>
              {puzzleDone ? (puzzleDone.solved ? '완료' : '실패') : '도전'}
            </span>
          </button>
        )}

        {!mode ? (
          <>
            <p className="start-section-label">모드 선택</p>
            <div className="difficulty-list">
              {MODES.map(({ key, label, desc, rule, recommended }) => (
                <button
                  key={key}
                  className={`difficulty-card${recommended ? ' difficulty-card--rec' : ''}`}
                  onClick={() => setMode(key)}
                >
                  <div className="difficulty-text">
                    <span className="difficulty-label">
                      {label}
                      {recommended && <span className="mode-rec">추천</span>}
                    </span>
                    <span className="difficulty-desc">{desc}</span>
                    <span className="difficulty-brain">{rule}</span>
                  </div>
                  <span className="difficulty-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="start-section-head">
              <button className="btn-back" onClick={() => setMode(null)}>← 모드</button>
              <p className="start-section-label">
                난이도 선택
                <span className="start-mode-tag">
                  {MODES.find((m) => m.key === mode).label}
                </span>
              </p>
            </div>
            <div className="difficulty-list">
              {DIFFICULTIES.map(({ key, label, desc, brain, level }) => (
                <button
                  key={key}
                  className="difficulty-card"
                  onClick={() => onStart(mode, key)}
                >
                  <span className="difficulty-level">{level}</span>
                  <div className="difficulty-text">
                    <span className="difficulty-label">{label}</span>
                    <span className="difficulty-desc">{desc}</span>
                    <span className="difficulty-brain">{brain}</span>
                  </div>
                  <span className="difficulty-arrow">→</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="start-footer">
        <div className="start-rules">
          <span>15×15 바둑판</span>
          <span>·</span>
          <span>5목 연속 승리</span>
          <span>·</span>
          <span>렌주 금수</span>
          {mode !== 'quick' && (
            <>
              <span>·</span>
              <span>타라구치-10 오프닝</span>
            </>
          )}
        </div>
      </footer>

    </div>
  );
}
