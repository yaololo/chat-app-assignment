const React = require("react");

const RouterContext = React.createContext(null);
const RouteContext = React.createContext(null);

const normalizePath = (path) => {
  const normalized = `/${path}`.replace(/\/+/g, "/");
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
};

const entryLocation = (entry) =>
  typeof entry === "string"
    ? { pathname: normalizePath(entry), state: null }
    : {
        pathname: normalizePath(entry.pathname ?? "/"),
        state: entry.state ?? null,
      };

const MemoryRouter = ({ initialEntries = ["/"], children }) => {
  const [location, setLocation] = React.useState(() =>
    entryLocation(initialEntries[0]),
  );
  const navigate = React.useCallback((to, options = {}) => {
    const next =
      typeof to === "string" ? { pathname: to, state: options.state } : to;
    setLocation({
      pathname: normalizePath(next.pathname),
      state: next.state ?? null,
    });
  }, []);

  return React.createElement(
    RouterContext.Provider,
    { value: { location, navigate, params: {} } },
    children,
  );
};

const Route = () => null;
Route.displayName = "Route";

const routeChildren = (children) =>
  React.Children.toArray(children).flatMap((child) =>
    React.isValidElement(child) && child.type === React.Fragment
      ? routeChildren(child.props.children)
      : React.isValidElement(child) && child.type === Route
        ? [child]
        : [],
  );

const matchPath = (pattern, pathname) => {
  if (pattern === "*") return {};
  const patternParts = normalizePath(pattern).split("/").filter(Boolean);
  const pathParts = normalizePath(pathname).split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params = {};
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index];
    const actual = pathParts[index];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual && expected !== "*") {
      return null;
    }
  }
  return params;
};

const findRoute = (routes, pathname, parentPath = "", chain = []) => {
  for (const route of routes) {
    const { path, index, element } = route.props;
    const fullPath = path
      ? normalizePath(path.startsWith("/") ? path : `${parentPath}/${path}`)
      : parentPath || "/";
    const matchedParams = index
      ? normalizePath(pathname) === normalizePath(fullPath)
        ? {}
        : null
      : path
        ? matchPath(fullPath, pathname)
        : {};
    if (matchedParams === null) continue;

    const nextChain = [...chain, { element, params: matchedParams }];
    const children = routeChildren(route.props.children);
    if (children.length) {
      const nested = findRoute(children, pathname, fullPath, nextChain);
      if (nested) return nested;
    }
    if (
      path === "*" ||
      (path
        ? matchedParams !== null
        : normalizePath(pathname) === normalizePath(fullPath))
    ) {
      return { chain: nextChain, params: matchedParams };
    }
  }
  return null;
};

const Routes = ({ children }) => {
  const router = React.useContext(RouterContext);
  if (!router) throw new Error("Routes must be rendered inside MemoryRouter.");
  const match = findRoute(routeChildren(children), router.location.pathname);
  if (!match) return null;

  let outlet = null;
  for (const route of [...match.chain].reverse()) {
    outlet = React.createElement(
      RouteContext.Provider,
      { value: { outlet, params: route.params } },
      route.element,
    );
  }
  return React.createElement(
    RouterContext.Provider,
    { value: { ...router, params: match.params } },
    outlet,
  );
};

const Outlet = () => React.useContext(RouteContext)?.outlet ?? null;

const useLocation = () => {
  const router = React.useContext(RouterContext);
  if (!router) throw new Error("useLocation must be used inside MemoryRouter.");
  return router.location;
};

const useParams = () => React.useContext(RouterContext)?.params ?? {};

const useMatch = (pattern) => {
  const pathname = useLocation().pathname;
  const prefix = normalizePath(pattern.replace(/\/\*$/, ""));
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
    ? { pathname }
    : null;
};

const Navigate = ({ to, replace, state }) => {
  const router = React.useContext(RouterContext);
  React.useEffect(() => {
    router?.navigate(to, { replace, state });
  }, [router, to, replace, state]);
  return null;
};

const Link = ({ to, children, className, ...props }) => {
  const router = React.useContext(RouterContext);
  return React.createElement(
    "a",
    {
      ...props,
      href: to,
      className:
        typeof className === "function"
          ? className({ isActive: false })
          : className,
      onClick: (event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          router?.navigate(to);
        }
      },
    },
    children,
  );
};

const NavLink = ({ to, className, ...props }) => {
  const pathname = useLocation().pathname;
  const isActive = pathname === normalizePath(to);
  return React.createElement(Link, {
    ...props,
    to,
    className:
      typeof className === "function" ? className({ isActive }) : className,
    "aria-current": isActive ? "page" : undefined,
  });
};

module.exports = {
  Link,
  MemoryRouter,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useMatch,
  useParams,
};
