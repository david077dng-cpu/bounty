/**
 * Utility to play synthesized sounds for UI feedback
 */

class SoundManager {
  private audioCtx: AudioContext | null = null;

  private init() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume context if it was suspended (browser policy)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    this.init();
    if (!this.audioCtx) return;

    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

    gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + duration);
  }

  playSuccess() {
    try {
      this.playTone(523.25, 'sine', 0.1, 0.1); // C5
      setTimeout(() => this.playTone(659.25, 'sine', 0.15, 0.1), 100); // E5
      setTimeout(() => this.playTone(783.99, 'sine', 0.3, 0.1), 250); // G5
    } catch (e) {
      console.error('Failed to play success sound', e);
    }
  }

  playError() {
    try {
      this.playTone(220, 'sawtooth', 0.1, 0.1); // A3
      setTimeout(() => this.playTone(110, 'sawtooth', 0.4, 0.1), 100); // A2
    } catch (e) {
      console.error('Failed to play error sound', e);
    }
  }
}

export const soundManager = new SoundManager();
