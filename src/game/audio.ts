import { WeaponId } from '../types/game';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.7;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      // Pre-build white noise buffer for gunshots & footsteps
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 1.0;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  public playUiClick() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.045);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  public playGunshot(weaponId: WeaponId, distanceAttenuation = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.05, Math.min(1, distanceAttenuation));

    if (weaponId === WeaponId.KNIFE) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(450, now + 0.14);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(filter).connect(gain).connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.16);
      return;
    }

    const isSilenced = weaponId === WeaponId.M4A1S || weaponId === WeaponId.USPS;
    const isSniper = weaponId === WeaponId.AWP;
    const isDeagle = weaponId === WeaponId.DEAGLE;

    // Punchy low body oscillator
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = isSniper ? 'sawtooth' : 'triangle';

    const startFreq = isSniper ? 160 : isDeagle ? 210 : isSilenced ? 260 : 185;
    const endFreq = isSniper ? 32 : 45;
    const bodyDur = isSniper ? 0.32 : isSilenced ? 0.08 : 0.14;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + bodyDur);
    oscGain.gain.setValueAtTime((isSniper ? 0.65 : isSilenced ? 0.22 : 0.45) * vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + bodyDur);
    osc.connect(oscGain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + bodyDur + 0.02);

    // Filtered crack noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = isSilenced ? 'bandpass' : 'lowpass';
    filter.frequency.setValueAtTime(
      isSilenced ? 1850 : isSniper ? 4200 : isDeagle ? 3600 : 3200,
      now
    );
    filter.frequency.exponentialRampToValueAtTime(isSilenced ? 600 : 320, now + (isSniper ? 0.45 : 0.18));

    const nGain = ctx.createGain();
    const nDur = isSniper ? 0.48 : isSilenced ? 0.09 : 0.22;
    nGain.gain.setValueAtTime((isSniper ? 0.72 : isSilenced ? 0.16 : isDeagle ? 0.52 : 0.44) * vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + nDur);

    noise.connect(filter).connect(nGain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + nDur + 0.02);
  }

  public playHitSound(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;

    if (headshot) {
      // Classic crisp metallic helmet "dink"
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1920, now);
      osc1.frequency.exponentialRampToValueAtTime(1180, now + 0.11);
      osc2.frequency.setValueAtTime(3400, now);
      osc2.frequency.exponentialRampToValueAtTime(2100, now + 0.09);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.masterGain);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.15);
      osc2.stop(now + 0.15);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.06);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain).connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const click = (delay: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.45, now + delay + 0.04);
      gain.gain.setValueAtTime(0.12, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.045);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(now + delay);
      osc.stop(now + delay + 0.05);
    };
    click(0.05, 540);
    click(0.45, 720);
    click(0.82, 920);
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340 + Math.random() * 90, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    noise.connect(filter).connect(gain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.08);
  }

  public playRoundChime(won: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const notes = won ? [440, 554.37, 659.25] : [330, 293.66, 246.94];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.16, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.25);
      osc.connect(gain).connect(this.masterGain!);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.26);
    });
  }

  public playPinPull() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.06);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playGrenadeBounce(distanceAttenuation = 0.8) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.04, Math.min(1, distanceAttenuation));
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + Math.random() * 110, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.055);
    gain.gain.setValueAtTime(0.18 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playHeExplosion(distanceAttenuation = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.08, Math.min(1, distanceAttenuation));

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.55);
    oscGain.gain.setValueAtTime(0.85 * vol, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(oscGain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.62);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.72);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.9 * vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    noise.connect(filter).connect(nGain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.78);
  }

  public playFlashbang(distanceAttenuation = 1.0, blindFactor = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.1, Math.min(1, distanceAttenuation));

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1100, now);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.8 * vol, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter).connect(nGain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.32);

    if (blindFactor > 0.25) {
      const ring = ctx.createOscillator();
      const rGain = ctx.createGain();
      ring.type = 'sine';
      ring.frequency.setValueAtTime(3450, now);
      rGain.gain.setValueAtTime(0.14 * blindFactor, now);
      rGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.5);
      ring.connect(rGain).connect(this.masterGain);
      ring.start(now);
      ring.stop(now + 1.55);
    }
  }

  public playSmokeHiss(distanceAttenuation = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const vol = Math.max(0.06, Math.min(1, distanceAttenuation));
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.Q.setValueAtTime(0.9, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    noise.connect(filter).connect(gain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 1.0);
  }

  public playSprayCan() {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3400, now);
    filter.Q.setValueAtTime(1.4, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(filter).connect(gain).connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.26);
  }
}

export const soundEngine = new SoundEngine();
