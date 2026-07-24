import { AudioEngine } from "./audio/AudioEngine";
import { FIRST_STAGE, STAGES, getStage, type StageConfig } from "./config/stages";
import { StageRenderer } from "./render/StageRenderer";
import { JudgementEngine } from "./rhythm/JudgementEngine";
import {
  isLaneIndex,
  type JudgementKind,
  type LaneCount,
  type LaneIndex,
} from "./rhythm/types";
import {
  ProgressStorage,
  type SaveDataV2,
  type TicketRank,
} from "./storage/ProgressStorage";

type GameScreen =
  | "title"
  | "tutorial"
  | "stage-select"
  | "playing"
  | "result";

const KEYBOARD_LAYOUTS: Record<LaneCount, readonly string[]> = {
  2: ["KeyF", "KeyJ"],
  3: ["KeyD", "KeyF", "KeyJ"],
  4: ["KeyD", "KeyF", "KeyJ", "KeyK"],
  5: ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK"],
  6: ["KeyS", "KeyD", "KeyF", "KeyJ", "KeyK", "KeyL"],
};

export class GameApp {
  private readonly root: HTMLElement;
  private readonly audio = new AudioEngine();
  private readonly progressStorage = new ProgressStorage();
  private progress: SaveDataV2;
  private currentStage: StageConfig = FIRST_STAGE;
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
    const loaded = this.progressStorage.load();
    this.progress = loaded.value;
    this.storageWarning = loaded.warning;
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
    const loaded = this.progressStorage.load();
    this.progress = loaded.value;
    this.storageWarning = loaded.warning;

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
            ${this.progress.unlockedStage > 1 ? "つづきから" : "あそぶ"}
          </button>
          <button class="secondary-button" data-action="stages">ステージを えらぶ</button>
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
    this.query<HTMLButtonElement>("[data-action='stages']").addEventListener(
      "click",
      this.showStageSelect,
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
    const stage = getStage(this.progress.unlockedStage) ?? FIRST_STAGE;
    const requestId = ++this.playRequestId;
    const unlock = this.audio.unlock();
    void unlock
      .then(() => {
        if (requestId !== this.playRequestId || this.screen !== "title") {
          return;
        }
        this.audioWarning = "";
        this.startStage(stage);
      })
      .catch((error: unknown) => {
        if (requestId !== this.playRequestId || this.screen !== "title") {
          return;
        }
        this.audio.useSilentFallback();
        this.audioWarning = `おとを さいせいできませんでした。えだけで あそべます。（${this.errorMessage(error)}）`;
        this.startStage(stage);
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
            <p><strong>3</strong> ながい でんしゃは おしたまま</p>
            <p><strong>4</strong> すすむと せんろが 6ほんまで ふえるよ</p>
          </div>
          <button class="primary-button" data-action="close-tutorial">わかった！</button>
        </div>
      </section>
    `;
    this.query<HTMLButtonElement>(
      "[data-action='close-tutorial']",
    ).addEventListener("click", () => this.showTitle(), { once: true });
  };

  private readonly showStageSelect = (event?: Event): void => {
    event?.preventDefault();
    this.playRequestId += 1;
    this.stopStage();
    this.screen = "stage-select";
    const loaded = this.progressStorage.load();
    this.progress = loaded.value;
    this.storageWarning = loaded.warning;

    const stageCards = STAGES.map((stage) => {
      const unlocked = stage.stageNumber <= this.progress.unlockedStage;
      const cleared = this.progress.clearedStages.includes(stage.stageNumber);
      const ticket = this.progress.bestTickets[stage.id];
      const category =
        stage.category === "jr"
          ? "JR"
          : stage.category === "subway"
            ? "ちかてつ"
            : "してつなど";
      const ticketIcon =
        ticket === "gold" ? "🥇" : ticket === "silver" ? "🥈" : ticket === "bronze" ? "🎫" : "";

      return `
        <button
          class="stage-card ${cleared ? "is-cleared" : ""}"
          data-stage="${stage.stageNumber}"
          ${unlocked ? "" : "disabled"}
          aria-label="ステージ${stage.stageNumber} ${stage.routeName}${unlocked ? "" : " ロック"}"
        >
          <span class="stage-number">${unlocked ? `STAGE ${stage.stageNumber}` : "🔒"}</span>
          <strong>${unlocked ? stage.routeName : "？？？"}</strong>
          <small>${unlocked ? `${category}・${stage.worldName}・${stage.laneCount}レーン` : "まえの ステージを クリアしよう"}</small>
          <span class="stage-ticket">${ticketIcon}</span>
        </button>
      `;
    }).join("");

    this.root.innerHTML = `
      <section class="stage-select-screen">
        <header class="stage-select-header">
          <div>
            <p class="eyebrow">とうきょう ろせんマップ</p>
            <h2>ステージを えらぼう</h2>
          </div>
          <button class="round-button" data-action="stage-home" aria-label="ホームにもどる">⌂</button>
        </header>
        <div class="stage-map">${stageCards}</div>
        ${this.storageWarning ? `<p class="audio-warning">${this.storageWarning}</p>` : ""}
      </section>
    `;

    this.query<HTMLButtonElement>("[data-action='stage-home']").addEventListener(
      "click",
      () => this.showTitle(),
    );
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-stage]:not(:disabled)")
      .forEach((button) => {
        button.addEventListener("click", this.handleStageChoice);
      });
  };

  private readonly handleStageChoice = (event: Event): void => {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const stageNumber = Number(button.dataset.stage);
    const stage = getStage(stageNumber);
    if (!stage || stage.stageNumber > this.progress.unlockedStage) {
      return;
    }

    button.disabled = true;
    const requestId = ++this.playRequestId;
    const unlock = this.audio.unlock();
    void unlock
      .then(() => {
        if (
          requestId !== this.playRequestId ||
          this.screen !== "stage-select"
        ) {
          return;
        }
        this.audioWarning = "";
        this.startStage(stage);
      })
      .catch((error: unknown) => {
        if (
          requestId !== this.playRequestId ||
          this.screen !== "stage-select"
        ) {
          return;
        }
        this.audio.useSilentFallback();
        this.audioWarning = `おとを さいせいできませんでした。えだけで あそべます。（${this.errorMessage(error)}）`;
        this.startStage(stage);
      });
  };

  private startStage(stage: StageConfig = this.currentStage): void {
    this.stopStage();
    this.currentStage = stage;
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
    this.judgement = new JudgementEngine(stage.notes, {
      perfect: 0.18,
      good: 0.34,
    });

    this.root.innerHTML = `
      <section class="game-screen">
        <canvas class="game-canvas" aria-label="でんしゃリズムゲーム"></canvas>
        <header class="game-hud">
          <button class="round-button" data-action="home" aria-label="ホームにもどる">⌂</button>
          <div class="stage-label">
            <small>ステージ ${stage.stageNumber}・${stage.laneCount}レーン</small>
            <strong>${stage.routeName}</strong>
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
        <div class="lane-controls" style="--lane-count: ${stage.laneCount}">
          ${this.renderLaneButtons(stage.laneCount)}
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
    this.stageRenderer = new StageRenderer(canvas, stage);

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

    this.audio.startStage(stage);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  private readonly handleLaneTap = (event: PointerEvent): void => {
    event.preventDefault();
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const lane = this.parseButtonLane(button);
    if (lane === null) {
      return;
    }
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

    const lane = this.parseButtonLane(button);
    if (lane === null) {
      return;
    }
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

    const lane = this.getKeyboardLane(event.code);
    if (lane !== null) {
      this.pressLane(lane);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (this.screen !== "playing" || this.paused || !this.judgement) {
      return;
    }

    const lane = this.getKeyboardLane(event.code);
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
      this.audio.playTrainNote(result.note.midiNote, result.kind);
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
    note?: { midiNote: number; lane: LaneIndex };
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

    this.audio.playTrainNote(result.note.midiNote, result.kind);
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

    if (elapsed >= this.currentStage.duration) {
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
    const progress = Math.max(
      0,
      Math.min(1, elapsed / this.currentStage.duration),
    );
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
    const hitCount = summary.perfect + summary.good;
    const accuracy = summary.total === 0 ? 0 : hitCount / summary.total;
    const ticketRank: TicketRank =
      accuracy >= 0.85 ? "gold" : accuracy >= 0.6 ? "silver" : "bronze";
    const ticketLabel =
      ticketRank === "gold"
        ? "きんの きっぷ"
        : ticketRank === "silver"
          ? "ぎんの きっぷ"
          : "きっぷ";
    const saved = this.progressStorage.recordStageResult({
      stageNumber: this.currentStage.stageNumber,
      stageId: this.currentStage.id,
      score: this.score,
      ticket: ticketRank,
    });
    this.progress = saved.value;
    this.storageWarning = saved.warning;
    this.audio.stopStage();
    this.audio.playClear(this.currentStage);
    this.stageRenderer?.dispose();
    this.stageRenderer = null;
    this.judgement = null;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.screen = "result";

    const nextStage = getStage(this.currentStage.stageNumber + 1);
    const allClear = this.currentStage.stageNumber === STAGES.length;

    this.root.innerHTML = `
      <section class="result-screen">
        <div class="result-card">
          <div class="result-stars" aria-hidden="true">⭐ 🚃 ⭐</div>
          <p class="eyebrow">ステージ ${this.currentStage.stageNumber} クリア！</p>
          <h2>${allClear ? "ぜんろせん クリア！" : "やったね！"}</h2>
          <p class="result-route">${this.currentStage.routeName}</p>
          <p class="ticket">${ticketLabel}を もらったよ</p>
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
          ${
            nextStage
              ? `<button class="primary-button" data-action="next-stage">つぎの ステージへ</button>`
              : `<p class="all-clear-message">13の ろせんに おとが もどったよ！</p>`
          }
          <button class="primary-button" data-action="replay">もういちど</button>
          <button class="secondary-button" data-action="result-map">ステージを えらぶ</button>
          <button class="secondary-button" data-action="result-home">ホームへ</button>
        </div>
      </section>
    `;

    if (nextStage) {
      this.query<HTMLButtonElement>(
        "[data-action='next-stage']",
      ).addEventListener("click", () => this.startStage(nextStage));
    }
    this.query<HTMLButtonElement>("[data-action='replay']").addEventListener(
      "click",
      () => this.startStage(),
    );
    this.query<HTMLButtonElement>("[data-action='result-map']").addEventListener(
      "click",
      () => this.showStageSelect(),
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

  private renderLaneButtons(laneCount: LaneCount): string {
    return Array.from(
      { length: laneCount },
      (_, lane) => `
        <button class="lane-button" data-lane="${lane}" aria-label="${lane + 1}ばんの せんろ">
          <span>${lane + 1}</span>
        </button>
      `,
    ).join("");
  }

  private parseButtonLane(button: HTMLButtonElement): LaneIndex | null {
    const lane = Number(button.dataset.lane);
    if (!isLaneIndex(lane) || lane >= this.currentStage.laneCount) {
      return null;
    }
    return lane;
  }

  private getKeyboardLane(code: string): LaneIndex | null {
    const lane = KEYBOARD_LAYOUTS[this.currentStage.laneCount].indexOf(code);
    return isLaneIndex(lane) && lane < this.currentStage.laneCount ? lane : null;
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
