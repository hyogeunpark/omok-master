// docs/spec/nav.md §3 탭 전환 동작
import { useState, useMemo } from 'react';
import BottomNav from './ui/BottomNav.jsx';
import StartScreen from './ui/StartScreen.jsx';
import RulesScreen from './ui/RulesScreen.jsx';
import RecordsScreen from './ui/RecordsScreen.jsx';
import ProfileScreen from './ui/ProfileScreen.jsx';
import Game from './ui/Game.jsx';
import { createAiPlayer } from './ai/createAiPlayer.js';

export default function App() {
  const [gameConfig, setGameConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('play');

  // docs/spec/ai-player.md §6 — difficulty → player 주입
  const player = useMemo(
    () => gameConfig ? createAiPlayer(gameConfig.difficulty) : null,
    [gameConfig?.difficulty]
  );

  if (gameConfig) {
    return (
      <Game
        player={player}
        difficulty={gameConfig.difficulty}
        onExit={() => setGameConfig(null)}
      />
    );
  }

  return (
    <>
      {activeTab === 'play'    && <StartScreen onStart={(d) => setGameConfig({ difficulty: d })} />}
      {activeTab === 'rules'   && <RulesScreen />}
      {activeTab === 'records' && <RecordsScreen />}
      {activeTab === 'profile' && <ProfileScreen />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}
