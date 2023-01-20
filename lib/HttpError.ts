import { Status } from "./Status.ts";

export function toHttpError(error: Error, status: Status.InternalServerError) {
  const httpError = new HttpError(status, error.message);
  httpError.stack = error.stack;
  return httpError;
}

export class HttpError extends Error {
  constructor(
    public status: Status,
    message?: string,
  ) {
    super(message);
  }
}
