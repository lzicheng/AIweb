import { synthesizeSpeech } from "./digitalHumanSpeech";

function estimatePlaybackMs(text) {
  return Math.max(2200, Math.min(12000, text.length * 150));
}

export function createContentPlaybackService({ renderer, audioElement, onQueueEmpty }) {
  let currentAudioUrl = "";
  let pulseTimerId = 0;
  let fallbackTimerId = 0;
  let queue = [];
  let isProcessingQueue = false;
  let currentAbortController = null;

  renderer?.setAudioElement?.(audioElement);

  const stopPulse = () => {
    if (pulseTimerId) {
      window.clearInterval(pulseTimerId);
      pulseTimerId = 0;
    }
    renderer?.setSpeakingLevel?.(0);
  };

  const startPulse = () => {
    stopPulse();
    pulseTimerId = window.setInterval(() => {
      const phase = Date.now() / 120;
      const level = 0.35 + Math.abs(Math.sin(phase)) * 0.55;
      renderer?.setSpeakingLevel?.(level);
    }, 80);
  };

  const cleanupAudioUrl = () => {
    if (currentAudioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(currentAudioUrl);
    }
    currentAudioUrl = "";
  };

  const stopCurrent = () => {
    if (fallbackTimerId) {
      window.clearTimeout(fallbackTimerId);
      fallbackTimerId = 0;
    }
    stopPulse();
    if (audioElement) {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
    }
    cleanupAudioUrl();
  };

  const abortCurrent = () => {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    stopCurrent();
  };

  const playAudio = async (audioUrl) => {
    if (!audioElement || !audioUrl) return false;

    cleanupAudioUrl();
    currentAudioUrl = audioUrl;
    audioElement.src = audioUrl;
    audioElement.currentTime = 0;

    return new Promise((resolve) => {
      const finalize = (played) => {
        audioElement.onended = null;
        audioElement.onerror = null;
        stopPulse();
        cleanupAudioUrl();
        resolve(played);
      };

      audioElement.onended = () => finalize(true);
      audioElement.onerror = () => finalize(false);

      audioElement.play().catch(() => {
        finalize(false);
      });
    });
  };

  const playFallback = async (text) => {
    startPulse();
    await new Promise((resolve) => {
      fallbackTimerId = window.setTimeout(() => {
        fallbackTimerId = 0;
        stopPulse();
        resolve();
      }, estimatePlaybackMs(text));
    });
  };

  const playSingleContent = async ({ text, signal }) => {
    if (!text.trim()) return { mode: "empty" };
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const ttsResult = await synthesizeSpeech({ text, signal });
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    if (ttsResult.audioUrl) {
      const played = await playAudio(ttsResult.audioUrl);
      if (played) {
        return { mode: "audio", ...ttsResult };
      }
    }

    await playFallback(text);
    return { mode: "fallback-animation", ...ttsResult };
  };

  const processQueue = async () => {
    if (isProcessingQueue) return;

    isProcessingQueue = true;

    while (queue.length > 0) {
      const item = queue.shift();
      currentAbortController = new AbortController();

      try {
        stopCurrent();
        await playSingleContent({
          text: item.text,
          signal: currentAbortController.signal,
        });
      } catch (error) {
        if (error?.name === "AbortError") {
          break;
        }
      }

      currentAbortController = null;
    }

    isProcessingQueue = false;

    if (queue.length === 0) {
      onQueueEmpty?.();
    }
  };

  return {
    async playContent({ text, signal }) {
      abortCurrent();
      queue = [];

      if (!text.trim()) return { mode: "empty" };
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      currentAbortController = signal ? null : new AbortController();
      const effectiveSignal = signal || currentAbortController.signal;

      const result = await playSingleContent({
        text,
        signal: effectiveSignal,
      });

      currentAbortController = null;
      return result;
    },

    queueContent({ text, source }) {
      if (!text.trim()) return;

      queue.push({ text, source });

      if (!isProcessingQueue) {
        processQueue();
      }
    },

    getQueueLength() {
      return queue.length;
    },

    isPlaying() {
      return isProcessingQueue || queue.length > 0;
    },

    stop() {
      abortCurrent();
      queue = [];
      isProcessingQueue = false;
    },

    dispose() {
      abortCurrent();
      queue = [];
      isProcessingQueue = false;
    },
  };
}