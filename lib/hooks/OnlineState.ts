/// <reference path="https://gist.githubusercontent.com/mstoecklein/6f0787c663101f78367586d675dd2088/raw/d39ba98f98320238a90aeb0c8bcd7c021f49a0a3/globals.d.ts" />

import { Context } from "../Context.ts";
import { HttpError } from "../HttpError.ts";
import { ActionOptions } from "../Router.ts";
import { RouterHook } from "../RouterHook.ts";
import { Status } from "../Status.ts";

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

  get hasConnectionData() {
    return "connection" in navigator;
  }

  downlink: number | null = null;
  effectiveType: string | null = null;
  rtt: number | null = null;
  type: string | null = null;
  saveData: boolean | null = null;

  get ok() {
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
    if (!this.hasConnectionData) return;
    this.downlink = navigator.connection.downlink;
    this.effectiveType = navigator.connection.effectiveType;
    this.rtt = navigator.connection.rtt;
    this.type = navigator.connection.type;
    this.saveData = navigator.connection.saveData;
  };

  toJSON() {
    const { downlink, effectiveType, rtt, type, saveData, ok } = this;
    return { downlink, effectiveType, rtt, type, saveData, ok };
  }
}

export default function onlineState(options: Partial<OnlineStateOptions> = {}) {
  const onlineState = new OnlineState(options);
  return {
    onRequest: (context: Context, options: ActionOptions) => {
      onlineState.update();

      // save the online state in the context
      context.state.onlineState = onlineState.toJSON();

      // check if the client has a good connection
      const ok = onlineState.ok;

      // Throw an error if the client is offline and the offline
      // option is set to "throw"
      // This is useful to stop the request if the client is offline and
      // the service worker is not able to handle the request.
      if (options.offline === "throw" && !ok) {
        throw new HttpError(Status.ServiceUnavailable, "Service Unavailable");
      }

      // stop responding if the client is not offline and the offline
      // option is set to "only"
      // This is useful to keep the work load from the client if online
      // and use the service worker as a route endpoint if offline.
      if (options.offline === "only" && ok) {
        return false;
      }
    },
  } as RouterHook;
}
