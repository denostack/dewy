import { MiddlewareHandler } from "../router.ts";

const DEFAULT_METHODS = new Set([
  "GET",
  "HEAD",
  "PUT",
  "PATCH",
  "POST",
  "DELETE",
]);

export interface CorsOptions {
  /**
   * if set true, use next() response, if false, use 204
   * @default false
   */
  preflightContinue?: boolean | null;
  /**
   * Access-Control-Allow-Origin
   * @default "*"
   */
  allowOrigin?: string[] | null;
  /**
   * Access-Control-Allow-Methods
   * @default "GET,HEAD,PUT,PATCH,POST,DELETE"
   */
  allowMethods?: string[] | null;
  /**
   * Access-Control-Allow-Credentials
   * @default false
   */
  allowCredentials?: boolean;
  /**
   * Access-Control-Allow-Headers
   * @default response Access-Control-Request-Headers
   */
  allowHeaders?: string[] | null;
  /**
   * Access-Control-Expose-Headers
   * @default (no header)
   */
  exposeHeaders?: string[] | null;
  /**
   * Access-Control-Max-Age (in seconds)
   * @default (no header)
   */
  maxAge?: number | string | null;
  /**
   * Access-Control-Allow-Private-Network
   * @default false
   */
  allowPrivateNetwork?: boolean | null;
}

export function cors(
  options: CorsOptions = {},
): MiddlewareHandler {
  const allowOrigin = options.allowOrigin ? new Set(options.allowOrigin) : null;
  const allowMethods = options.allowMethods
    ? new Set(options.allowMethods)
    : DEFAULT_METHODS;

  return async ({ request }, next) => {
    const requestMethod = request.method.toUpperCase();
    const requestOrigin = request.headers.get("Origin") ?? "";

    if (requestMethod === "OPTIONS") {
      // not preflight
      if (!request.headers.get("Access-Control-Request-Method")) {
        return next();
      }

      const response = options.preflightContinue
        ? await next()
        : new Response(null, {
          status: 204,
          headers: { "Content-Length": "0" },
        });

      applyOrigin(response, allowOrigin, requestOrigin);
      applyCredentials(response, options, requestOrigin);
      applyMethods(response, allowMethods);
      applyHeaders(response, options, request);
      applyMaxAge(response, options);
      applyExposeHeaders(response, options);
      applyAllowPrivateNetwork(response, options, request);

      return response;
    }
    const response = await next();

    applyOrigin(response, allowOrigin, requestOrigin);
    applyCredentials(response, options, requestOrigin);
    applyExposeHeaders(response, options);
    return response;
  };
}

/** @internal */
function applyOrigin(
  res: Response,
  allowOrigin: Set<string> | null,
  origin: string,
) {
  if (!allowOrigin) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    return;
  }

  if (allowOrigin.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    // ref. https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#access-control-allow-origin
    applyVaryAppend(res, "Origin");
  }
}

/** @internal */
function applyCredentials(
  res: Response,
  options: CorsOptions,
  requestOrigin: string,
) {
  if (options.allowCredentials) {
    if (res.headers.get("Access-Control-Allow-Origin") === "*") {
      res.headers.set("Access-Control-Allow-Origin", requestOrigin);
    }
    res.headers.set("Access-Control-Allow-Credentials", "true");
  }
}

function applyMethods(res: Response, allowMethods: Set<string>) {
  res.headers.set(
    "Access-Control-Allow-Methods",
    Array.from(allowMethods).join(","),
  );
}

/** @internal */
function applyHeaders(
  res: Response,
  options: CorsOptions,
  req: Request,
) {
  const requestHeaders = req.headers.get("Access-Control-Request-Headers");
  if (!requestHeaders) {
    return;
  }
  if (!options.allowHeaders) {
    applyVaryAppend(res, "Access-Control-Request-Headers");
    res.headers.set("Access-Control-Allow-Headers", requestHeaders);
    return;
  }
  res.headers.set(
    "Access-Control-Allow-Headers",
    options.allowHeaders.join(","),
  );
}

/** @internal */
function applyExposeHeaders(res: Response, options: CorsOptions) {
  if (options.exposeHeaders) {
    res.headers.set(
      "Access-Control-Expose-Headers",
      options.exposeHeaders.join(","),
    );
  }
}

/** @internal */
function applyMaxAge(res: Response, options: CorsOptions) {
  if (options.maxAge) {
    res.headers.set("Access-Control-Max-Age", `${options.maxAge}`);
  }
}

/** @internal */
function applyAllowPrivateNetwork(
  res: Response,
  options: CorsOptions,
  req: Request,
) {
  if (
    options.allowPrivateNetwork &&
    req.headers.get("Access-Control-Request-Private-Network")
  ) {
    res.headers.set("Access-Control-Allow-Private-Network", "true");
  }
}

/** @internal */
function applyVaryAppend(res: Response, value: string) {
  const existsVary = res.headers.get("Vary");
  if (existsVary) {
    res.headers.set("Vary", `${existsVary}, ${value}`);
  } else {
    res.headers.set("Vary", value);
  }
}
