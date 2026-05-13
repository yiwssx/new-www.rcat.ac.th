function normalizePathname(pathname: string) {
  const [pathWithoutQuery] = pathname.split(/[?#]/u);

  if (!pathWithoutQuery || pathWithoutQuery === "/") {
    return "/";
  }

  return pathWithoutQuery.endsWith("/") ? pathWithoutQuery.slice(0, -1) : pathWithoutQuery;
}

export function isPublicAnalyticsPath(pathname: string) {
  const pathnameWithoutTrailingSlash = normalizePathname(pathname);

  return (
    pathnameWithoutTrailingSlash !== "/login" &&
    pathnameWithoutTrailingSlash !== "/admin" &&
    !pathnameWithoutTrailingSlash.startsWith("/admin/")
  );
}
