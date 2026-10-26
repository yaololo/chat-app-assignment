import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";

export const app = express();
const clientDistPath = fileURLToPath(new URL("../dist/", import.meta.url));

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({ status: "unavailable" });
  }
});

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
