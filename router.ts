import { ServerError } from "./error/server_error.ts";

export interface Context {
  match: URLPatternResult;
  request: Request;
}

export type RouteHandler = (ctx: Context) => Response | Promise<Response>;

export type MiddlewareHandler = (
  ctx: Context,
  next: (ctx?: Context) => Response | Promise<Response>,
) => Response | Promise<Response>;

export interface RouteParams {
  methods: string[];
  pattern: URLPattern;
  middlewares?: MiddlewareHandler[];
  fn: RouteHandler;
}

function pattern(pathOrPattern: string | URLPatternInput | URLPattern) {
  if (typeof pathOrPattern === "string") {
    return new URLPattern({ pathname: pathOrPattern });
  }
  if (pathOrPattern instanceof URLPattern) {
    return pathOrPattern;
  }
  return new URLPattern(pathOrPattern);
}

export class Router {
  definedMiddlewares: MiddlewareHandler[] = [];
  routes = new Map<
    string,
    [
      pattern: URLPattern,
      handler: RouteHandler,
      middlewares: MiddlewareHandler[],
    ][]
  >();

  use(...middlewares: MiddlewareHandler[]) {
    this.definedMiddlewares.push(...middlewares);
  }

  get(path: string, fn: RouteHandler): void;
  get(pattern: URLPatternInput, fn: RouteHandler): void;
  get(pattern: URLPattern, fn: RouteHandler): void;
  get(pathOrPattern: string | URLPatternInput | URLPattern, fn: RouteHandler) {
    this.addRoute({
      methods: ["get", "head"],
      pattern: pattern(pathOrPattern),
      fn,
    });
  }

  head(path: string, fn: RouteHandler): void;
  head(pattern: URLPatternInput, fn: RouteHandler): void;
  head(pattern: URLPattern, fn: RouteHandler): void;
  head(pathOrPattern: string | URLPatternInput | URLPattern, fn: RouteHandler) {
    this.addRoute({ methods: ["head"], pattern: pattern(pathOrPattern), fn });
  }

  post(path: string, fn: RouteHandler): void;
  post(pattern: URLPatternInput, fn: RouteHandler): void;
  post(pattern: URLPattern, fn: RouteHandler): void;
  post(pathOrPattern: string | URLPatternInput | URLPattern, fn: RouteHandler) {
    this.addRoute({ methods: ["post"], pattern: pattern(pathOrPattern), fn });
  }

  put(path: string, fn: RouteHandler): void;
  put(pattern: URLPatternInput, fn: RouteHandler): void;
  put(pattern: URLPattern, fn: RouteHandler): void;
  put(pathOrPattern: string | URLPatternInput | URLPattern, fn: RouteHandler) {
    this.addRoute({ methods: ["put"], pattern: pattern(pathOrPattern), fn });
  }

  delete(path: string, fn: RouteHandler): void;
  delete(pattern: URLPatternInput, fn: RouteHandler): void;
  delete(pattern: URLPattern, fn: RouteHandler): void;
  delete(
    pathOrPattern: string | URLPatternInput | URLPattern,
    fn: RouteHandler,
  ) {
    this.addRoute({ methods: ["delete"], pattern: pattern(pathOrPattern), fn });
  }

  options(path: string, fn: RouteHandler): void;
  options(pattern: URLPatternInput, fn: RouteHandler): void;
  options(pattern: URLPattern, fn: RouteHandler): void;
  options(
    pathOrPattern: string | URLPatternInput | URLPattern,
    fn: RouteHandler,
  ) {
    this.addRoute({
      methods: ["options"],
      pattern: pattern(pathOrPattern),
      fn,
    });
  }

  patch(path: string, fn: RouteHandler): void;
  patch(pattern: URLPatternInput, fn: RouteHandler): void;
  patch(pattern: URLPattern, fn: RouteHandler): void;
  patch(
    pathOrPattern: string | URLPatternInput | URLPattern,
    fn: RouteHandler,
  ) {
    this.addRoute({ methods: ["patch"], pattern: pattern(pathOrPattern), fn });
  }

  any(path: string, fn: RouteHandler): void;
  any(pattern: URLPatternInput, fn: RouteHandler): void;
  any(pattern: URLPattern, fn: RouteHandler): void;
  any(
    pathOrPattern: string | URLPatternInput | URLPattern,
    fn: RouteHandler,
  ) {
    this.addRoute({
      methods: ["get", "head", "post", "put", "delete", "options", "patch"],
      pattern: pattern(pathOrPattern),
      fn,
    });
  }

  addRoute({ methods, pattern, fn, middlewares }: RouteParams) {
    for (let method of methods) {
      method = method.trim().toLowerCase();
      let routeGroup = this.routes.get(method);
      if (!routeGroup) {
        routeGroup = [];
        this.routes.set(method, routeGroup);
      }
      routeGroup.push([pattern, fn, [
        ...this.definedMiddlewares,
        ...middlewares ?? [],
      ]]);
    }
  }

  async dispatch(request: Request): Promise<Response> {
    async function execute(
      middlewares: MiddlewareHandler[],
      fn: RouteHandler,
      ctx: Context,
    ): Promise<Response> {
      if (middlewares.length === 0) {
        return await fn(ctx);
      }
      const [middleware, ...nextMiddlewares] = middlewares;
      return await middleware(ctx, async (nextCtx) => {
        return await execute(nextMiddlewares, fn, nextCtx ?? ctx);
      });
    }

    const routes = this.routes.get(request.method.toLowerCase()) ?? [];
    for (const [pattern, fn, middlewares] of routes) {
      const match = pattern.exec(request.url);
      if (match) {
        return await execute(middlewares, fn, { match, request });
      }
    }
    throw new ServerError("Not Found", 404);
  }
}

export interface CreateRouterOptions {
  errorHandler?: (error: Error) => Response | Promise<Response>;
}
