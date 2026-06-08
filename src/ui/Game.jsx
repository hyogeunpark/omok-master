import { useState, useEffect, useRef, useCallback } from 'react';
import { createGame, placeStone, undoMove } from '../engine/game.js';
import { getCpuMove } from '../ai/cpu.js';
import Board from './Board.jsx';
import Controls from './Controls.jsx';

function statusMessage(game) {
  if (game.status === 'draw') return '무승부';
  if (game.status === 'black-wins') return game.playerColor === 'B' ? '승리!' : '패배';
  if (game.status === 'white-wins') return game.playerColor === 'W' ? '승리!' : '패배';
  return null;
}

export default function Game() {
  const [game, setGame] = useState(() => createGame({ playerColor: 'B' }));
  const [difficulty, setDifficulty] = useState('normal');
  const [thinking, setThinking] = useState(false);
  const pendingRef = useRef(false); // ref로 관리 — state 변경 시 cleanup이 타이머를 취소하는 버그 방지

  const isCpuTurn = game.status === 'playing' && game.currentTurn === game.cpuColor;

  // CPU 수 처리 — 300ms 딜레이로 자연스러운 응수 연출
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

  const handleNewGame = useCallback((playerColor = game.playerColor) => {
    setThinking(false);
    setGame(createGame({ playerColor }));
  }, [game.playerColor]);

  const msg = statusMessage(game);

  return (
    <div className="game">
      <h1 className="game-title">오목</h1>
      <Controls
        game={game}
        difficulty={difficulty}
        thinking={thinking}
        onUndo={handleUndo}
        onNewGame={() => handleNewGame()}
        onColorChange={handleNewGame}
        onDifficultyChange={setDifficulty}
      />
      {msg && <div className="result-banner">{msg}</div>}
      <Board
        board={game.board}
        onPlace={handlePlace}
        lastMove={game.lastMove}
        winningLine={game.winningLine}
        disabled={thinking || game.status !== 'playing' || game.currentTurn !== game.playerColor}
      />
    </div>
  );
}
