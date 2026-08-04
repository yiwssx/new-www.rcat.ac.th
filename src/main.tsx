import { mountClientApp } from "./entry-client";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!(rootElement instanceof HTMLElement)) {
  throw new Error("Application root element was not found");
}

mountClientApp(rootElement);
