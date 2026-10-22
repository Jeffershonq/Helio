export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public fields?: Record<string, string[]>,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, fields?: Record<string, string[]>) => new HttpError(400, m, "bad_request", fields);
export const unauthorized = (m = "Sign in to continue.") => new HttpError(401, m, "unauthorized");
export const forbidden = (m = "You do not have access to this.") => new HttpError(403, m, "forbidden");
export const notFound = (m = "Not found.") => new HttpError(404, m, "not_found");
export const conflict = (m: string, fields?: Record<string, string[]>) => new HttpError(409, m, "conflict", fields);
