/**
 * Typed port of design-kits/grid-design-kits/13-sound/sound.js: the same
 * deterministic synth recipes rendered at the device sample rate, so no audio
 * files are fetched. Muted by default, unlocked by a user gesture, at most four
 * voices, key clicks throttled to one per 45 ms.
 */

export type SoundId =
  | 'countdown-beep' | 'countdown-final' | 'go-horn' | 'key-click' | 'mistake'
  | 'overtake' | 'finish' | 'winner' | 'award-reveal' | 'ui-click';

interface Note {
  start: number;
  duration: number;
  frequency: number;
  gain: number;
  endFrequency: number;
  wave: 'sine' | 'triangle' | 'noise';
}

const note = (start: number, duration: number, frequency: number, gain = 0.35, endFrequency = frequency, wave: Note['wave'] = 'sine'): Note =>
  ({ start, duration, frequency, gain, endFrequency, wave });

export const SOUND_RECIPES: Record<SoundId, { label: string; notes: Note[] }> = {
  'countdown-beep': { label: 'Countdown beep', notes: [note(0, 0.13, 660, 0.3)] },
  'go-horn': { label: 'GO signal', notes: [note(0, 0.34, 523, 0.22, 523, 'triangle'), note(0, 0.34, 659, 0.16), note(0, 0.34, 784, 0.14)] },
  'key-click': { label: 'Soft key click', notes: [note(0, 0.025, 1100, 0.1, 600, 'noise')] },
  mistake: { label: 'Gentle mistake cue', notes: [note(0, 0.13, 190, 0.16, 130, 'triangle')] },
  overtake: { label: 'Overtake whoosh', notes: [note(0, 0.25, 350, 0.09, 1600, 'noise'), note(0, 0.2, 280, 0.1, 740)] },
  finish: { label: 'Finish chime', notes: [note(0, 0.22, 659, 0.25), note(0.13, 0.28, 784, 0.22), note(0.27, 0.5, 1046, 0.25)] },
  winner: { label: 'Winner fanfare', notes: [note(0, 0.2, 523, 0.24, 523, 'triangle'), note(0.15, 0.2, 659, 0.24, 659, 'triangle'), note(0.3, 0.2, 784, 0.24, 784, 'triangle'), note(0.48, 0.65, 1046, 0.23), note(0.48, 0.65, 659, 0.14), note(0.48, 0.65, 784, 0.14)] },
  'award-reveal': { label: 'Trophy reveal', notes: [note(0, 0.16, 880, 0.17), note(0.08, 0.23, 1175, 0.17), note(0.17, 0.5, 1568, 0.17)] },
  'ui-click': { label: 'UI click', notes: [note(0, 0.055, 700, 0.11, 920, 'triangle')] },
  'countdown-final': { label: 'Final countdown beep', notes: [note(0, 0.16, 880, 0.28)] },
};

/** Renders a cue to mono samples (identical to the kit's soundSamples()). */
export function soundSamples(id: SoundId, sampleRate = 22050): Float32Array<ArrayBuffer> {
  const recipe = SOUND_RECIPES[id];
  if (!recipe) throw Error('Unknown sound');
  const duration = Math.max(...recipe.notes.map((n) => n.start + n.duration)) + 0.05;
  const buffer = new Float32Array(Math.ceil(duration * sampleRate));
  let seed = 123456;
  for (const n of recipe.notes) {
    const length = Math.floor(n.duration * sampleRate);
    let phase = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.min(1, i / (sampleRate * 0.006)) * Math.pow(1 - t, 1.6);
      phase += (2 * Math.PI * (n.frequency + (n.endFrequency - n.frequency) * t)) / sampleRate;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const sample =
        n.wave === 'noise'
          ? ((seed / 4294967296) * 2 - 1) * Math.sin(phase)
          : n.wave === 'triangle'
            ? (2 / Math.PI) * Math.asin(Math.sin(phase))
            : Math.sin(phase);
      buffer[Math.floor(n.start * sampleRate) + i]! += sample * n.gain * envelope;
    }
  }
  return buffer;
}

const MAX_VOICES = 4;
const KEY_CLICK_GAP_MS = 45;

export class SoundPlayer {
  muted = true;
  volume = 0.35;
  private context: AudioContext | null = null;
  private voices = new Set<AudioBufferSourceNode>();
  private lastKey = 0;
  private cache = new Map<SoundId, AudioBuffer>();

  /** Must be called from a user gesture before anything can play. */
  async unlock(): Promise<void> {
    if (!this.context) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new Ctx();
    }
    await this.context.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stopAll();
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
  }

  play(id: SoundId) {
    // Never create or resume audio implicitly: only after unlock() from a gesture.
    const ctx = this.context;
    if (this.muted || !ctx || ctx.state !== 'running') return;
    if (id === 'key-click') {
      const now = Date.now();
      if (now - this.lastKey < KEY_CLICK_GAP_MS) return;
      this.lastKey = now;
    }
    if (this.voices.size >= MAX_VOICES) {
      const oldest = this.voices.values().next().value!;
      oldest.stop();
      this.voices.delete(oldest);
    }
    let buffer = this.cache.get(id);
    if (!buffer) {
      const samples = soundSamples(id, ctx.sampleRate);
      buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.cache.set(id, buffer);
    }
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  private stopAll() {
    for (const v of this.voices) {
      try {
        v.stop();
      } catch {
        // Already stopped.
      }
    }
    this.voices.clear();
  }

  destroy() {
    this.stopAll();
    void this.context?.close();
    this.context = null;
  }
}
