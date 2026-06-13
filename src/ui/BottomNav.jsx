// docs/spec/nav.md §2 탭 구성
const TABS = [
  { key: 'play',    icon: '⬡', label: '플레이' },
  { key: 'rules',   icon: '◈', label: '규칙'   },
  { key: 'records', icon: '◫', label: '기보'   },
  { key: 'profile', icon: '◉', label: '프로필' },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav">
      {TABS.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`bottom-nav-item${activeTab === key ? ' bottom-nav-item--active' : ''}`}
          onClick={() => onTabChange(key)}
        >
          <span className="bottom-nav-icon">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
