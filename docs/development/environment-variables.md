# Environment Variables

This Vite app only exposes browser-readable variables whose names start with `VITE_`. Treat every `VITE_` value as public because it can be bundled into client JavaScript.

Do not commit real environment values, deployment URLs for private environments, tokens, passwords, cookies, service account data, or any other secret material. Use local `.env` files and deployment environment settings with placeholders in documentation.

## Public Variables

| Variable                         | Purpose                                                                                                                                    | Required                                                                                                   | Production notes                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_GOOGLE_APPS_SCRIPT_URL`    | Google Apps Script web app endpoint used by the CMS API adapter.                                                                           | Required in production. Optional for local development when intentionally using project settings or tests. | Must be configured in production. An empty or missing value can block production auth and CMS data access. Use a deployed Apps Script web app URL, for example `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`. |
| `VITE_PUBLIC_SITE_URL`           | Canonical public site URL used for generated links and metadata.                                                                           | Optional.                                                                                                  | Set to the deployed public website origin when it differs from the checked-in project setting, for example `https://www.example.ac.th`.                                                                                      |
| `VITE_CMS_SITE_NAME`             | Public CMS/site display name override.                                                                                                     | Optional.                                                                                                  | Set only when the deployed environment needs a name different from `src/config/project-settings.json`.                                                                                                                       |
| `VITE_PUBLIC_ANALYTICS_STRATEGY` | Selects the public analytics loader strategy used by `src/shared/utils/publicAnalytics.ts`. Supported values are `gtm`, `gtag`, or `both`. | Optional.                                                                                                  | Omit to use the built-in default strategy. Set only when changing the analytics loader mode for a deployment.                                                                                                                |

## Example

```env
VITE_GOOGLE_APPS_SCRIPT_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
VITE_PUBLIC_SITE_URL="https://www.example.ac.th"
VITE_CMS_SITE_NAME="Example College"
VITE_PUBLIC_ANALYTICS_STRATEGY="gtm"
```

Keep real production values in the hosting provider environment settings. The Apps Script URL is not a secret, but it is production-critical configuration and should be reviewed before release.
