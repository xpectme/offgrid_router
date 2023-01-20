// deno-lint-ignore-file no-explicit-any
/// <reference path="https://gist.githubusercontent.com/mstoecklein/6f0787c663101f78367586d675dd2088/raw/d39ba98f98320238a90aeb0c8bcd7c021f49a0a3/globals.d.ts" />

import { Router as TinyRouter, ViewEngine } from "../deps.ts";
import { Context } from "./Context.ts";
import { HttpError } from "./HttpError.ts";
import { HookFunction, RouterHook } from "./RouterHook.ts";
import { Status } from "./Status.ts";

export interface ActionHandler<State extends Record<string, unknown> = any> {
  (context: Context<State>): Promise<Response | void> | Response | void;
}

export interface ActionOptions {
  // Route is sensitive to online/offline state.
  offline?: "throw" | "only" | "ignore";

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

export type RequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";
export type MethodWildcard = "ALL";

export interface RequestParams {
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

export interface RequestMatch {
  params: RequestParams;
  matches?: RegExpExecArray;
  method: RequestMethod | MethodWildcard;
  path: string;
  regexp: RegExp;
  options: ActionOptions;
  keys: Keys;
  handler: ActionHandler;
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

export class Router<State extends { [key: string]: unknown } = any>
  extends TinyRouter {
  engine: ViewEngine;

  #errorRoutes = new Map<Status, ActionHandler>();
  get errorRoutes() {
    return this.#errorRoutes;
  }

  appState: State;
  request!: Request;
  response!: Promise<Response | void>;

  readonly hooks = new Set<RouterHook>();

  constructor() {
    super();
    this.appState = {} as State;
  }

  setState(state: State) {
    for (const [key, value] of Object.entries(state)) {
      (this.appState as any)[key] = value;
    }
  }

  setViewEngine(engine: ViewEngine) {
    this.engine = engine;
  }

  setErrorHandler<State extends { error: Error }>(
    status: Status,
    handler?: ActionHandler<State>,
  ) {
    if (!handler) {
      handler = (context) =>
        context.view(status.toString(), { title: Status[status] } as any);
    }
    this.#errorRoutes.set(status, handler as ActionHandler);
  }

  listen(event: FetchEvent) {
    const request = event.request;
    const { pathname } = new URL(request.url);
    const match: RequestMatch = this.match(request.method, pathname);
    if (match) {
      const context = new Context(this, this.appState, request, match);
      event.respondWith(this.#handleRequest(context, match));
    }
  }

  async #handleRequest(
    context: Context,
    match: RequestMatch,
  ): Promise<Response> {
    try {
      for (const hook of this.hooks) {
        const hookFn = "onRequest" in hook
          ? hook.onRequest
          : hook as HookFunction;
        if ("function" === typeof hookFn) {
          const respond = await hookFn(context, match.options);
          if (respond === false) {
            return;
          }
        }
      }

      const handler = match.handler;
      const response = await this.#executeHandler(handler, context);
      if (response) return response;

      // if the handler doesn't return a response, return a 204
      return new Response(null, { status: Status.NoContent });
    } catch (error) {
      return this.#handleError(context, match, error);
    }
  }

  async #handleError(
    context: Context,
    match: RequestMatch,
    error: Error,
  ): Promise<Response> {
    try {
      const status = error instanceof HttpError
        ? error.status
        : Status.InternalServerError;

      for (const hook of this.hooks) {
        const hookFn = "onError" in hook ? hook.onError : hook as HookFunction;
        if ("function" === typeof hookFn) {
          const respond = await hookFn(context, match.options);
          if (respond === false) {
            return;
          }
        }
      }

      // get the route handler for the error status
      const handler = this.errorRoutes.get(status);
      (context.state as any).error = error;

      if (handler) {
        const response = await this.#executeHandler(handler, context);
        if (response) return response;
      }

      return new Response(error.message, { status });
    } catch {
      const status = Status.InternalServerError;
      const handler = this.errorRoutes.get(status);
      if (handler) {
        const response = await this.#executeHandler(handler, context);
        if (response) return response;
      }

      // if the handler throws, return a generic error response
      return new Response(error.message, { status });
    }
  }

  async #executeHandler(handler: ActionHandler, context: Context) {
    let response = await handler(context);
    response = response ?? await this.response;
    if (response) return response;
  }
}
