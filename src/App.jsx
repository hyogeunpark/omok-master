import { useState } from 'react';
import StartScreen from './ui/StartScreen.jsx';
import Game from './ui/Game.jsx';

export default function App() {
  const [gameConfig, setGameConfig] = useState(null);

  if (!gameConfig) {
    return (
      <StartScreen
        onStart={(difficulty) => setGameConfig({ difficulty })}
      />
    );
  }

  return (
    <Game
      difficulty={gameConfig.difficulty}
      onExit={() => setGameConfig(null)}
    />
  );
}
