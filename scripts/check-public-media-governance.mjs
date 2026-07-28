import process from "node:process";
import { runPublicMediaGovernance } from "./public-media-governance.mjs";

const violations = runPublicMediaGovernance(process.cwd());

if (violations.length > 0) {
  console.error("Public media governance failed:");

  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }

  process.exitCode = 1;
} else {
  console.log("Public media governance passed.");
  console.log("- Public img and iframe rendering is limited to approved owners.");
  console.log("- High image priority is limited to approved critical-media paths.");
  console.log("- Responsive width policies are sorted, unique, positive, and bounded at w1600.");
  console.log("- Small-image policies include sub-w640 candidates and avoid w1600 fallbacks.");
  console.log("- Google Drive thumbnail generation remains centralized.");
}
