export interface StorageOutcome<T> {
  value: T;
  warning: string;
}

const STORAGE_KEY = "kids-proseca:stage-1-cleared";
const STORAGE_WARNING =
  "このブラウザでは きろくを ほぞんできません。ゲームは そのまま あそべます。";

export class ProgressStorage {
  constructor(
    private readonly getStorage: () => Storage = () => window.localStorage,
  ) {}

  readStageOneCleared(): StorageOutcome<boolean> {
    try {
      return {
        value: this.getStorage().getItem(STORAGE_KEY) === "true",
        warning: "",
      };
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }

      return { value: false, warning: STORAGE_WARNING };
    }
  }

  saveStageOneCleared(): StorageOutcome<true> {
    try {
      this.getStorage().setItem(STORAGE_KEY, "true");
      return { value: true, warning: "" };
    } catch (error: unknown) {
      if (!(error instanceof DOMException)) {
        throw error;
      }

      return { value: true, warning: STORAGE_WARNING };
    }
  }
}
