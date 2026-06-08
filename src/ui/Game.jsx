import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createGame, placeStone, undoMove } from '../engine/game.js';
import { getCpuMove } from '../ai/cpu.js';
import { isForbidden } from '../engine/forbidden.js';
import Board from './Board.jsx';

function statusMessage(game) {
  if (game.status === 'draw') return '무승부';
  if (game.status === 'black-wins') return game.playerColor === 'B' ? '승리!' : '패배';
  if (game.status === 'white-wins') return game.playerColor === 'W' ? '승리!' : '패배';
  return null;
}

export default function Game({ difficulty, onExit }) {
  const [game, setGame] = useState(() => createGame());
  const [thinking, setThinking] = useState(false);
  const pendingRef = useRef(false);

  const isCpuTurn = game.status === 'playing' && game.currentTurn === game.cpuColor;

  // FR-6: 흑 차례에만 금수 셀 계산
  const forbiddenCells = useMemo(() => {
    if (game.status !== 'playing' || game.currentTurn !== 'B') return [];
    const cells = [];
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (game.board[r][c] === null && isForbidden(game.board, r, c, 'B')) {
          cells.push({ row: r, col: c });
        }
      }
    }
    return cells;
  }, [game.board, game.status, game.currentTurn]);
  const myColor = game.playerColor === 'B' ? '흑 (선공)' : '백 (후공)';

  // CPU 수 처리
  useEffect(() => {
    if (!isCpuTurn || pendingRef.current) return;
    pendingRef.current = true;
    setThinking(true);
    const id = setTimeout(() => {
      setGame(g => {
        const move = getCpuMove(g.board.map(r => [...r]), g.cpuColor, difficulty);
        return placeStone(g, move.row, move.col);
      });
      pendingRef.current = false;
      setThinking(false);
    }, 300);
    return () => {
      clearTimeout(id);
      pendingRef.current = false;
    };
  }, [isCpuTurn, difficulty]);

  const handlePlace = useCallback((row, col) => {
    if (thinking || game.currentTurn !== game.playerColor || game.status !== 'playing') return;
    setGame(g => placeStone(g, row, col));
  }, [thinking, game.currentTurn, game.playerColor, game.status]);

  const handleUndo = useCallback(() => {
    if (thinking) return;
    setGame(g => undoMove(g));
  }, [thinking]);

  const handleNewGame = useCallback(() => {
    pendingRef.current = false;
    setThinking(false);
    setGame(createGame());
  }, []);

  const msg = statusMessage(game);
  const canUndo = !thinking && game.history.length >= 2;

  return (
    <div className="game">
      <div className="game-header">
        <button className="btn-back" onClick={onExit}>← 나가기</button>
        <span className="my-color-badge">내 색: {myColor}</span>
      </div>

      <Board
        board={game.board}
        onPlace={handlePlace}
        lastMove={game.lastMove}
        winningLine={game.winningLine}
        disabled={thinking || game.status !== 'playing' || game.currentTurn !== game.playerColor}
        forbiddenCells={forbiddenCells}
      />

      {/* FR-8: 상태 표시 영역 — 보드 바깥(아래) */}
      <div className="game-status">
        {thinking && <span className="thinking-indicator">CPU 생각 중…</span>}
        {msg && <span className="result-text">{msg}</span>}
        {!thinking && !msg && (
          <span className="turn-text">
            {game.currentTurn === game.playerColor ? '내 차례' : 'CPU 차례'}
          </span>
        )}
      </div>

      <div className="game-actions">
        <button onClick={handleUndo} disabled={!canUndo}>되돌리기</button>
        <button onClick={handleNewGame}>새 게임</button>
      </div>
    </div>
  );
}
