import type { StageConfig } from "../config/stages";
import type { JudgementKind } from "../rhythm/types";

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private readonly scheduledSources = new Set<OscillatorNode>();
  private stageStartTime = 0;
  private fallbackStartTime = 0;
  private fallbackElapsed = 0;
  private stageRunning = false;
  private silentFallback = false;
  private muted = false;

  async unlock(): Promise<void> {
    if (this.silentFallback) {
      return;
    }

    if (!this.context) {
      this.context = new AudioContext();
      this.createGraph(this.context);
    }

    const resume = this.context.resume();
    await resume;

    if (this.context.state !== "running") {
      throw new Error("AudioContext could not be started.");
    }
  }

  useSilentFallback(): void {
    this.silentFallback = true;
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
  }

  startStage(stage: StageConfig): void {
    this.stopStage();
    this.stageRunning = true;
    this.fallbackElapsed = 0;
    this.fallbackStartTime = performance.now() + 300;

    if (!this.context || this.silentFallback) {
      return;
    }

    this.stageStartTime = this.context.currentTime + 0.3;
    this.scheduleBacking(stage);
  }

  getElapsed(): number {
    if (!this.stageRunning) {
      return 0;
    }

    if (this.context && !this.silentFallback) {
      return this.context.currentTime - this.stageStartTime;
    }

    if (this.fallbackStartTime === 0) {
      return this.fallbackElapsed;
    }

    return (performance.now() - this.fallbackStartTime) / 1000;
  }

  playTrainNote(frequency: number, judgement: JudgementKind): void {
    if (!this.context || !this.sfxGain || judgement === "empty") {
      return;
    }

    const now = this.context.currentTime;
    const volume = judgement === "perfect" ? 0.18 : 0.12;
    this.createTone(now, frequency, 0.2, volume, "sine", this.sfxGain);
    this.createTone(now, frequency * 2, 0.11, volume * 0.35, "triangle", this.sfxGain);
  }

  playClear(): void {
    if (!this.context || !this.sfxGain) {
      return;
    }

    const now = this.context.currentTime;
    const sfxGain = this.sfxGain;
    const frequencies = [523.25, 659.25, 783.99, 1046.5];

    frequencies.forEach((frequency, index) => {
      this.createTone(
        now + index * 0.12,
        frequency,
        0.32,
        0.16,
        "sine",
        sfxGain,
      );
    });
  }

  pause(): void {
    if (!this.stageRunning) {
      return;
    }

    if (this.context && !this.silentFallback) {
      void this.context.suspend();
      return;
    }

    this.fallbackElapsed = this.getElapsed();
    this.fallbackStartTime = 0;
  }

  async resume(): Promise<void> {
    if (!this.stageRunning) {
      return;
    }

    if (this.context && !this.silentFallback) {
      const resume = this.context.resume();
      await resume;
      return;
    }

    this.fallbackStartTime = performance.now() - this.fallbackElapsed * 1000;
  }

  stopStage(): void {
    for (const source of this.scheduledSources) {
      source.stop();
    }

    this.scheduledSources.clear();
    this.stageRunning = false;
    this.fallbackStartTime = 0;
    this.fallbackElapsed = 0;
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : 0.8,
        this.context.currentTime,
      );
    }
    return this.muted;
  }

  private createGraph(context: AudioContext): void {
    this.masterGain = context.createGain();
    this.musicGain = context.createGain();
    this.sfxGain = context.createGain();

    this.masterGain.gain.value = this.muted ? 0 : 0.8;
    this.musicGain.gain.value = 0.42;
    this.sfxGain.gain.value = 0.75;
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
  }

  private scheduleBacking(stage: StageConfig): void {
    if (!this.context || !this.musicGain) {
      return;
    }

    const musicGain = this.musicGain;
    const beatDuration = 60 / stage.bpm;
    const beatCount = Math.ceil(stage.duration / beatDuration);

    for (let beat = 0; beat < beatCount; beat += 1) {
      const time = this.stageStartTime + beat * beatDuration;
      const downBeat = beat % 4 === 0;
      this.createTone(
        time,
        downBeat ? 130.81 : 196,
        downBeat ? 0.16 : 0.08,
        downBeat ? 0.11 : 0.055,
        "sine",
        musicGain,
      );

      if (downBeat) {
        const chord = beat % 8 === 0 ? [261.63, 329.63, 392] : [293.66, 369.99, 440];
        chord.forEach((frequency) => {
          this.createTone(
            time,
            frequency,
            beatDuration * 3.7,
            0.018,
            "sine",
            musicGain,
          );
        });
      }
    }
  }

  private createTone(
    startTime: number,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    output: AudioNode,
  ): void {
    if (!this.context) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
    this.scheduledSources.add(oscillator);
    oscillator.addEventListener(
      "ended",
      () => {
        oscillator.disconnect();
        gain.disconnect();
        this.scheduledSources.delete(oscillator);
      },
      { once: true },
    );
  }
}
