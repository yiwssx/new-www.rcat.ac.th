import { readFileSync, writeFileSync } from "node:fs";

const path = "src/test/publicDataDrivenPages.test.tsx";
let source = readFileSync(path, "utf8");

const replacements = [
  ['window.history.pushState({}, "", "/achievements?page=2");', 'routerMocks.search = { page: 2 };'],
  ['window.history.pushState({}, "", "/documents?page=2");', 'routerMocks.search = { page: 2 };'],
  ['window.history.pushState({}, "", "/documents?page=invalid");', 'routerMocks.search = { page: "invalid" };'],
  ['window.history.pushState({}, "", "/announcements?tag=รับสมัคร");', 'routerMocks.search = { tag: "รับสมัคร" };']
];

for (const [from, to] of replacements) {
  const firstIndex = source.indexOf(from);
  const lastIndex = source.lastIndexOf(from);

  if (firstIndex < 0 || firstIndex !== lastIndex) {
    throw new Error(`Expected exactly one occurrence of ${JSON.stringify(from)}`);
  }

  source = source.replace(from, to);
}

writeFileSync(path, source);
