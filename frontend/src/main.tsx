import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { setupClerkDesktopFix } from "./utils/clerkDesktopFix";

// Setup workaround for Clerk dev browser authentication in desktop apps
setupClerkDesktopFix();

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
