import { MOTION } from './tokens';

type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const win = window as unknown as Record<string, unknown>;
  const ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionConstructor) : undefined;
}

/**
 * Checks whether browser SpeechRecognition (STT) is available.
 */
export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getRecognitionCtor());
}

/**
 * Checks whether browser speechSynthesis (TTS) is available.
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.speechSynthesis?.speak === 'function';
}

/**
 * Starts browser speech recognition when supported, or triggers `onUnsupported` so the caller
 * can run a simulated voice capture window. Returns a cleanup function that stops listening.
 * @param handlers callbacks for transcript results and lifecycle
 */
export function startVoiceCapture(handlers: {
  onInterim?: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onError?: (reason: string) => void;
  onEnd?: () => void;
}): () => void {
  const Ctor = getRecognitionCtor();
  if (!Ctor) {
    // When Web Speech API is absent, notify onEnd on stop without throwing.
    return () => {
      handlers.onEnd?.();
    };
  }

  let active = true;
  const recognition = new Ctor();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;

  recognition.onresult = (event) => {
    if (!active) return;
    let interim = '';
    let finalText = '';
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? '';
      if (result?.isFinal) finalText += text;
      else interim += text;
    }
    if (interim) handlers.onInterim?.(interim.trim());
    if (finalText.trim()) handlers.onFinal(finalText.trim());
  };

  recognition.onerror = (event) => {
    if (!active) return;
    handlers.onError?.(event.error ?? 'speech-error');
  };

  recognition.onend = () => {
    if (!active) return;
    active = false;
    handlers.onEnd?.();
  };

  try {
    recognition.start();
  } catch {
    handlers.onEnd?.();
  }

  return () => {
    if (!active) return;
    active = false;
    try {
      recognition.stop();
    } catch {
      // Ignore already-stopped recognition errors.
    }
  };
}

/**
 * Synthesizes Jarvis spoken output via `window.speechSynthesis` when available and enabled.
 * Returns a cancellation function.
 * @param text reply text to speak
 * @param options lifecycle callbacks and mute flag
 */
export function speakJarvisReply(
  text: string,
  options: { enabled?: boolean; onStart?: () => void; onEnd?: () => void } = {},
): () => void {
  if (options.enabled === false || !text.trim() || !isSpeechSynthesisSupported()) {
    options.onEnd?.();
    return () => {};
  }
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.04;
    utterance.pitch = 0.94;
    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onEnd?.();
    options.onStart?.();
    window.speechSynthesis.speak(utterance);
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore synthesis cancel errors.
      }
      options.onEnd?.();
    };
  } catch {
    options.onEnd?.();
    return () => {};
  }
}

/**
 * Advances playback time at `MOTION.spectrumTickMs` intervals for the X3LIUS player and
 * schedules subtle Web Audio sub-bass pulses at the track's BPM routed through an exposed
 * `AnalyserNode` when `AudioContext` is available.
 * @param bpm track tempo in beats per minute
 * @param onTick called with elapsed seconds on each tick
 * @param options optional live analyser callback and volume [0, 1]
 */
export function startTrackClock(
  bpm: number,
  onTick: (deltaSec: number) => void,
  options: { onAnalyser?: (analyser: AnalyserNode | null) => void; volume?: number } = {},
): () => void {
  const stepSec = MOTION.spectrumTickMs / 1000;
  let audioCtx: AudioContext | null = null;
  let gainMaster: GainNode | null = null;
  let analyser: AnalyserNode | null = null;
  let nextBeatTime = 0;
  let stepIndex = 0;

  if (typeof window !== 'undefined') {
    const Ctx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (typeof Ctx === 'function') {
      try {
        audioCtx = new Ctx();
        gainMaster = audioCtx.createGain();
        gainMaster.gain.value = Math.min(1, Math.max(0, options.volume ?? 0.65));
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.72;
        gainMaster.connect(analyser);
        analyser.connect(audioCtx.destination);
        nextBeatTime = audioCtx.currentTime;
        options.onAnalyser?.(analyser);
      } catch {
        audioCtx = null;
      }
    }
  }

  const beatInterval = 60 / Math.max(60, bpm);

  const timer = globalThis.setInterval(() => {
    onTick(stepSec);
    if (audioCtx && gainMaster && audioCtx.state === 'running' && audioCtx.currentTime >= nextBeatTime) {
      try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.type = 'sine';
        const rootHz = stepIndex % 4 === 0 ? 58 : 49;
        osc.frequency.setValueAtTime(rootHz * 1.4, now);
        osc.frequency.exponentialRampToValueAtTime(36, now + 0.14);
        env.gain.setValueAtTime(0.055, now);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        osc.connect(env);
        env.connect(gainMaster);
        osc.start(now);
        osc.stop(now + 0.2);

        if (stepIndex % 2 === 1) {
          const chime = audioCtx.createOscillator();
          const chimeEnv = audioCtx.createGain();
          chime.type = 'triangle';
          chime.frequency.setValueAtTime(stepIndex % 4 === 3 ? 330 : 220, now);
          chimeEnv.gain.setValueAtTime(0.015, now);
          chimeEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
          chime.connect(chimeEnv);
          chimeEnv.connect(gainMaster);
          chime.start(now);
          chime.stop(now + 0.12);
        }
        stepIndex += 1;
      } catch {
        // Ignore audio node scheduling errors in restricted environments.
      }
      nextBeatTime = audioCtx.currentTime + beatInterval;
    }
  }, MOTION.spectrumTickMs);

  return () => {
    globalThis.clearInterval(timer);
    options.onAnalyser?.(null);
    if (audioCtx) {
      try {
        void audioCtx.close();
      } catch {
        // Ignore close errors.
      }
    }
  };
}

