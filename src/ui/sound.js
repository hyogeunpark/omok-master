// 돌 착수 효과음 — Web Audio API 합성 (파일 없음, 오프라인 동작)
let ctx = null;

function getCtx() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

function synthesize(ac) {
  const now = ac.currentTime;

  // 공유 노이즈 버퍼 (300ms) — 오실레이터 대신 노이즈 기반으로 나무 질감 구현
  const len = Math.floor(ac.sampleRate * 0.3);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  // 고Q 밴드패스 필터드 노이즈 = 피치 슬라이드 없는 자연스러운 공명
  function layer(freq, Q, peak, decay) {
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = Q;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    src.start(now);
  }

  // ① 충격 트랜지언트 — 돌이 판에 닿는 순간 "탁" 타격감
  layer(1400, 1.0, 1.0,  0.008);

  // ② 나무 결 크랙 — 원목 표면의 중간 음역 질감
  layer(600,  4.0, 0.35, 0.065);

  // ③ 원목 공명 (핵심) — 속이 빈 두꺼운 나무판의 깊고 맑은 울림
  layer(240,  16,  0.6,  0.22);
}

export function playStoneSound() {
  try {
    const ac = getCtx();
    if (ac.state === 'suspended') {
      ac.resume().then(() => synthesize(ac));
    } else {
      synthesize(ac);
    }
  } catch {
    // 오디오 미지원 환경 무시
  }
}
