import { RouteNotFoundError } from "./error/route_not_found_error.ts";
import { ServerError } from "./error/server_error.ts";

export type ErrorHandler = (error: unknown) => Response | Promise<Response>;

export interface RouterOptions {
  errorHandler?: ErrorHandler;
}

export interface Context {
  match: URLPatternResult;
  request: Request;
}

export type PathPattern = string | URLPatternInput | URLPattern;

export type RouteHandler = (ctx: Context) => Response | Promise<Response>;

export type MiddlewareNextHandler = (
  ctx?: Context,
) => Response | Promise<Response>;

export type MiddlewareHandler = (
  ctx: Context,
  next: MiddlewareNextHandler,
) => Response | Promise<Response>;

export interface RouteParams {
  method: string | string[];
  pattern: PathPattern;
  middleware?: MiddlewareHandler | MiddlewareHandler[] | null;
}

export interface GroupParams {
  prefix?: string | null;
  domain?: string | string[] | null;
  middleware?: MiddlewareHandler | MiddlewareHandler[] | null;
}

/** @internal */
interface Group {
  prefix: string;
  domains: string[];
  middlewares: MiddlewareHandler[];
}

/** @internal */
function normalizePath(path: string) {
  return "/" + path.replace(/^\/+|\/+$/g, "");
}

/** @internal */
function joinPath(path: string, otherPath: string) {
  return normalizePath(
    path.replace(/\/+$/g, "") + "/" + otherPath.replace(/^\/+/g, ""),
  );
}

/** @internal */
function normalizePatterns(
  group: Group | null,
  pattern: PathPattern,
) {
  const prefix = group?.prefix ?? null;
  const domains: (string | null)[] = group?.domains ?? [];
  if (domains.length === 0) {
    domains.push(null);
  }
  return domains.map((domain) => {
    if (prefix) {
      if (typeof pattern === "string") {
        return new URLPattern({
          ...domain ? { hostname: domain } : {},
          pathname: joinPath(prefix, pattern),
        });
      }
      return new URLPattern({
        ...pattern,
        ...domain ? { hostname: domain } : {},
        pathname: joinPath(prefix, pattern.pathname ?? ""),
      });
    }

    if (typeof pattern === "string") {
      return new URLPattern({
        ...domain ? { hostname: domain } : {},
        pathname: normalizePath(pattern),
      });
    }
    if (domain) {
      return new URLPattern({
        ...pattern,
        hostname: domain,
      });
    }
    if (pattern instanceof URLPattern) {
      return pattern;
    }
    return new URLPattern(pattern);
  });
}

const ALL_METHOD = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"];

const defaultErrorHandler = (error: unknown) => {
  if (error instanceof ServerError) {
    return new Response(error.message, error.init);
  }
  if (error instanceof RouteNotFoundError) {
    return new Response("Not Found", { status: 404 });
  }
  return new Response("Internal Server Error", {
    status: 500,
  });
};

export class Router {
  _groups: Group[] = [];
  _definedMiddlewares: MiddlewareHandler[] = [];
  _routes = new Map<
    string,
    [
      pattern: URLPattern,
      handler: RouteHandler,
      middlewares: MiddlewareHandler[],
    ][]
  >();

  _errorHandler: ErrorHandler;

  constructor(options: RouterOptions = {}) {
    this._errorHandler = options.errorHandler ?? defaultErrorHandler;
  }

  use(...middlewares: MiddlewareHandler[]) {
    this._definedMiddlewares.push(...middlewares);
  }

  group({ domain, prefix, middleware }: GroupParams, handler: () => void) {
    const currentDomains = domain
      ? (Array.isArray(domain) ? domain : [domain])
      : [];
    const currentMiddlewares = middleware
      ? (Array.isArray(middleware) ? middleware : [middleware])
      : [];

    const lastGroup = this._groups.at(-1) ?? null;
    const group: Group = {
      domains: (lastGroup?.domains ?? []).concat(currentDomains),
      prefix: joinPath(lastGroup?.prefix ?? "", prefix ?? ""),
      middlewares: (lastGroup?.middlewares ?? []).concat(currentMiddlewares),
    };
    this._groups.push(group);
    handler();
    this._groups.pop();
  }

  get(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["GET", "HEAD"], pattern }, fn);
  }

  head(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["HEAD"], pattern }, fn);
  }

  post(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["POST"], pattern }, fn);
  }

  put(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["PUT"], pattern }, fn);
  }

  del(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["DELETE"], pattern }, fn);
  }

  options(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["OPTIONS"], pattern }, fn);
  }

  patch(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ["PATCH"], pattern }, fn);
  }

  all(pattern: PathPattern, fn: RouteHandler) {
    return this.addRoute({ method: ALL_METHOD, pattern }, fn);
  }

  addRoute(route: RouteParams, fn: RouteHandler) {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const middlewares = route.middleware
      ? (Array.isArray(route.middleware)
        ? route.middleware
        : [route.middleware])
      : [];

    for (let method of methods) {
      method = method.trim().toUpperCase();
      let routeGroup = this._routes.get(method);
      if (!routeGroup) {
        routeGroup = [];
        this._routes.set(method, routeGroup);
      }

      const group = this._groups.at(-1) ?? null;
      for (const pattern of normalizePatterns(group, route.pattern)) {
        routeGroup.push([pattern, fn, [
          ...this._definedMiddlewares,
          ...group?.middlewares ?? [],
          ...middlewares,
        ]]);
      }
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

    try {
      const routes = this._routes.get(request.method.toUpperCase()) ?? [];
      for (const [pattern, fn, middlewares] of routes) {
        const match = pattern.exec(request.url);
        if (match) {
          return await execute(middlewares, fn, { match, request });
        }
      }
      throw new RouteNotFoundError("Not Found");
    } catch (e: unknown) {
      return await this._errorHandler(e);
    }
  }
}
