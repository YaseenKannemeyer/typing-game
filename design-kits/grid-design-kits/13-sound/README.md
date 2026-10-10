# Original sound collection

Files: sound.js, manifest.json, wav/*.wav.

## API / components

new GridKit.SoundPlayer(), unlock(), setMuted(bool), setVolume(0..1), play(id), destroy().

## Integration notes

Ten cues: countdown-beep, countdown-final, go-horn, key-click, mistake, overtake, finish, winner, award-reveal, ui-click. WAV exports are mono 16-bit PCM at 22050 Hz. The Web Audio controller synthesizes the same recipes at the device sample rate, avoiding fetch requirements for offline previews. Muted by default; unlock from user gesture. Max four simultaneous voices; 45 ms key-click throttle. Keep typing and mistake cues soft and optional. Listen on actual speakers/headphones before shipping; no device playback test was available.

## Preview

Open the root `OPEN-ME.html` and select this kit. The root `manifest.json` lists script/style load order. These sources are framework-neutral presentation references; convert them to the existing React/TypeScript architecture. They do not replace backend rules.
