import "dotenv/config";
import { createServer } from "node:http";
import { attachRealtime } from "./realtime/socket.js";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const httpServer = createServer(app);

attachRealtime(httpServer);

httpServer.listen(port, () => {
  console.info(`Server listening on port ${port}`);
});
