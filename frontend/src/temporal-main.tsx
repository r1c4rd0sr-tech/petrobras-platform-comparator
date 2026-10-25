import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Temporal from "./Temporal";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Temporal />
  </StrictMode>
);
