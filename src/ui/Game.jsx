import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createGame, placeStone, undoMove,
  performOpeningSwap, skipOpeningSwap,
  selectOpeningBranch, addOpeningCandidate, pickOpeningCandidate,
} from '../engine/game.js';
// docs/spec/ai-player.md §6 — player 인터페이스로 통신
import { isForbidden } from '../engine/forbidden.js';
import { getZoneRange } from '../engine/opening.js';
import { saveRecord, loadRecords } from '../engine/records.js';
import { computeStreaks } from '../engine/streak.js';
import { playStoneSound } from './sound.js';
import Board from './Board.jsx';
import ResultOverlay from './ResultOverlay.jsx';
import { BRAIN_META } from './brainLabel.js';

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

export default function Game({ player, difficulty, mode = 'renju', onExit }) {
  // docs/spec/game-modes.md §2 — 빠른 대국은 오프닝 생략(금수는 유지)
  const useOpening = mode !== 'quick';
  const [game, setGame] = useState(() => createGame({ useOpening }));
  const [thinking, setThinking] = useState(false);
  const [thinkingDepth, setThinkingDepth] = useState(0); // hard 실시간 탐색 깊이 (§6-A)
  const [streaks, setStreaks] = useState(null); // 종료 시 계산 (docs/spec/streak.md §4-2)
  const pendingRef = useRef(false);
  const savedRef = useRef(false);
  const workerRef = useRef(null);
  const reqIdRef = useRef(0);
  const thinkStartRef = useRef(0);
  const applyTimerRef = useRef(null);

  // ── AI 탐색 Web Worker (docs/spec/ai-player.md §6-A) ──
  useEffect(() => {
    const worker = new Worker(new URL('../ai/aiWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e) => {
      const { type, depth, move, reqId } = e.data;
      if (reqId !== reqIdRef.current) return; // 오래된 응답 무시
      if (type === 'depth') {
        setThinkingDepth(depth);
      } else if (type === 'move') {
        const MIN_MS = 320; // 일관된 "생각하는" 텀 (fast 난이도도 툭 튀지 않게)
        const wait = Math.max(0, MIN_MS - (Date.now() - thinkStartRef.current));
        applyTimerRef.current = setTimeout(() => {
          if (reqId !== reqIdRef.current) return;
          setGame((g) => placeStone(g, move.row, move.col));
          pendingRef.current = false;
          setThinking(false);
        }, wait);
      } else if (type === 'error') {
        pendingRef.current = false;
        setThinking(false);
      }
    };
    return () => { clearTimeout(applyTimerRef.current); worker.terminate(); };
  }, []);

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
    setThinkingDepth(0);

    // 오프닝 액션(스왑/분기/후보/구역 착수): 빠르므로 메인 스레드에서 동기 처리
    if (isOpeningActive && cpuAction) {
      const id = setTimeout(() => {
        setGame(g => {
          const action = getCpuOpeningAction(g);
          if (action === 'place') {
            const op = g.opening;
            const move = player.getOpeningMove(g.board.map(r => [...r]), g.cpuColor, op.step, op.branch);
            return placeStone(g, move.row, move.col);
          }
          if (action === 'swap') {
            const justPlayed = g.opening.step % 2 === 1 ? 'B' : 'W';
            const doSwap = player.shouldSwap(g.board.map(r => [...r]), justPlayed);
            return doSwap ? performOpeningSwap(g) : skipOpeningSwap(g);
          }
          if (action === 'branch') {
            return selectOpeningBranch(g, player.selectBranch(g.board.map(r => [...r])));
          }
          if (action === 'candidates') {
            let next = g;
            for (const { row, col } of player.proposeOpeningCandidates(g.board.map(r => [...r]))) next = addOpeningCandidate(next, row, col);
            return next;
          }
          const pick = player.pickOpeningCandidate(g.board.map(r => [...r]), g.opening.candidates);
          return pickOpeningCandidate(g, pick.row, pick.col);
        });
        pendingRef.current = false;
        setThinking(false);
      }, 300);
      return () => { clearTimeout(id); pendingRef.current = false; };
    }

    // 일반 대국 getMove: 워커에서 탐색 (실시간 깊이 보고 + 메인 스레드 안 얼음)
    const reqId = ++reqIdRef.current;
    thinkStartRef.current = Date.now();
    workerRef.current.postMessage({
      board: game.board.map(r => [...r]),
      color: game.cpuColor,
      difficulty,
      reqId,
    });
    // 응답은 worker.onmessage에서 처리
  }, [needsCpuAction, game.opening?.phase, game.opening?.step, game.currentTurn, player, difficulty]);

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

  // 착수마다 효과음 (플레이어·CPU 모두)
  useEffect(() => {
    if (game.history.length > 0) playStoneSound();
  }, [game.history.length]);

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
      mode, // docs/spec/streak.md §3
      myColor: game.playerColor,
      result,
      moves: game.history,
    });
    // 저장 직후 스트릭 재계산 → 결과 화면에 표시 (docs/spec/streak.md §4-2)
    setStreaks(computeStreaks(loadRecords()));
  }, [game.status, game.playerColor, difficulty, mode]);

  const handleNewGame = useCallback(() => {
    pendingRef.current = false;
    savedRef.current = false;
    setThinking(false);
    setStreaks(null);
    setGame(createGame({ useOpening }));
  }, [useOpening]);

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
  const brain       = BRAIN_META[difficulty]; // CPU 두뇌 readout (docs/spec/game-hud.md §2)

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
        </div>

        {/* 대국 존: 매치업(나 vs CPU) + CPU 두뇌 readout — docs/spec/game-hud.md §2,3 */}
        <div className="hud-zone">
          <span className="hud-zone-label">
            대국
            {/* 현재 모드 — docs/spec/game-modes.md §4 */}
            <span className="hud-mode">{useOpening ? '정석 렌주' : '빠른 대국'}</span>
          </span>
          <div className="hud-vs">
            <span className="hud-side hud-side--me">
              <i className={`stone-dot stone-dot--${playerDot}`} />
              <span className="hud-role">나</span> <em className="hud-who">{playerLabel}</em>
            </span>
            <span className="hud-vs-sep">VS</span>
            <span className="hud-side hud-side--cpu">
              <em className="hud-who">{cpuLabel}</em> <span className="hud-role">CPU</span>
              <i className={`stone-dot stone-dot--${cpuDot}`} />
            </span>
          </div>
          {op && <span className="hud-tentative">잠정 배정</span>}
          {/* CPU 두뇌(탐색 방식) — docs/spec/ai.md §2-2, game-hud.md §4 */}
          {brain && (
            <div className="hud-readout">
              <span className="hud-readout-lab">CPU 탐색</span>
              <span className="hud-readout-val">
                <span className="hud-depth">{brain.depth}</span>
                <b>수 앞</b>
                <span className="hud-readout-sep">·</span>
                <span className="hud-method">{brain.method}</span>
                {brain.tag && <span className="hud-tag">{brain.tag}</span>}
              </span>
            </div>
          )}
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

        {/* 상태 존 — docs/spec/game-hud.md §2 */}
        <div className="hud-zone hud-zone--status">
          <span className="hud-zone-label">상태</span>
          <div className="game-status">
            {thinking && (
              <span className="thinking-indicator">
                <span className="thinking-board" aria-hidden="true"><i className="thinking-hit" /></span>
                <span className="thinking-text">
                  CPU가 {thinkingDepth > 0
                    ? <>
                        <span className="thinking-depth">{thinkingDepth}</span>수 앞을
                      </>
                    : '수를'} 읽는 중
                </span>
              </span>
            )}
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
        streaks={streaks}
        onNewGame={handleNewGame}
        onExit={onExit}
      />
    </div>
  );
}
