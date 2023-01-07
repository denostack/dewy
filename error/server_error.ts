export class ServerError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ServerError";
  }
}
