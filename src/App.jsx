import { useState } from 'react';
import StartScreen from './ui/StartScreen.jsx';
import Game from './ui/Game.jsx';

export default function App() {
  const [difficulty, setDifficulty] = useState(null);

  if (!difficulty) {
    return <StartScreen onStart={setDifficulty} />;
  }

  return <Game difficulty={difficulty} onExit={() => setDifficulty(null)} />;
}
