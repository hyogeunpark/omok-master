import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createGame, placeStone, undoMove,
  performOpeningSwap, skipOpeningSwap,
  selectOpeningBranch, addOpeningCandidate, pickOpeningCandidate,
} from '../engine/game.js';
import {
  getCpuMove, getCpuOpeningMove, cpuShouldSwap,
  cpuSelectBranch, cpuProposeOpeningCandidates, cpuPickOpeningCandidate,
} from '../ai/cpu.js';
import { isForbidden } from '../engine/forbidden.js';
import { getZoneRange } from '../engine/opening.js';
import { saveRecord } from '../engine/records.js';
import Board from './Board.jsx';
import ResultOverlay from './ResultOverlay.jsx';

function statusMessage(game) {
  if (game.status === 'draw') return '무승부';
  if (game.status === 'black-wins') return game.playerColor === 'B' ? '승리!' : '패배';
  if (game.status === 'white-wins') return game.playerColor === 'W' ? '승리!' : '패배';
  return null;
}


function getCpuOpeningAction(game) {
  const { opening, cpuColor } = game;
  if (!opening) return null;
  const { phase, step, branch } = opening;

  if (phase === 'place' && game.currentTurn === cpuColor) return 'place';

  const swapOwner = (() => {
    if (step === 1) return 'W';
    if (step === 2) return 'B';
    if (step === 3) return 'W';
    if (step === 4 && branch === 1) return 'B';
    if (step === 5 && branch === 1) return 'W';
    return null;
  })();
  if (phase === 'await-swap' && swapOwner === cpuColor) return 'swap';
  if (phase === 'await-branch' && cpuColor === 'W') return 'branch';
  if (phase === 'await-candidates' && cpuColor === 'B') return 'candidates';
  if (phase === 'await-candidate-pick' && cpuColor === 'W') return 'pick-candidate';
  return null;
}

export default function Game({ difficulty, onExit }) {
  const [game, setGame] = useState(() => createGame());
  const [thinking, setThinking] = useState(false);
  const pendingRef = useRef(false);
  const savedRef = useRef(false);

  // ── 오프닝 + 일반 CPU 처리 ──
  const op = game.opening;
  const isOpeningActive = !!op;
  const cpuAction = getCpuOpeningAction(game);
  const isRegularCpuTurn = !isOpeningActive && game.status === 'playing' && game.currentTurn === game.cpuColor;
  const needsCpuAction = isOpeningActive ? !!cpuAction : isRegularCpuTurn;

  useEffect(() => {
    if (!needsCpuAction || pendingRef.current) return;
    pendingRef.current = true;
    setThinking(true);

    const id = setTimeout(() => {
      setGame(g => {
        const action = getCpuOpeningAction(g);
        if (action === 'place') {
          const op = g.opening;
          const move = getCpuOpeningMove(g.board.map(r => [...r]), g.cpuColor, op.step, op.branch, difficulty);
          return placeStone(g, move.row, move.col);
        }
        if (action === 'swap') {
          const justPlayed = g.opening.step % 2 === 1 ? 'B' : 'W';
          const doSwap = cpuShouldSwap(g.board.map(r => [...r]), justPlayed, difficulty);
          return doSwap ? performOpeningSwap(g) : skipOpeningSwap(g);
        }
        if (action === 'branch') {
          const branch = cpuSelectBranch(g.board.map(r => [...r]), difficulty);
          return selectOpeningBranch(g, branch);
        }
        if (action === 'candidates') {
          const cands = cpuProposeOpeningCandidates(g.board.map(r => [...r]), difficulty);
          let next = g;
          for (const { row, col } of cands) next = addOpeningCandidate(next, row, col);
          return next;
        }
        if (action === 'pick-candidate') {
          const pick = cpuPickOpeningCandidate(g.board.map(r => [...r]), g.opening.candidates, difficulty);
          return pickOpeningCandidate(g, pick.row, pick.col);
        }
        const move = getCpuMove(g.board.map(r => [...r]), g.cpuColor, difficulty);
        return placeStone(g, move.row, move.col);
      });
      pendingRef.current = false;
      setThinking(false);
    }, 300);

    return () => { clearTimeout(id); pendingRef.current = false; };
  }, [needsCpuAction, game.opening?.phase, game.opening?.step, game.currentTurn, difficulty]);

  // ── 플레이어 입력 ──
  const playerSwapOwner = (() => {
    if (!op || op.phase !== 'await-swap') return false;
    const owner = (() => {
      if (op.step === 1) return 'W';
      if (op.step === 2) return 'B';
      if (op.step === 3) return 'W';
      if (op.step === 4 && op.branch === 1) return 'B';
      if (op.step === 5 && op.branch === 1) return 'W';
      return null;
    })();
    return owner === game.playerColor;
  })();

  const handlePlace = useCallback((row, col) => {
    if (thinking || game.status !== 'playing') return;
    if (op) {
      if (op.phase === 'await-swap' && playerSwapOwner) {
        setGame(g => placeStone(skipOpeningSwap(g), row, col));
        return;
      }
      if (op.phase === 'place' && game.currentTurn === game.playerColor)
        setGame(g => placeStone(g, row, col));
      else if (op.phase === 'await-candidates' && game.playerColor === 'B')
        setGame(g => addOpeningCandidate(g, row, col));
      return;
    }
    if (game.currentTurn !== game.playerColor) return;
    setGame(g => placeStone(g, row, col));
  }, [thinking, game.status, game.currentTurn, game.playerColor, op, playerSwapOwner]);

  const handleSwap     = useCallback((doSwap) => { setGame(g => doSwap ? performOpeningSwap(g) : skipOpeningSwap(g)); }, []);
  const handleBranch   = useCallback((branch) => { setGame(g => selectOpeningBranch(g, branch)); }, []);
  const handlePickCandidate = useCallback((row, col) => { setGame(g => pickOpeningCandidate(g, row, col)); }, []);

  const handleUndo = useCallback(() => {
    if (thinking || isOpeningActive) return;
    setGame(g => undoMove(g));
  }, [thinking, isOpeningActive]);

  // 게임 종료 시 기보 저장 (docs/spec/nav.md §5-2)
  useEffect(() => {
    if (game.status === 'playing' || savedRef.current) return;
    savedRef.current = true;
    const result = game.status === 'draw' ? 'draw'
      : (game.status === 'black-wins' && game.playerColor === 'B') ||
        (game.status === 'white-wins' && game.playerColor === 'W') ? 'win' : 'lose';
    saveRecord({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      difficulty,
      myColor: game.playerColor,
      result,
      moves: game.history,
    });
  }, [game.status, game.playerColor, difficulty]);

  const handleNewGame = useCallback(() => {
    pendingRef.current = false;
    savedRef.current = false;
    setThinking(false);
    setGame(createGame());
  }, []);

  const msg    = statusMessage(game);
  const canUndo = !thinking && !isOpeningActive && game.history.length >= 2;

  const boardDisabled = thinking || game.status !== 'playing' || (() => {
    if (!op) return game.currentTurn !== game.playerColor;
    if (op.phase === 'await-swap' && playerSwapOwner) return false;
    if (op.phase === 'place') return game.currentTurn !== game.playerColor;
    if (op.phase === 'await-candidates' && game.playerColor === 'B') return false;
    if (op.phase === 'await-candidate-pick' && game.playerColor === 'W') return false;
    return true;
  })();

  const openingStepLabel      = op ? `오프닝 ${op.step}수` : null;
  const playerBranchOwner     = op?.phase === 'await-branch'         && game.playerColor === 'W';
  const playerCandidateOwner  = op?.phase === 'await-candidates'     && game.playerColor === 'B';
  const playerPickOwner       = op?.phase === 'await-candidate-pick' && game.playerColor === 'W';
  const candidateMarkers      = (op?.phase === 'await-candidate-pick' && op.candidates) ? op.candidates : [];

  const playerDot   = game.playerColor === 'B' ? 'b' : 'w';
  const cpuDot      = game.cpuColor    === 'B' ? 'b' : 'w';
  const playerLabel = game.playerColor === 'B' ? '흑' : '백';
  const cpuLabel    = game.cpuColor    === 'B' ? '흑' : '백';

  const forbiddenCells = useMemo(() => {
    if (isOpeningActive || game.status !== 'playing' || game.currentTurn !== 'B') return [];
    const cells = [];
    for (let r = 0; r < 15; r++)
      for (let c = 0; c < 15; c++)
        if (game.board[r][c] === null && isForbidden(game.board, r, c, 'B'))
          cells.push({ row: r, col: c });
    return cells;
  }, [game.board, game.status, game.currentTurn, isOpeningActive]);

  const zoneRange = useMemo(() => {
    if (!op || op.phase !== 'place') return null;
    return getZoneRange(op.step, op.branch);
  }, [op]);

  return (
    <div className="game">
      <Board
        board={game.board}
        onPlace={playerPickOwner ? handlePickCandidate : handlePlace}
        lastMove={game.lastMove}
        winningLine={game.winningLine}
        disabled={boardDisabled}
        forbiddenCells={forbiddenCells}
        zoneRange={zoneRange}
        candidateMarkers={candidateMarkers}
      />

      <div className="game-side">
        {/* 헤더 */}
        <div className="game-header">
          <button className="btn-back" onClick={onExit}>← 나가기</button>
          <div className="color-info">
            <div className="color-info-item">
              <i className={`stone-dot stone-dot--${playerDot}`} />
              <span>나 <em>{playerLabel}</em></span>
            </div>
            <span className="color-info-sep" />
            <div className="color-info-item">
              <i className={`stone-dot stone-dot--${cpuDot}`} />
              <span>CPU <em>{cpuLabel}</em></span>
            </div>
            {op && <span className="color-info-tentative">(잠정)</span>}
          </div>
        </div>

        {/* 오프닝 UI */}
        {op && !thinking && (
          <div className="opening-prompt">
            <div className="opening-step-label">{openingStepLabel}</div>
            {playerSwapOwner && (
              <div className="opening-action">
                <p className="opening-desc">색을 교환할 수 있습니다. 그냥 돌을 두면 교환 없이 진행됩니다.</p>
                <div className="opening-btns"><button onClick={() => handleSwap(true)}>Swap</button></div>
              </div>
            )}
            {playerBranchOwner && (
              <div className="opening-action">
                <p className="opening-desc">5수 방식을 선택하세요</p>
                <div className="opening-btns">
                  <button onClick={() => handleBranch(1)}>선택 1 — 스왑 후 9×9</button>
                  <button onClick={() => handleBranch(2)}>선택 2 — 후보 10개</button>
                </div>
              </div>
            )}
            {playerCandidateOwner && (
              <div className="opening-action">
                <p className="opening-desc">5수 후보를 {10 - op.candidates.length}개 더 선택하세요 (보드 클릭)</p>
              </div>
            )}
            {playerPickOwner && (
              <div className="opening-action">
                <p className="opening-desc">후보 중 하나를 선택하세요 (보드 클릭)</p>
              </div>
            )}
          </div>
        )}

        {/* 상태 표시 */}
        <div className="game-status">
          {thinking && <span className="thinking-indicator">CPU 생각 중…</span>}
          {!thinking && !msg && !op && (
            <span className="turn-text">
              {game.currentTurn === game.playerColor ? '내 차례' : 'CPU 차례'}
            </span>
          )}
          {!thinking && !msg && op?.phase === 'place' && (
            <span className="turn-text">
              {game.currentTurn === game.playerColor
                ? `${openingStepLabel} — 내 차례`
                : `${openingStepLabel} — CPU 차례`}
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="game-actions">
          <button onClick={handleUndo} disabled={!canUndo}>되돌리기</button>
          <button onClick={handleNewGame}>새 게임</button>
        </div>
      </div>

      <ResultOverlay
        game={game}
        timeoutLoser={null}
        onNewGame={handleNewGame}
        onExit={onExit}
      />
    </div>
  );
}
