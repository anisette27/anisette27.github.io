/**
 * Birthday Galaxy - Web Audio API 音频引擎
 *
 * 使用纯 Web Audio API 合成背景音乐和音效，
 * 无需任何外部音频文件。
 */

// ============================================================================
// 音频管理器类
// ============================================================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmNodes: OscillatorNode[] = [];
  private bgmIntervalId: number | null = null;
  private isBgmPlaying = false;
  private _muted = false;

  /** 单例 */
  private static instance: AudioEngine;
  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  // --------------------------------------------------------------------------
  // 初始化 AudioContext（必须由用户交互触发）
  // --------------------------------------------------------------------------
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    // 主音量
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    // BGM 音量（较低）
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0;
    this.bgmGain.connect(this.masterGain);

    // 音效音量
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);
  }

  /** 是否已初始化 */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state !== 'closed';
  }

  // --------------------------------------------------------------------------
  // 背景音乐 —— 宇宙氛围 Ambient Pad
  // --------------------------------------------------------------------------
  startBgm(fadeIn: number = 3) {
    if (!this.ctx || !this.bgmGain || this.isBgmPlaying) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    this.isBgmPlaying = true;

    // === 低频 Drone Pad（C3 + G3 和弦） ===
    const droneFreqs = [130.81, 196.0, 261.63, 329.63];
    for (const freq of droneFreqs) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.04;

      // 低通滤波 —— 柔和温暖
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain!);
      osc.start();
      this.bgmNodes.push(osc);
    }

    // === 高频闪烁层（微弱） ===
    const shimmer = this.ctx.createOscillator();
    shimmer.type = 'sine';
    shimmer.frequency.value = 523.25; // C5
    const shimmerGain = this.ctx.createGain();
    shimmerGain.gain.value = 0.008;
    const shimmerFilter = this.ctx.createBiquadFilter();
    shimmerFilter.type = 'lowpass';
    shimmerFilter.frequency.value = 2000;
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerGain);
    shimmerGain.connect(this.bgmGain!);
    shimmer.start();
    this.bgmNodes.push(shimmer);

    // === 和弦琶音循环（每 4 秒一个音符） ===
    const arpNotes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63]; // C E G C' G E
    let arpIndex = 0;

    const playArpNote = () => {
      if (!this.ctx || !this.bgmGain || !this.isBgmPlaying) return;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = arpNotes[arpIndex % arpNotes.length];

      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 0.3);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.5);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1200;
      filter.Q.value = 2;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain!);
      osc.start();
      osc.stop(this.ctx.currentTime + 3);

      arpIndex++;
    };

    // 立即播放第一个琶音
    playArpNote();
    this.bgmIntervalId = window.setInterval(playArpNote, 3000);

    // === 淡入 ===
    this.bgmGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + fadeIn);
  }

  /** 加大 BGM 音量（高潮阶段） */
  intensifyBgm() {
    if (!this.ctx || !this.bgmGain) return;
    this.bgmGain.gain.linearRampToValueAtTime(1.8, this.ctx.currentTime + 2);
  }

  /** 降低 BGM 音量 */
  softenBgm() {
    if (!this.ctx || !this.bgmGain) return;
    this.bgmGain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 2);
  }

  /** 停止背景音乐（带淡出） */
  stopBgm(fadeOut: number = 2) {
    if (!this.ctx || !this.bgmGain || !this.isBgmPlaying) return;
    this.isBgmPlaying = false;

    this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + fadeOut);

    setTimeout(() => {
      for (const osc of this.bgmNodes) {
        try { osc.stop(); } catch {}
      }
      this.bgmNodes = [];
      if (this.bgmIntervalId !== null) {
        clearInterval(this.bgmIntervalId);
        this.bgmIntervalId = null;
      }
    }, fadeOut * 1000 + 500);
  }

  // --------------------------------------------------------------------------
  // 音效工厂方法
  // --------------------------------------------------------------------------

  /** 播放单个音符 */
  private playNote(
    freq: number,
    type: OscillatorType,
    duration: number,
    volume: number = 0.3,
    attack: number = 0.05,
    release: number = 0.3,
    filterFreq: number = 3000,
  ) {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    // 轻微颤音
    const vibrato = this.ctx.createOscillator();
    vibrato.frequency.value = 5;
    const vibratoGain = this.ctx.createGain();
    vibratoGain.gain.value = 2;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.frequency);
    vibrato.start(now);
    vibrato.stop(now + duration);

    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  // --------------------------------------------------------------------------
  // 各种音效
  // --------------------------------------------------------------------------

  /** 星星出现 —— 清脆的铃声 */
  starAppear() {
    this.playNote(880, 'sine', 1.5, 0.15, 0.02, 1.2, 4000);
    this.playNote(1318.5, 'sine', 1.2, 0.08, 0.05, 1.0, 5000);
  }

  /** 星星组成名字 —— 和弦上行 */
  starFormName() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playNote(freq, 'sine', 2, 0.12, 0.03, 1.5, 3500), i * 150);
    });
  }

  /** 流星划过 —— 嘶嘶声下滑 */
  meteorShoot() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    gain.gain.linearRampToValueAtTime(0, now + 0.8);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 5;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 1);
  }

  /** 打字机音效 */
  typewriterClick() {
    this.playNote(1200, 'square', 0.05, 0.04, 0.005, 0.04, 2000);
  }

  /** 礼盒打开 —— 上升和弦 + 闪光 */
  giftOpen() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;

    // 上升扫频
    const sweep = this.ctx.createOscillator();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(200, now);
    sweep.frequency.exponentialRampToValueAtTime(1200, now + 0.6);

    const sweepGain = this.ctx.createGain();
    sweepGain.gain.value = 0.15;
    sweepGain.gain.linearRampToValueAtTime(0, now + 0.8);

    const sweepFilter = this.ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.value = 2000;

    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(this.sfxGain);
    sweep.start(now);
    sweep.stop(now + 1);

    // 和弦
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, i) => {
      setTimeout(() => this.playNote(freq, 'sine', 1.5, 0.1, 0.02, 1.2, 3000), i * 80);
    });

    // 闪光噪声
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.06;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 4000;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now + 0.5);
  }

  /** 粒子飞散 */
  particleBurst() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      const freq = 600 + Math.random() * 800;
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + i * 0.05 + 0.4);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.05);
      gain.gain.linearRampToValueAtTime(0.06, now + i * 0.05 + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + i * 0.05 + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.5);
    }
  }

  /** 蜡烛点燃 —— 温暖的嘶声 */
  candleLight() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;

    // 嘶声
    const bufferSize = this.ctx.sampleRate * 0.2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = 0.04;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 3000;
    noiseFilter.Q.value = 3;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noise.start(now);

    // 温暖音
    this.playNote(440, 'sine', 0.8, 0.1, 0.02, 0.6, 1500);
    this.playNote(554.37, 'sine', 0.6, 0.06, 0.05, 0.4, 1200);
  }

  /** 吹蜡烛 —— 气流声 */
  candleBlow() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // 模拟吹气：先强后弱
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.6;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.08;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.frequency.linearRampToValueAtTime(500, now + 0.5);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  /** 生日歌旋律（简化版） */
  playBirthdaySong() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // 简化的生日快乐歌旋律（C大调）
    const melody: [number, number][] = [
      [262, 0.3], [262, 0.1], [294, 0.4], [262, 0.4], [349, 0.4], [330, 0.8],
      [262, 0.3], [262, 0.1], [294, 0.4], [262, 0.4], [392, 0.4], [349, 0.8],
      [262, 0.3], [262, 0.1], [523, 0.4], [440, 0.4], [349, 0.4], [330, 0.4], [294, 0.8],
      [466, 0.3], [466, 0.1], [440, 0.4], [349, 0.4], [392, 0.4], [349, 0.8],
    ];

    let time = this.ctx.currentTime + 0.1;
    for (const [freq, dur] of melody) {
      this.playNoteAt(freq, 'triangle', time, dur * 0.9, 0.12, 0.02, dur * 0.5, 2000);
      time += dur;
    }
  }

  /** 在指定时间播放音符（用于旋律序列） */
  private playNoteAt(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    volume: number = 0.3,
    attack: number = 0.05,
    release: number = 0.3,
    filterFreq: number = 3000,
  ) {
    if (!this.ctx || !this.sfxGain || this._muted) return;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.setValueAtTime(volume, startTime + duration - release);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  /** 愿望星收集 —— 清脆音 */
  wishCollect() {
    this.playNote(784, 'sine', 0.4, 0.15, 0.01, 0.3, 5000);
    setTimeout(() => this.playNote(1047, 'sine', 0.5, 0.1, 0.01, 0.4, 6000), 80);
  }

  /** 幸运卡片翻转 */
  cardFlip() {
    this.playNote(600, 'triangle', 0.15, 0.08, 0.01, 0.1, 2000);
    setTimeout(() => this.playNote(800, 'triangle', 0.15, 0.06, 0.01, 0.1, 2000), 60);
  }

  /** 烟花爆炸 */
  firework() {
    if (!this.ctx || !this.sfxGain || this._muted) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;

    // 上升的嘶声
    const riseOsc = this.ctx.createOscillator();
    riseOsc.type = 'sawtooth';
    riseOsc.frequency.setValueAtTime(300, now);
    riseOsc.frequency.exponentialRampToValueAtTime(1500, now + 0.5);
    const riseGain = this.ctx.createGain();
    riseGain.gain.value = 0.04;
    riseGain.gain.linearRampToValueAtTime(0, now + 0.5);
    const riseFilter = this.ctx.createBiquadFilter();
    riseFilter.type = 'lowpass';
    riseFilter.frequency.value = 1000;
    riseOsc.connect(riseFilter);
    riseFilter.connect(riseGain);
    riseGain.connect(this.sfxGain);
    riseOsc.start(now);
    riseOsc.stop(now + 0.6);

    // 爆炸噪声
    setTimeout(() => {
      if (!this.ctx || !this.sfxGain || this._muted) return;
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.value = 0.1;
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 3000;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);
      noise.start();
    }, 500);

    // 低频轰隆声
    this.playNote(80, 'sine', 0.6, 0.12, 0.01, 0.5, 300);
  }

  /** 爱心形成 —— 温暖上行和弦 */
  heartForm() {
    const chord = [262, 330, 392, 523, 659];
    chord.forEach((freq, i) => {
      setTimeout(() => this.playNote(freq, 'sine', 2, 0.1, 0.03, 1.5, 3000), i * 120);
    });
  }

  /** 场景切换 —— 柔和过渡音 */
  sceneTransition() {
    this.playNote(440, 'sine', 1.5, 0.08, 0.3, 1.2, 1000);
    this.playNote(554, 'sine', 1.2, 0.05, 0.3, 1.0, 800);
  }

  /** 静音/取消静音 */
  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : 0.7,
        (this.ctx?.currentTime ?? 0) + 0.3,
      );
    }
  }

  get muted(): boolean {
    return this._muted;
  }

  /** 销毁 */
  destroy() {
    this.stopBgm(0.1);
    setTimeout(() => {
      this.ctx?.close();
      this.ctx = null;
    }, 200);
  }
}
