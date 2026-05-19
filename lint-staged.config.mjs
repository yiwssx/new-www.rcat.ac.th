export default {
  // Lint and format JS/TS files
  "**/*.{js,ts,tsx,mjs}": ["eslint --fix", "prettier --write"],
  // Format JSON, Markdown, CSS, HTML, YAML
  "**/*.{json,md,css,html,yaml,yml}": ["prettier --write"]
};
