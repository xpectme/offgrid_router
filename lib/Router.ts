// deno-lint-ignore-file no-explicit-any
/// <reference path="https://gist.githubusercontent.com/mstoecklein/6f0787c663101f78367586d675dd2088/raw/d39ba98f98320238a90aeb0c8bcd7c021f49a0a3/globals.d.ts" />

import { Router as TinyRouter, ViewEngine } from "../deps.ts";
import { Context } from "./Context.ts";
import { HttpError } from "./HttpError.ts";
import { OnlineState, OnlineStateOptions } from "./OnlineState.ts";
import { Status } from "./Status.ts";

export interface ActionHandler<State extends Record<string, unknown> = any> {
  (context: Context<State>): Promise<Response | void> | Response | void;
}

export interface ActionOptions {
  // Route is sensitive to online/offline state.
  offlineHandling?: "onlyOffline" | "errorOffline";

  // When `true` the regexp will be case sensitive. (default: `false`)
  sensitive?: boolean;

  // When `true` the regexp allows an optional trailing delimiter to match. (default: `false`)
  strict?: boolean;

  // When `true` the regexp will match to the end of the string. (default: `true`)
  end?: boolean;

  // When `true` the regexp will match from the beginning of the string. (default: `true`)
  start?: boolean;

  // Sets the final character for non-ending optimistic matches. (default: `/`)
  delimiter?: string;

  // List of characters that can also be "end" characters.
  endsWith?: string;

  // Encode path tokens for use in the `RegExp`.
  encode?: (value: string) => string;
}

export type Method =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";
export type MethodWildcard = "ALL";

export interface Params {
  [key: string]: string;
}

export interface TokenKey {
  name: string | number;
  prefix: string;
  suffix: string;
  pattern: string;
  modifier: string;
}

export type Key = TokenKey;
export type Keys = Array<Key>;

export interface Match {
  params: Params;
  matches?: RegExpExecArray;
  method: Method | MethodWildcard;
  path: string;
  regexp: RegExp;
  options: ActionOptions;
  keys: Keys;
  handler: ActionHandler;
}

export interface RouterLogger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
}

declare global {
  interface Router {
    all(path: string, handler: ActionHandler, options?: ActionOptions): void;
    delete(path: string, handler: ActionHandler, options?: ActionOptions): void;
    get(path: string, handler: ActionHandler, options?: ActionOptions): void;
    options(
      path: string,
      handler: ActionHandler,
      options?: ActionOptions,
    ): void;
    patch(path: string, handler: ActionHandler, options?: ActionOptions): void;
    post(path: string, handler: ActionHandler, options?: ActionOptions): void;
    put(path: string, handler: ActionHandler, options?: ActionOptions): void;
  }
}

interface RouterOptions {
  logging: boolean;
  onlineState: OnlineStateOptions | true | false;
}

export class Router<State extends { [key: string]: unknown } = any>
  extends TinyRouter {
  #options: RouterOptions = {
    logging: true,
    onlineState: false,
  };
  engine: ViewEngine;

  #logger: RouterLogger = console;
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;

  #errorRoutes = new Map<Status, ActionHandler>();
  get errorRoutes() {
    return this.#errorRoutes;
  }

  #onlineState: OnlineState | undefined;

  appState: State;
  request!: Request;
  response!: Promise<Response | void>;

  constructor(options: Partial<RouterOptions> = {}) {
    super();
    this.#options = { ...this.#options, ...options };
    this.appState = {} as State;

    const log = (name: string) => (...args: unknown[]) =>
      this.#options.logging ? this.#logger[name](...args) : undefined;
    this.log = log("log");
    this.info = log("info");
    this.warn = log("warn");
    this.error = log("error");
    this.trace = log("trace");

    this.setLogger(console);

    if (this.#options.onlineState) {
      const options = this.#options.onlineState === true
        ? {}
        : this.#options.onlineState;
      this.#onlineState = new OnlineState(options);
    }
  }

  setLogger(logger: RouterLogger) {
    this.#logger = logger;
  }

  setAppState(state: State) {
    for (const [key, value] of Object.entries(state)) {
      (this.appState as any)[key] = value;
    }
  }

  setViewEngine(engine: ViewEngine) {
    this.engine = engine;
  }

  setErrorHandler<State extends { error: Error }>(
    status: Status,
    handler: ActionHandler<State>,
  ) {
    this.#errorRoutes.set(status, handler as ActionHandler);
  }

  listen(event: FetchEvent) {
    const request = event.request;
    const { pathname } = new URL(request.url);
    const match: Match = this.match(request.method, pathname);

    if (match) {
      if (this.#onlineState) {
        this.#onlineState.update();
        if (
          // if the route is only accessible offline, then the service worker
          // will only handle the request if the device is offline.
          (match.options.offlineHandling === "onlyOffline" &&
            this.#onlineState.state)
        ) {
          return;
        } else if (
          // if the route is only accessible online, but the device is offline,
          // then the service worker will force a 503 Service Unavailable response.
          (match.options.offlineHandling === "errorOffline" &&
            !this.#onlineState.state)
        ) {
          event.respondWith(
            (async () => {
              const handler = this.#errorRoutes.get(Status.ServiceUnavailable);
              if (handler) {
                const context = new Context(
                  this,
                  this.appState,
                  request,
                  match,
                );
                context.state = this.appState;
                (context.state as any).connection = this.#onlineState;
                let response = await handler(context);
                response = response ?? await this.response;
                if (response) return response;
              }

              return new Response(null, { status: Status.ServiceUnavailable });
            })(),
          );
          return;
        } else {
          // if the route is accessible online and offline, then the
          // service worker will always handle the request.
        }
      }

      const context = new Context(this, this.appState, request, match);
      context.state = this.appState;
      event.respondWith((async () => {
        try {
          this.info(`DONE: ${match.method} ${match.path}`, match.params);

          // call the route handler
          let response = await match.handler(context);
          response = response ?? await this.response;
          if (response) return response;

          // if the handler doesn't return a response, return a 204
          return new Response(null, { status: Status.NoContent });
        } catch (error) {
          this.warn(`FAIL: ${match.method} ${match.path}`, match.params);

          // get the route handler for the error status
          const handler = error instanceof HttpError
            ? this.errorRoutes.get(error.status)
            : this.errorRoutes.get(Status.InternalServerError);

          if (handler) {
            // set the error on the context, so the handler can access it
            (context.state as any).error = error;

            try {
              // call the handler
              let response = await handler(context);
              response = response ?? await this.response;
              if (response) return response;

              // if the handler doesn't return a response, throw an error
              context.throws(
                Status.InternalServerError,
                `Error handler failed to respond!`,
              );
            } catch (error) {
              this.error(`Error handler failed to respond!`);
              this.trace(error);

              const inernalErrorHandler = this.errorRoutes.get(
                Status.InternalServerError,
              );
              if (inernalErrorHandler) {
                let response = await inernalErrorHandler(context);
                response = response ?? await this.response;
                if (response) return response;
              }

              // if the handler throws, return a generic error response
              return new Response(error.message, {
                status: Status.InternalServerError,
              });
            }
          }

          // otherwise, return a generic error response
          return new Response(error.message, { status: error.status });
        }
      })());
    }
  }
}
