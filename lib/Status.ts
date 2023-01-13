export enum Status {
  OK = 200,
  Created = 201,
  Accepted = 202,
  NoContent = 204,

  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,

  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  MisdirectedRequest = 421,

  InternalServerError = 500,
  ServiceUnavailable = 503,
}
