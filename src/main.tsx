import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { projectSettings } from "./config/projectSettings";
import { createAppQueryClient } from "./queryClient";
import { createAppRouter } from "./routes";
import "./styles.css";
import { installBrowserErrorFilters } from "./utils/browserErrorFilters";

installBrowserErrorFilters();
document.documentElement.lang = projectSettings.site.language;
document.title = projectSettings.site.name;

const queryClient = createAppQueryClient();
const router = createAppRouter();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App queryClient={queryClient} router={router} />
  </React.StrictMode>
);
