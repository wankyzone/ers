export class ApiError extends Error {
  status: number;
  statusText: string;
  body?: unknown;
  code?: string;

  constructor(
    message: string,
    options: {
      status: number;
      statusText: string;
      body?: unknown;
      code?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.body = options.body;
    this.code = options.code;

    if (options.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
