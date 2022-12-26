import { ServerError } from "./error/server_error.ts";

export interface Context {
  match: URLPatternResult;
  request: Request;
}

export type RouteHandler = (ctx: Context) => Response | Promise<Response>;

export interface Router {
  (request: Request): Promise<Response>;

  addRoute(method: string, path: string, fn: RouteHandler): void;
  addRoute(method: string, pattern: URLPatternInput, fn: RouteHandler): void;
  addRoute(method: string, pattern: URLPattern, fn: RouteHandler): void;
}

export interface CreateRouterOptions {
  errorHandler?: (error: Error) => Response | Promise<Response>;
}

const defaultErrorHandler = (error: Error) => {
  if (error instanceof ServerError) {
    return new Response(error.message, { status: error.status });
  }
  return new Response(error.message, { status: 500 });
};

export function createRouter(options: CreateRouterOptions = {}): Router {
  const routes = new Map<URLPattern, Map<string, RouteHandler>>();

  const errorHandler = options.errorHandler ?? defaultErrorHandler;

  async function route(request: Request): Promise<Response> {
    for (const [pattern, group] of routes) {
      const fn = group.get(request.method.toLowerCase());
      if (!fn) {
        continue;
      }
      const match = pattern.exec(request.url);
      if (match) {
        try {
          return await fn({ match, request });
        } catch (e) {
          return errorHandler(e);
        }
      }
    }
    return errorHandler(new ServerError("Not Found", 404));
  }

  return Object.assign(route, {
    addRoute(
      method: string,
      pathOrPattern: string | URLPatternInput | URLPattern,
      fn: RouteHandler,
    ) {
      let pattern: URLPattern;
      if (typeof pathOrPattern === "string") {
        pattern = new URLPattern({ pathname: pathOrPattern });
      } else if (pathOrPattern instanceof URLPattern) {
        pattern = pathOrPattern;
      } else {
        pattern = new URLPattern(pathOrPattern);
      }

      let routeGroup = routes.get(pattern);
      if (!routeGroup) {
        routeGroup = new Map<string, RouteHandler>();
        routes.set(pattern, routeGroup);
      }
      routeGroup.set(method.trim().toLowerCase(), fn);
    },
  });
}
