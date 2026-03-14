import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { reposRouter } from "./routes/repos.js";
import { agentRouter } from "./routes/agent.js";
import { kdbRouter } from "./routes/kdb.js";
import { adminRouter } from "./routes/admin.js";
import { workiqRouter } from "./routes/workiq.js";
import { agentsRouter } from "./routes/agents.js";
import { providersRouter } from "./routes/providers.js";
import { atlassianRouter } from "./routes/atlassian.js";
import { atlassianDownloadRouter } from "./routes/atlassian-download.js";
import { seedAgents } from "./lib/seed.js";

dotenv.config({ override: true });

// Allow self-signed SSL certs for *.agile.bns servers when enabled
if (process.env.ALLOW_SELF_SIGNED_SSL === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Seed agents from YAML files on first run
seedAgents();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.use("/api/repos", reposRouter);
app.use("/api/agent", agentRouter);
app.use("/api/agents", agentsRouter);
app.use("/api/kdb", kdbRouter);
app.use("/api/admin", adminRouter);
app.use("/api/workiq", workiqRouter);
app.use("/api/providers", providersRouter);
app.use("/api/atlassian", atlassianRouter);
app.use("/api/atlassian", atlassianDownloadRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Web-Spec backend running on http://localhost:${PORT}`);
});
