import process from "node:process";
import { runPublicLayoutStabilityGovernance } from "./public-layout-stability-governance.mjs";

const violations = runPublicLayoutStabilityGovernance(process.cwd());

if (violations.length > 0) {
  console.error("Public layout stability governance failed:");

  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }

  process.exitCode = 1;
} else {
  console.log("Public layout stability governance passed.");
  console.log("- Public routes retain one persistent shell owner.");
  console.log("- Footer Directory loading, ready, and empty states retain stable identifiers.");
  console.log("- Public loading variants retain structured, non-focusable geometry.");
  console.log("- Listing background refetches retain ready content.");
  console.log("- Deterministic browser CLS budgets remain below 0.1.");
}
