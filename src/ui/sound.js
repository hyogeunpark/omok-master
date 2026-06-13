// 돌 착수 효과음 — Web Audio API 합성 (파일 없음, 오프라인 동작)
let ctx = null;

function getCtx() {
  if (!ctx || ctx.state === 'closed') {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function playStoneSound() {
  try {
    const ac = getCtx();
    const now = ac.currentTime;

    // 충격 노이즈 (돌이 닿는 질감)
    const bufLen = Math.floor(ac.sampleRate * 0.04);
    const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

    const noise = ac.createBufferSource();
    noise.buffer = buf;

    const noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.6;

    const noiseGain = ac.createGain();
    noiseGain.gain.setValueAtTime(0.22, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ac.destination);
    noise.start(now);

    // 나무판 울림 (저주파 톤)
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);

    const oscGain = ac.createGain();
    oscGain.gain.setValueAtTime(0.28, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(oscGain);
    oscGain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch {
    // 오디오 미지원 환경 무시
  }
}
