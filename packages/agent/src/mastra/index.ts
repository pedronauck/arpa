import { Mastra } from "@mastra/core";
import { LibSQLStore } from "@mastra/libsql";
import { PinoLogger } from "@mastra/loggers";
import { codeReviewWorkflow } from "./workflows/codereview";

export const mastra = new Mastra({
  workflows: {
    "code-review-workflow": codeReviewWorkflow,
  },
  agents: {},
  storage: new LibSQLStore({
    // Using /tmp directory for database storage to avoid cluttering project directory
    // This allows workflow snapshots to persist between suspend/resume
    url: "file:/tmp/temp-mastra.db",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
