import { Status } from "./Status.ts";

export class HttpError extends Error {
  constructor(
    public status: Status,
    message?: string,
  ) {
    super(message);
  }
}
