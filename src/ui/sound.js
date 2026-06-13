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

  // ① 날카로운 클릭 (돌이 판에 부딪히는 "딱" 성분)
  const clickLen = Math.floor(ac.sampleRate * 0.012); // 12ms
  const clickBuf = ac.createBuffer(1, clickLen, ac.sampleRate);
  const clickData = clickBuf.getChannelData(0);
  for (let i = 0; i < clickLen; i++) clickData[i] = Math.random() * 2 - 1;

  const click = ac.createBufferSource();
  click.buffer = clickBuf;

  const clickFilter = ac.createBiquadFilter();
  clickFilter.type = 'bandpass';
  clickFilter.frequency.value = 3200;  // 고주파 클릭
  clickFilter.Q.value = 1.2;

  const clickGain = ac.createGain();
  clickGain.gain.setValueAtTime(0.45, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

  click.connect(clickFilter);
  clickFilter.connect(clickGain);
  clickGain.connect(ac.destination);
  click.start(now);

  // ② 나무판 울림 (단단하고 짧은 목질 공명)
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(820, now);
  osc.frequency.exponentialRampToValueAtTime(210, now + 0.055); // 90Hz 아닌 210Hz로 고정

  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.22, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

export function playStoneSound() {
  try {
    const ac = getCtx();
    // resume()은 비동기 — 완료 후 합성해야 소리가 남
    if (ac.state === 'suspended') {
      ac.resume().then(() => synthesize(ac));
    } else {
      synthesize(ac);
    }
  } catch {
    // 오디오 미지원 환경 무시
  }
}
