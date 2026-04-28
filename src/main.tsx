import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { projectSettings } from "./config/projectSettings";
import "./styles.css";
import { installBrowserErrorFilters } from "./utils/browserErrorFilters";

installBrowserErrorFilters();
document.documentElement.lang = projectSettings.site.language;
document.title = projectSettings.site.name;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
