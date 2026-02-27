export class HttpError extends Error {
  public isHttpError: true;

  constructor(
    public status: number,
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.isHttpError = true;
  }
}
