import fs from "node:fs";

const file = "src/public/hooks/usePublicPagination.ts";
let source = fs.readFileSync(file, "utf8");
const from = `      void navigate({\n        replace: options.replace,\n        search: (current) => {`;
const to = `      void navigate({\n        to: ".",\n        replace: options.replace,\n        search: (current) => {`;
if (!source.includes(from)) throw new Error("Missing pagination navigate source");
source = source.replace(from, to);
fs.writeFileSync(file, source);
