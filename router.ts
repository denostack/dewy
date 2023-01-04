import { ServerError } from "./error/server_error.ts";

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
  next?: MiddlewareNextHandler,
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

interface InternalGroup {
  prefix: string;
  domains: string[];
  middlewares: MiddlewareHandler[];
}

function normalizePath(path: string) {
  return "/" + path.replace(/^\/+|\/+$/g, "");
}

function joinPath(path: string, otherPath: string) {
  return normalizePath(
    path.replace(/\/+$/g, "") + "/" + otherPath.replace(/^\/+/g, ""),
  );
}

function normalizePatterns(
  group: InternalGroup | null,
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

const allMethods = ["get", "head", "post", "put", "delete", "options", "patch"];
const emptyRouteHandler = () => new Response();

export class Router {
  groups: InternalGroup[] = [];
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

  group({ domain, prefix, middleware }: GroupParams, handler: () => void) {
    const currentDomains = domain
      ? (Array.isArray(domain) ? domain : [domain])
      : [];
    const currentMiddlewares = middleware
      ? (Array.isArray(middleware) ? middleware : [middleware])
      : [];

    const lastGroup = this.groups.at(-1) ?? null;
    const group: InternalGroup = {
      domains: (lastGroup?.domains ?? []).concat(currentDomains),
      prefix: joinPath(lastGroup?.prefix ?? "", prefix ?? ""),
      middlewares: (lastGroup?.middlewares ?? []).concat(currentMiddlewares),
    };
    this.groups.push(group);
    handler();
    this.groups.pop();
  }

  get(path: string, fn: RouteHandler): void;
  get(pattern: URLPatternInput, fn: RouteHandler): void;
  get(pattern: URLPattern, fn: RouteHandler): void;
  get(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["get", "head"], pattern }, ...fns);
  }

  head(path: string, fn: RouteHandler): void;
  head(pattern: URLPatternInput, fn: RouteHandler): void;
  head(pattern: URLPattern, fn: RouteHandler): void;
  head(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["head"], pattern }, ...fns);
  }

  post(path: string, fn: RouteHandler): void;
  post(pattern: URLPatternInput, fn: RouteHandler): void;
  post(pattern: URLPattern, fn: RouteHandler): void;
  post(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["post"], pattern }, ...fns);
  }

  put(path: string, fn: RouteHandler): void;
  put(pattern: URLPatternInput, fn: RouteHandler): void;
  put(pattern: URLPattern, fn: RouteHandler): void;
  put(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["put"], pattern }, ...fns);
  }

  del(path: string, fn: RouteHandler): void;
  del(pattern: URLPatternInput, fn: RouteHandler): void;
  del(pattern: URLPattern, fn: RouteHandler): void;
  del(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["delete"], pattern }, ...fns);
  }

  options(path: string, fn: RouteHandler): void;
  options(pattern: URLPatternInput, fn: RouteHandler): void;
  options(pattern: URLPattern, fn: RouteHandler): void;
  options(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["options"], pattern }, ...fns);
  }

  patch(path: string, fn: RouteHandler): void;
  patch(pattern: URLPatternInput, fn: RouteHandler): void;
  patch(pattern: URLPattern, fn: RouteHandler): void;
  patch(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: ["patch"], pattern }, ...fns);
  }

  all(path: string, fn: RouteHandler): void;
  all(pattern: URLPatternInput, fn: RouteHandler): void;
  all(pattern: URLPattern, fn: RouteHandler): void;
  all(pattern: PathPattern, fn: RouteHandler) {
    this.addRoute({ method: allMethods, pattern }, ...fns);
  }

  addRoute(route: RouteParams, fn: RouteHandler) {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const middlewares = fns.slice(0, -1);

    for (let method of methods) {
      method = method.trim().toLowerCase();
      let routeGroup = this.routes.get(method);
      if (!routeGroup) {
        routeGroup = [];
        this.routes.set(method, routeGroup);
      }

      const group = this.groups.at(-1) ?? null;
      for (const pattern of normalizePatterns(group, route.pattern)) {
        routeGroup.push([pattern, fn, [
          ...this.definedMiddlewares,
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
