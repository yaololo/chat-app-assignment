import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auth } from "./auth/index.js";
import { requireUser } from "./middleware/require-user-middleware.js";
import { chat } from "./chat/index.js";

export const app = express();
const clientDistPath = fileURLToPath(new URL("../dist/", import.meta.url));

// Should not be used in production, but useful for local development to avoid CORS issues when the client is served from a different origin.
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "16kb" }));

// Keep explicitly public auth endpoints first; all remaining API routes require a valid user.
app.use("/api/auth", auth);
app.use("/api", requireUser);
app.use("/api/chat", chat);
app.use("/api", (_req, res) => { res.status(404).json({ error: "API route not found." }); });

app.use(((error, _req, res, _next) => {
  if (error instanceof SyntaxError) { res.status(400).json({ error: "Invalid JSON." }); return; }
  console.error("API request failed:", error);
  res.status(500).json({ error: "Unable to complete your request. Please try again." });
}) as express.ErrorRequestHandler);

app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (
    req.method !== "GET" ||
    path.extname(req.path) !== "" ||
    !req.accepts("html")
  ) {
    next();
    return;
  }

  res.sendFile(path.join(clientDistPath, "index.html"), (error) => {
    if (error) {
      next(error);
    }
  });
});
