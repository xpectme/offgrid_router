// deno-lint-ignore-file no-explicit-any
import { ViewEngineOptions } from "../deps.ts";
import { Router } from "./Router.ts";
import { HttpError, toHttpError } from "./HttpError.ts";
import { Status } from "./Status.ts";

export type ContextViewOptions = Partial<ViewEngineOptions>;

export class Context<State extends { [key: string]: unknown } = any> {
  response: Response;
  readonly params: Record<string, string> = {};
  readonly query: URLSearchParams;

  constructor(
    public app: Router<State>,
    public state: State,
    public request: Request,
    match: any,
  ) {
    this.app = app;
    this.params = {};
    for (const [key, value] of Object.entries(match.params)) {
      this.params[key] = decodeURIComponent(value as string);
    }

    this.query = new URLSearchParams(request.url.split("?")[1]);
    this.response = new Response(null, { status: Status.OK });
  }

  assert(condition: boolean, status: Status, message?: string) {
    if (!condition) {
      throw new HttpError(status, message);
    }
  }

  throws(status: Status, message?: string) {
    throw new HttpError(status, message);
  }

  plain(data: string) {
    this.#createResponse(String(data), "text/plain");
  }

  json(data: Record<string, unknown>) {
    this.#createResponse(JSON.stringify(data), "application/json");
  }

  view(
    name: string,
    data: State = {} as State,
    options: ContextViewOptions = {},
  ) {
    const engine = this.app.engine;
    const html = engine.view(name, { ...this.state, ...data }, options);
    this.#createResponse(html, "text/html");
  }

  partial(
    name: string,
    data: State = {} as State,
    options: ContextViewOptions = {},
  ) {
    const engine = this.app.engine;
    const html = engine.partial(name, { ...this.state, ...data }, options);
    this.#createResponse(html, "text/html");
  }

  #createResponse(
    data: unknown | Promise<unknown>,
    contentType: string,
  ) {
    const headers = this.response.headers;
    const status = this.response.status;

    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", contentType);
    }

    const dataPromise = data instanceof Promise ? data : Promise.resolve(data);
    this.app.response = dataPromise
      .then((data: unknown) => new Response(String(data), { headers, status }))
      .catch((error) => {
        throw toHttpError(error, Status.InternalServerError);
      });
  }
}
