export class HttpError extends Error {
  public isHttpError: true;
  public status: number;

  constructor(status: number, message: string, cause?: unknown) {
    super(message);
    this.isHttpError = true;
    this.status = status;
    this.cause = cause;
  }
}
