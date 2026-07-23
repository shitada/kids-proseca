import { AudioEngine } from "./audio/AudioEngine";
import { FIRST_STAGE } from "./config/stages";
import { StageRenderer } from "./render/StageRenderer";
import { JudgementEngine } from "./rhythm/JudgementEngine";
import type { JudgementKind, LaneIndex } from "./rhythm/types";
import { ProgressStorage } from "./storage/ProgressStorage";

type GameScreen = "title" | "tutorial" | "playing" | "result";

export class GameApp {
  private readonly root: HTMLElement;
  private readonly audio = new AudioEngine();
  private readonly progressStorage = new ProgressStorage();
  private screen: GameScreen = "title";
  private playRequestId = 0;
  private resuming = false;
  private judgement: JudgementEngine | null = null;
  private stageRenderer: StageRenderer | null = null;
  private animationFrame = 0;
  private paused = false;
  private combo = 0;
  private bestCombo = 0;
  private score = 0;
  private perfect = 0;
  private good = 0;
  private misses = 0;
  private missStreak = 0;
  private assistHitsRemaining = 0;
  private audioWarning = "";
  private storageWarning = "";

  constructor(root: HTMLElement) {
    this.root = root;
  }

  mount(): void {
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    document.addEventListener("contextmenu", this.preventContextMenu);
    this.showTitle();
  }

  private readonly preventContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private showTitle(): void {
    this.playRequestId += 1;
    this.stopStage();
    this.screen = "title";
    const progress = this.progressStorage.readStageOneCleared();
    const cleared = progress.value;
    this.storageWarning = progress.warning;

    this.root.innerHTML = `
      <section class="title-screen">
        <div class="title-skyline" aria-hidden="true"></div>
        <div class="title-card">
          <p class="eyebrow">おとを つないで しゅっぱつ！</p>
          <h1><span>とうきょう</span> でんしゃビート！</h1>
          <div class="title-train" aria-hidden="true">
            <span>🚃</span><span>♪</span><span>🚃</span>
          </div>
          <p class="title-copy">
            でんしゃが えきに ついたら<br />
            リズムに あわせて タップしよう
          </p>
          <button class="primary-button" data-action="play">
            ${cleared ? "もういちど あそぶ" : "あそぶ"}
          </button>
          <button class="secondary-button" data-action="tutorial">あそびかた</button>
          <p class="rights-badge">かいはつようの かりデザイン・オリジナルおんげん</p>
          ${this.audioWarning ? `<p class="audio-warning">${this.audioWarning}</p>` : ""}
          ${this.storageWarning ? `<p class="audio-warning">${this.storageWarning}</p>` : ""}
        </div>
      </section>
    `;

    this.query<HTMLButtonElement>("[data-action='play']").addEventListener(
      "click",
      this.handlePlay,
    );
    this.query<HTMLButtonElement>("[data-action='tutorial']").addEventListener(
      "click",
      this.showTutorial,
    );
  }

  private readonly handlePlay = (event: Event): void => {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.disabled = true;
    button.textContent = "おとを じゅんびちゅう…";
    const requestId = ++this.playRequestId;
    const unlock = this.audio.unlock();
    void unlock
      .then(() => {
        if (requestId !== this.playRequestId || this.screen !== "title") {
          return;
        }
        this.audioWarning = "";
        this.startStage();
      })
      .catch((error: unknown) => {
        if (requestId !== this.playRequestId || this.screen !== "title") {
          return;
        }
        this.audio.useSilentFallback();
        this.audioWarning = `おとを さいせいできませんでした。えだけで あそべます。（${this.errorMessage(error)}）`;
        this.startStage();
      });
  };

  private readonly showTutorial = (event: Event): void => {
    event.preventDefault();
    this.playRequestId += 1;
    this.screen = "tutorial";
    this.root.innerHTML = `
      <section class="tutorial-screen">
        <div class="tutorial-card">
          <p class="eyebrow">あそびかた</p>
          <h2>えきで タップ！</h2>
          <div class="tutorial-demo" aria-hidden="true">
            <span class="demo-train">🚃</span>
            <span class="demo-line"></span>
            <span class="demo-station">⭐ えき ⭐</span>
          </div>
          <div class="tutorial-steps">
            <p><strong>1</strong> でんしゃが うえから くるよ</p>
            <p><strong>2</strong> ひかる えきに ついたら タップ</p>
            <p><strong>3</strong> おとを つないで ゴールしよう</p>
          </div>
          <button class="primary-button" data-action="close-tutorial">わかった！</button>
        </div>
      </section>
    `;
    this.query<HTMLButtonElement>(
      "[data-action='close-tutorial']",
    ).addEventListener("click", () => this.showTitle(), { once: true });
  };

  private startStage(): void {
    this.stopStage();
    this.screen = "playing";
    this.paused = false;
    this.resuming = false;
    this.combo = 0;
    this.bestCombo = 0;
    this.score = 0;
    this.perfect = 0;
    this.good = 0;
    this.misses = 0;
    this.missStreak = 0;
    this.assistHitsRemaining = 0;
    this.judgement = new JudgementEngine(FIRST_STAGE.notes, {
      perfect: 0.18,
      good: 0.34,
    });

    this.root.innerHTML = `
      <section class="game-screen">
        <canvas class="game-canvas" aria-label="でんしゃリズムゲーム"></canvas>
        <header class="game-hud">
          <button class="round-button" data-action="home" aria-label="ホームにもどる">⌂</button>
          <div class="stage-label">
            <small>ステージ ${FIRST_STAGE.stageNumber}</small>
            <strong>${FIRST_STAGE.routeName}</strong>
          </div>
          <div class="score-panel">
            <span>スコア <strong data-ui="score">0</strong></span>
            <span>れんけつ <strong data-ui="combo">0</strong></span>
          </div>
          <button class="round-button" data-action="mute" aria-label="おとをけす">♪</button>
          <button class="round-button" data-action="pause" aria-label="いちじていし">Ⅱ</button>
        </header>
        <div class="progress-track" aria-hidden="true">
          <span data-ui="progress"></span>
        </div>
        <div class="countdown" data-ui="countdown" aria-live="polite"></div>
        <div class="feedback" data-ui="feedback" aria-live="polite"></div>
        <div class="assist-badge" data-ui="assist" hidden>✨ おたすけガイド</div>
        ${this.audioWarning ? `<p class="in-game-warning">${this.audioWarning}</p>` : ""}
        <div class="lane-controls">
          <button class="lane-button lane-left" data-lane="0" aria-label="ひだりのせんろ">
            <span>ひだり</span>
          </button>
          <button class="lane-button lane-right" data-lane="1" aria-label="みぎのせんろ">
            <span>みぎ</span>
          </button>
        </div>
        <div class="pause-overlay" data-ui="pause-overlay" hidden>
          <div>
            <span aria-hidden="true">🚉</span>
            <h2>ひとやすみ</h2>
            <button class="primary-button" data-action="resume">つづける</button>
          </div>
        </div>
      </section>
    `;

    const canvas = this.query<HTMLCanvasElement>(".game-canvas");
    this.stageRenderer = new StageRenderer(canvas, FIRST_STAGE);

    this.root.querySelectorAll<HTMLButtonElement>("[data-lane]").forEach((button) => {
      button.addEventListener("pointerdown", this.handleLaneTap);
      button.addEventListener("pointerup", this.handleLaneRelease);
      button.addEventListener("pointercancel", this.handleLaneRelease);
    });
    this.query<HTMLButtonElement>("[data-action='home']").addEventListener(
      "click",
      () => this.showTitle(),
    );
    this.query<HTMLButtonElement>("[data-action='mute']").addEventListener(
      "click",
      this.handleMute,
    );
    this.query<HTMLButtonElement>("[data-action='pause']").addEventListener(
      "click",
      () => this.pauseGame(),
    );
    this.query<HTMLButtonElement>("[data-action='resume']").addEventListener(
      "click",
      this.handleResume,
    );
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);

    this.audio.startStage(FIRST_STAGE);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  private readonly handleLaneTap = (event: PointerEvent): void => {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const lane = button.dataset.lane === "0" ? 0 : 1;
    this.pressLane(lane);
    button.classList.remove("is-pressed");
    void button.offsetWidth;
    button.classList.add("is-pressed");
  };

  private readonly handleLaneRelease = (event: PointerEvent): void => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement) || !this.judgement) {
      return;
    }

    const lane = button.dataset.lane === "0" ? 0 : 1;
    const result = this.judgement.release(lane, this.audio.getElapsed());
    button.classList.remove("is-holding");

    if (result.phase === "hold-complete") {
      this.registerHit(result);
    } else if (result.phase === "hold-break") {
      this.registerMisses(1);
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || this.screen !== "playing" || this.paused) {
      return;
    }

    if (event.code === "KeyF" || event.code === "ArrowLeft") {
      this.pressLane(0);
    } else if (event.code === "KeyJ" || event.code === "ArrowRight") {
      this.pressLane(1);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (this.screen !== "playing" || this.paused || !this.judgement) {
      return;
    }

    const lane =
      event.code === "KeyF" || event.code === "ArrowLeft"
        ? 0
        : event.code === "KeyJ" || event.code === "ArrowRight"
          ? 1
          : null;
    if (lane === null) {
      return;
    }

    const result = this.judgement.release(lane, this.audio.getElapsed());
    if (result.phase === "hold-complete") {
      this.registerHit(result);
    } else if (result.phase === "hold-break") {
      this.registerMisses(1);
    }
  };

  private pressLane(lane: LaneIndex): void {
    if (!this.judgement || this.paused) {
      return;
    }

    const elapsed = this.audio.getElapsed();
    if (elapsed < 1.8) {
      return;
    }

    const result = this.judgement.press(lane, elapsed);
    if (result.kind === "empty" || !result.note) {
      this.showFeedback("つぎの でんしゃを まってね", "empty");
      return;
    }

    if (result.phase === "hold-start") {
      this.audio.playTrainNote(result.note.frequency, result.kind);
      this.stageRenderer?.pulseLane(lane, result.kind, elapsed);
      this.root
        .querySelector<HTMLButtonElement>(`[data-lane="${lane}"]`)
        ?.classList.add("is-holding");
      this.showFeedback("そのまま おしてね！", result.kind);
      return;
    }

    this.registerHit(result);
  }

  private registerHit(result: {
    kind: JudgementKind;
    phase: string;
    note?: { frequency: number; lane: LaneIndex };
  }): void {
    if (!result.note || result.kind === "empty") {
      return;
    }

    this.combo += 1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.missStreak = 0;

    if (result.kind === "perfect") {
      this.perfect += 1;
      this.score +=
        (result.phase === "hold-complete" ? 150 : 100) +
        Math.min(this.combo * 2, 40);
      this.showFeedback("ぴったり！", result.kind);
    } else {
      this.good += 1;
      this.score +=
        (result.phase === "hold-complete" ? 105 : 70) +
        Math.min(this.combo, 20);
      this.showFeedback("いいね！", result.kind);
    }

    this.audio.playTrainNote(result.note.frequency, result.kind);
    this.stageRenderer?.pulseLane(
      result.note.lane,
      result.kind,
      this.audio.getElapsed(),
    );

    if (this.assistHitsRemaining > 0) {
      this.assistHitsRemaining -= 1;
      if (this.assistHitsRemaining === 0) {
        this.judgement?.setAssistEnabled(false);
        this.query<HTMLElement>("[data-ui='assist']").hidden = true;
      }
    }

    this.updateHud();
  }

  private readonly tick = (): void => {
    if (
      this.screen !== "playing" ||
      this.paused ||
      !this.judgement ||
      !this.stageRenderer
    ) {
      return;
    }

    const elapsed = this.audio.getElapsed();
    const update = this.judgement.advance(elapsed);
    if (update.misses.length > 0) {
      this.registerMisses(update.misses.length);
    }
    for (const completedHold of update.completedHolds) {
      this.registerHit(completedHold);
    }

    this.stageRenderer.setAssistLane(
      this.assistHitsRemaining > 0
        ? this.judgement.getNextPendingLane(elapsed, 1.15)
        : null,
    );
    this.stageRenderer.render(this.judgement.getStates(), elapsed);
    this.updateProgress(elapsed);
    this.updateCountdown(elapsed);

    if (elapsed >= FIRST_STAGE.duration) {
      this.finishStage();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.tick);
  };

  private registerMisses(count: number): void {
    this.misses += count;
    this.missStreak += count;
    this.combo = 0;
    this.showFeedback("だいじょうぶ！ つぎへ いこう", "empty");

    if (this.missStreak >= 3 && this.assistHitsRemaining === 0) {
      this.assistHitsRemaining = 6;
      this.judgement?.setAssistEnabled(true);
      this.query<HTMLElement>("[data-ui='assist']").hidden = false;
    }

    this.updateHud();
  }

  private updateHud(): void {
    this.query<HTMLElement>("[data-ui='score']").textContent =
      this.score.toLocaleString("ja-JP");
    this.query<HTMLElement>("[data-ui='combo']").textContent = String(this.combo);
  }

  private updateProgress(elapsed: number): void {
    const progress = Math.max(0, Math.min(1, elapsed / FIRST_STAGE.duration));
    this.query<HTMLElement>("[data-ui='progress']").style.width =
      `${progress * 100}%`;
  }

  private updateCountdown(elapsed: number): void {
    const countdown = this.query<HTMLElement>("[data-ui='countdown']");
    let text = "";

    if (elapsed < 0) {
      text = "";
    } else if (elapsed < 0.7) {
      text = "3";
    } else if (elapsed < 1.4) {
      text = "2";
    } else if (elapsed < 2.1) {
      text = "1";
    } else if (elapsed < 2.6) {
      text = "しゅっぱつ！";
    }

    countdown.textContent = text;
    countdown.classList.toggle("is-visible", text.length > 0);
  }

  private showFeedback(text: string, kind: JudgementKind): void {
    const feedback = this.query<HTMLElement>("[data-ui='feedback']");
    feedback.textContent = text;
    feedback.dataset.kind = kind;
    feedback.classList.remove("is-visible");
    void feedback.offsetWidth;
    feedback.classList.add("is-visible");
  }

  private finishStage(): void {
    if (!this.judgement) {
      return;
    }

    cancelAnimationFrame(this.animationFrame);
    const summary = this.judgement.getSummary();
    this.storageWarning = this.progressStorage.saveStageOneCleared().warning;
    this.audio.stopStage();
    this.audio.playClear();
    this.stageRenderer?.dispose();
    this.stageRenderer = null;
    this.judgement = null;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.screen = "result";

    const hitCount = summary.perfect + summary.good;
    const accuracy = summary.total === 0 ? 0 : hitCount / summary.total;
    const ticket =
      accuracy >= 0.85 ? "きんの きっぷ" : accuracy >= 0.6 ? "ぎんの きっぷ" : "きっぷ";

    this.root.innerHTML = `
      <section class="result-screen">
        <div class="result-card">
          <div class="result-stars" aria-hidden="true">⭐ 🚃 ⭐</div>
          <p class="eyebrow">ステージ クリア！</p>
          <h2>やったね！</h2>
          <p class="ticket">${ticket}を もらったよ</p>
          <dl class="result-grid">
            <div><dt>ぴったり</dt><dd>${summary.perfect}</dd></div>
            <div><dt>いいね</dt><dd>${summary.good}</dd></div>
            <div><dt>れんけつ</dt><dd>${this.bestCombo}</dd></div>
            <div><dt>スコア</dt><dd>${this.score.toLocaleString("ja-JP")}</dd></div>
          </dl>
          <p class="placeholder-note">
            このステージは かりの しゃりょうと<br />
            じどうせいせいした オリジナルきょくを つかっています
          </p>
          ${this.storageWarning ? `<p class="audio-warning">${this.storageWarning}</p>` : ""}
          <button class="primary-button" data-action="replay">もういちど</button>
          <button class="secondary-button" data-action="result-home">ホームへ</button>
        </div>
      </section>
    `;

    this.query<HTMLButtonElement>("[data-action='replay']").addEventListener(
      "click",
      () => this.startStage(),
    );
    this.query<HTMLButtonElement>("[data-action='result-home']").addEventListener(
      "click",
      () => this.showTitle(),
    );
  }

  private pauseGame(): void {
    if (this.screen !== "playing" || this.paused) {
      return;
    }

    this.paused = true;
    cancelAnimationFrame(this.animationFrame);
    this.audio.pause();
    this.query<HTMLElement>("[data-ui='pause-overlay']").hidden = false;
  }

  private readonly handleResume = (event: Event): void => {
    event.preventDefault();
    if (!this.paused || this.resuming || this.screen !== "playing") {
      return;
    }

    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    this.resuming = true;
    button.disabled = true;
    const resume = this.audio.resume();
    void resume
      .then(() => {
        if (this.screen !== "playing" || !this.paused) {
          this.resuming = false;
          return;
        }

        this.resuming = false;
        button.disabled = false;
        this.paused = false;
        this.query<HTMLElement>("[data-ui='pause-overlay']").hidden = true;
        this.animationFrame = requestAnimationFrame(this.tick);
      })
      .catch((error: unknown) => {
        this.resuming = false;
        button.disabled = false;
        if (this.screen !== "playing") {
          return;
        }

        const overlay = this.query<HTMLElement>("[data-ui='pause-overlay'] div");
        const message = document.createElement("p");
        message.className = "audio-warning";
        message.textContent = `おとを さいかいできませんでした。（${this.errorMessage(error)}）`;
        overlay.append(message);
      });
  };

  private readonly handleMute = (event: Event): void => {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const muted = this.audio.toggleMuted();
    button.textContent = muted ? "×" : "♪";
    button.setAttribute("aria-label", muted ? "おとをだす" : "おとをけす");
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseGame();
    }
  };

  private stopStage(): void {
    cancelAnimationFrame(this.animationFrame);
    this.audio.stopStage();
    this.stageRenderer?.dispose();
    this.stageRenderer = null;
    this.judgement = null;
    this.paused = false;
    this.resuming = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  private query<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Required UI element was not found: ${selector}`);
    }
    return element;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "ふめいな エラー";
  }
}
