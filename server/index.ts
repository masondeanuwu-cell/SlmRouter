import { promises as fs } from "fs";
import dotenv from 'dotenv';

// load .env from project root (if present)
dotenv.config();

async function writeUptimeLog(uptime: string) {
  const filePath = "./start-time.log";
  try {
    await fs.writeFile(filePath, uptime, "utf-8");
    console.log("Uptime appended!");
  } catch (err) {
    console.error("Failed to write uptime:", err);
  }
}
writeUptimeLog(new Date().toISOString())
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.ts";
import { setupVite, serveStatic, log } from "./vite.ts";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(express.raw({ type: "*/*", limit: "50mb" })); // Support binary uploads

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  res.setHeader("ngrok-skip-browser-warning", "blankcom");

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});
var clients = [];
(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });
  // Store all connected SSE clients


  app.get("/api/logs", (req, res) => {
    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Add client
    clients.push(res);

    // Remove client on close
    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
  });

  // Helper function to send logs to all clients
  function sendLog(message) {
    for (const client of clients) {
      client.write(`data: ${message}\n\n`);
    }
  }

  // Override console.log to also broadcast logs
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.join(" ");
    originalLog(message);
    sendLog(message);
  };
  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
