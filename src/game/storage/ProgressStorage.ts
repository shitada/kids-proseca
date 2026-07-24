export type TicketRank = "bronze" | "silver" | "gold";

export interface SaveDataV2 {
  version: 2;
  unlockedStage: number;
  clearedStages: number[];
  bestScores: Record<string, number>;
  bestTickets: Record<string, TicketRank>;
}

export interface StorageOutcome<T> {
  value: T;
  warning: string;
}

export interface StageResult {
  stageNumber: number;
  stageId: string;
  score: number;
  ticket: TicketRank;
}

const STORAGE_KEY = "kids-proseca:progress-v2";
const LEGACY_STORAGE_KEY = "kids-proseca:stage-1-cleared";
const STORAGE_WARNING =
  "このブラウザでは きろくを ほぞんできません。ゲームは そのまま あそべます。";
const CORRUPT_WARNING =
  "きろくを よみこめなかったため、あたらしい きろくで はじめます。";
const MAX_STAGE = 13;
const TICKET_VALUE: Record<TicketRank, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

export class ProgressStorage {
  private memoryData = createDefaultSave();
  private hasSessionProgress = false;
  private persistenceUnavailable = false;

  constructor(
    private readonly getStorage: () => Storage = () => window.localStorage,
  ) {}

  load(): StorageOutcome<SaveDataV2> {
    let storage: Storage;
    try {
      storage = this.getStorage();
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }
      return { value: cloneSave(this.memoryData), warning: STORAGE_WARNING };
    }

    let raw: string | null;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }
      return { value: cloneSave(this.memoryData), warning: STORAGE_WARNING };
    }

    if (raw === null) {
      if (this.hasSessionProgress) {
        return {
          value: cloneSave(this.memoryData),
          warning: this.persistenceUnavailable ? STORAGE_WARNING : "",
        };
      }
      return this.migrateLegacy(storage);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error: unknown) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
      this.memoryData = createDefaultSave();
      return { value: cloneSave(this.memoryData), warning: CORRUPT_WARNING };
    }

    if (!isSaveData(parsed)) {
      this.memoryData = createDefaultSave();
      return { value: cloneSave(this.memoryData), warning: CORRUPT_WARNING };
    }

    this.memoryData = cloneSave(parsed);
    this.hasSessionProgress = true;
    return { value: cloneSave(this.memoryData), warning: "" };
  }

  recordStageResult(result: StageResult): StorageOutcome<SaveDataV2> {
    const loaded = this.load();
    const next = cloneSave(loaded.value);
    next.unlockedStage = Math.max(
      next.unlockedStage,
      Math.min(MAX_STAGE, result.stageNumber + 1),
    );
    if (!next.clearedStages.includes(result.stageNumber)) {
      next.clearedStages.push(result.stageNumber);
      next.clearedStages.sort((left, right) => left - right);
    }
    next.bestScores[result.stageId] = Math.max(
      next.bestScores[result.stageId] ?? 0,
      result.score,
    );

    const currentTicket = next.bestTickets[result.stageId];
    if (
      currentTicket === undefined ||
      TICKET_VALUE[result.ticket] > TICKET_VALUE[currentTicket]
    ) {
      next.bestTickets[result.stageId] = result.ticket;
    }

    this.memoryData = next;
    this.hasSessionProgress = true;

    try {
      this.getStorage().setItem(STORAGE_KEY, JSON.stringify(next));
      this.persistenceUnavailable = false;
      return { value: cloneSave(next), warning: loaded.warning };
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }
      this.persistenceUnavailable = true;
      return { value: cloneSave(next), warning: STORAGE_WARNING };
    }
  }

  private migrateLegacy(storage: Storage): StorageOutcome<SaveDataV2> {
    let legacyCleared = false;
    try {
      legacyCleared = storage.getItem(LEGACY_STORAGE_KEY) === "true";
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }
      return { value: cloneSave(this.memoryData), warning: STORAGE_WARNING };
    }

    const migrated = createDefaultSave();
    if (legacyCleared) {
      migrated.unlockedStage = 2;
      migrated.clearedStages = [1];
    }
    this.memoryData = migrated;
    this.hasSessionProgress = true;

    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      this.persistenceUnavailable = false;
      return { value: cloneSave(migrated), warning: "" };
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }
      this.persistenceUnavailable = true;
      return { value: cloneSave(migrated), warning: STORAGE_WARNING };
    }
  }
}

function createDefaultSave(): SaveDataV2 {
  return {
    version: 2,
    unlockedStage: 1,
    clearedStages: [],
    bestScores: {},
    bestTickets: {},
  };
}

function cloneSave(data: SaveDataV2): SaveDataV2 {
  return {
    version: 2,
    unlockedStage: data.unlockedStage,
    clearedStages: [...data.clearedStages],
    bestScores: { ...data.bestScores },
    bestTickets: { ...data.bestTickets },
  };
}

function isSaveData(value: unknown): value is SaveDataV2 {
  if (!isRecord(value) || value.version !== 2) {
    return false;
  }
  if (
    typeof value.unlockedStage !== "number" ||
    !Number.isInteger(value.unlockedStage) ||
    value.unlockedStage < 1 ||
    value.unlockedStage > MAX_STAGE
  ) {
    return false;
  }
  if (
    !Array.isArray(value.clearedStages) ||
    value.clearedStages.some(
      (stage) =>
        typeof stage !== "number" ||
        !Number.isInteger(stage) ||
        stage < 1 ||
        stage > MAX_STAGE,
    )
  ) {
    return false;
  }
  if (!isNumberRecord(value.bestScores) || !isTicketRecord(value.bestTickets)) {
    return false;
  }
  return true;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (score) => typeof score === "number" && Number.isFinite(score) && score >= 0,
    )
  );
}

function isTicketRecord(value: unknown): value is Record<string, TicketRank> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (ticket) =>
        ticket === "bronze" || ticket === "silver" || ticket === "gold",
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
