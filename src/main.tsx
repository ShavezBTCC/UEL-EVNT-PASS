import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { startSyncListener } from "./lib/sync";
import "./index.css";

registerSW({ immediate: true });
startSyncListener();

// Ask the browser not to evict our IndexedDB data under storage pressure.
void navigator.storage?.persist?.();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
