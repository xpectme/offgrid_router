/// <reference path="https://gist.githubusercontent.com/mstoecklein/6f0787c663101f78367586d675dd2088/raw/d39ba98f98320238a90aeb0c8bcd7c021f49a0a3/globals.d.ts" />

export interface OnlineStateOptions {
  downlink: number;
  latency: number;
  networkType?:
    | "wifi"
    | "cellular"
    | "ethernet"
    | "bluetooth"
    | "wimax"
    | "other"
    | "unknown";
}

export class OnlineState {
  #options: OnlineStateOptions = {
    // minimum optimal downlink in megabits per second
    downlink: 0.5,

    // maximum optimal latency in milliseconds
    latency: 750,
  };

  get state() {
    return this.connectionOK;
  }

  get hasConnectionData() {
    return "connection" in navigator;
  }

  downlink: number | null = null;
  effectiveType: string | null = null;
  rtt: number | null = null;
  type: string | null = null;
  saveData: boolean | null = null;

  get connectionOK() {
    if (this.downlink !== null && this.rtt !== null) {
      return (
        navigator.onLine &&
        this.downlink >= this.#options.downlink &&
        this.rtt <= this.#options.latency
      );
    }
    return navigator.onLine;
  }

  constructor(options: Partial<OnlineStateOptions> = {}) {
    this.#options = { ...this.#options, ...options };
  }

  update = () => {
    this.downlink = navigator.connection.downlink;
    this.effectiveType = navigator.connection.effectiveType;
    this.rtt = navigator.connection.rtt;
    this.type = navigator.connection.type;
    this.saveData = navigator.connection.saveData;
    console.log("connection", this, navigator.onLine);
  };
}
