// docs/spec/puzzle.md §8 — 데일리 퍼즐 화면
import { useState, useMemo, useCallback } from 'react';
import Board from './Board.jsx';
import { isForbidden } from '../engine/forbidden.js';
import {
  MAX_ATTEMPTS,
  puzzleNumber, todayPuzzle, puzzleBoard, isSolution,
  loadPuzzleLog, todayResult, recordResult, puzzleStreak, shareText, attemptMarks,
} from '../engine/puzzle.js';

const DIFF_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };

export default function PuzzleScreen({ onExit }) {
  const number  = useMemo(() => puzzleNumber(), []);
  const puzzle  = useMemo(() => todayPuzzle(), []);
  const board0  = useMemo(() => puzzleBoard(puzzle), [puzzle]);

  // §5 하루 한 번 — 이미 푼 날이면 결과부터 보여준다
  const [result, setResult]   = useState(() => todayResult());
  const [attempts, setAttempts] = useState(0);
  const [wrongAt, setWrongAt] = useState(null);   // 마지막 오답 자리
  const [hint, setHint]       = useState(null);   // 오답 사유(금수 등)
  const [copied, setCopied]   = useState(false);

  // 스트릭은 기록이 바뀔 때만 갱신한다(localStorage를 매 렌더 읽지 않도록)
  const [streak, setStreak] = useState(() => puzzleStreak(loadPuzzleLog()).current);
  const done = result !== null;

  // 정답 공개용 보드 (실패했거나 이미 푼 뒤)
  const board = useMemo(() => {
    if (!done || !puzzle) return board0;
    const b = board0.map(r => [...r]);
    if (!result.solved) for (const [r, c] of puzzle.solution) b[r][c] = 'B';
    return b;
  }, [done, result, board0, puzzle]);

  const handlePlace = useCallback((row, col) => {
    if (done || !puzzle) return;
    const n = attempts + 1;
    setAttempts(n);

    if (isSolution(puzzle, row, col)) {
      const r = { solved: true, attempts: n };
      recordResult(r);
      setResult(r);
      setStreak(puzzleStreak(loadPuzzleLog()).current);
      setWrongAt(null);
      setHint(null);
      return;
    }

    // 오답 — 금수면 알려준다 (§5 학습 효과)
    setWrongAt({ row, col });
    setHint(isForbidden(board0, row, col, 'B') ? '금수 자리입니다' : null);

    if (n >= MAX_ATTEMPTS) {
      const r = { solved: false, attempts: n };
      recordResult(r);
      setResult(r);
    }
  }, [done, puzzle, attempts, board0]);

  const handleShare = useCallback(async () => {
    const text = shareText(result, number, streak);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied('manual'); // §7 클립보드 실패 시 직접 복사하도록 노출
    }
  }, [result, number, streak]);

  if (!puzzle) {
    return (
      <div className="tab-screen">
        <header className="tab-screen-header">
          <button className="btn-back" onClick={onExit}>← 나가기</button>
        </header>
        <div className="tab-empty"><p>준비된 퍼즐이 없습니다</p></div>
      </div>
    );
  }

  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <div className="game">
      <Board
        board={board}
        onPlace={handlePlace}
        lastMove={wrongAt}
        winningLine={null}
        disabled={done}
        forbiddenCells={[]}
        zoneRange={null}
        candidateMarkers={done && !result.solved ? puzzle.solution.map(([row, col]) => ({ row, col })) : []}
      />

      <div className="game-side">
        <div className="game-header">
          <button className="btn-back" onClick={onExit}>← 나가기</button>
        </div>

        <div className="hud-zone">
          <span className="hud-zone-label">
            오늘의 퍼즐
            <span className="hud-mode">#{number}</span>
          </span>
          <div className="hud-readout">
            <span className="hud-readout-lab">흑 차례</span>
            <span className="hud-readout-val">
              <b>이기는 한 수</b>
              <span className="hud-readout-sep">·</span>
              <span className="hud-method">{DIFF_LABEL[puzzle.difficulty]}</span>
            </span>
          </div>
        </div>

        <div className="hud-zone">
          <span className="hud-zone-label">상태</span>
          {!done ? (
            <div className="puzzle-status">
              <span className="puzzle-attempts">{attemptMarks({ solved: false, attempts })}</span>
              <span className="puzzle-msg">
                {attempts === 0 ? '이기는 자리를 골라보세요' : `${hint ?? '아닙니다'} — ${remaining}번 남음`}
              </span>
            </div>
          ) : (
            <div className={`puzzle-result puzzle-result--${result.solved ? 'win' : 'lose'}`}>
              <span className="puzzle-result-main">
                {result.solved ? `${result.attempts}번째 시도에 성공` : '아쉽네요'}
              </span>
              <span className="puzzle-result-sub">
                {result.solved
                  ? (streak > 0 ? `퍼즐 ${streak}일 연속` : '내일 또 만나요')
                  : '정답을 표시했습니다'}
              </span>
            </div>
          )}
        </div>

        {done && (
          <div className="game-actions">
            <button onClick={handleShare}>
              {copied === true ? '복사했어요' : copied === 'manual' ? '복사 실패' : '결과 공유'}
            </button>
            <button onClick={onExit}>처음으로</button>
          </div>
        )}

        {copied === 'manual' && (
          <textarea className="puzzle-share-fallback" readOnly value={shareText(result, number, streak)} />
        )}
      </div>
    </div>
  );
}
