import React from "react";
import { createRoot } from "react-dom/client";
import { JobOperationsConsole } from "../../../app/job-operations/job-operations-console";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <JobOperationsConsole />,
);
