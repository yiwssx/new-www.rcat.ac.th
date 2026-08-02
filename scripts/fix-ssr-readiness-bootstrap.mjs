import fs from "node:fs";

const file = "scripts/ssr-readiness-bootstrap.mjs";
let source = fs.readFileSync(file, "utf8");
source = source.replace(
  '  return normalized ? `/content/${encodeURIComponent(normalized)}` : "/";',
  '  return normalized ? "/content/" + encodeURIComponent(normalized) : "/";'
);
source = source.replace(
  '  const canonicalPath = input.canonicalPath.startsWith("/") ? input.canonicalPath : `/${input.canonicalPath}`;',
  '  const canonicalPath = input.canonicalPath.startsWith("/") ? input.canonicalPath : "/" + input.canonicalPath;'
);
fs.writeFileSync(file, source);
