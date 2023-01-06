export class ServerError extends Error {
  constructor(message: string, init?: ResponseInit);
  constructor(origin: Error, init?: ResponseInit);
  constructor(messageOrError: string | Error, public init?: ResponseInit) {
    super(
      typeof messageOrError === "string"
        ? messageOrError
        : messageOrError.message,
    );
    if (messageOrError instanceof Error) {
      this.cause = messageOrError;
    }
    this.name = "ServerError";
  }
}
