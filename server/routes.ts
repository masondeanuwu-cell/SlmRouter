import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import {
  insertRouterConfigSchema,
  insertRequestLogSchema,
  loginSchema,
  changePasswordSchema,
} from "@shared/schema";
import { createHash } from "crypto";
import passwords from "./password.json";
import { read, readFileSync, writeFileSync } from "fs";
import fs from "fs";
import { networkInterfaces } from "os";
import { exec } from "child_process";
import path from "path";
import users from "./user-logins.json";
import components from "../components.json";

function runCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(stderr || error.message);
      } else {
        resolve(stdout || stderr);
      }
    });
  });
}

//to base64 function
function toBase64(data: string) {
  return Buffer.from(data).toString("base64");
}

//from base64 function
function fromBase64(data: string) {
  return Buffer.from(data, "base64").toString("utf-8");
}

//sha256 function
function sha256Hash(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

// Function to grab local IP
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
}

const serverIP = getLocalIP() || "Unable to determine local IP, check logs";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  // Store password in memory (in production, you'd use a secure database)
  let dashboardPassword = passwords.ADMIN.password;

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { username, password } = validatedData;
      const passwordHash = sha256Hash(password);
      console.log("Attempted admin login for user:", username + " <" + password + ">");

      // Loop through all stored users
      const found = passwords[username]?.password === passwordHash;

      if (found) {
        res.json({ success: true, message: "Login successful" });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Invalid request", error: error.message });
    }
  });

  app.post("/api/auth/user-login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const { username, password } = validatedData;
      const passwordHash = sha256Hash(password);
      console.log("Attempted login for user:", username + " <" + password + ">");
      // Loop through all stored users
      const found = users[username]?.password === passwordHash;

      if (found) {
        res.json({ success: true, message: "Login successful" });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Invalid request", error: error.message });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);

      // Verify current password
      if (sha256Hash(validatedData.currentPassword) !== dashboardPassword) {
        return res
          .status(401)
          .json({ message: "Current password is incorrect" });
      }

      // Update password
      dashboardPassword = sha256Hash(validatedData.newPassword);
      var raw = readFileSync("server/password.json", "utf-8");
      var data = JSON.parse(raw);
      data.password = dashboardPassword;
      writeFileSync("server/password.json", JSON.stringify(data, null, 2));
      res.json({ success: true, message: "Password changed successfully" });
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Invalid request", error: error.message });
    }
  });

  // Router configuration endpoints
  app.post("/api/router-config", async (req, res) => {
    try {
      const validatedData = insertRouterConfigSchema.parse(req.body);
      const config = await storage.createRouterConfig(validatedData);
      res.json(config);
    } catch (error: any) {
      res
        .status(400)
        .json({ message: "Invalid proxy configuration", error: error.message });
    }
  });
  app.get("/api/server-ip", (req, res) => {
    res.json({ ip: serverIP });
  });
  app.get("/api/router-config", async (req, res) => {
    try {
      const config = await storage.getLatestRouterConfig();
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to get proxy configuration",
        error: error.message,
      });
    }
  });

  // Utility: validate input password against stored hash
  function validatePassword(inputPassword): boolean {
    try {
      const filePath = "sever/password.json";
      const fileData = fs.readFileSync(filePath, "utf-8");
      const data = JSON.parse(fileData);
      const storedHash = data.password;

      const inputHash = sha256Hash(inputPassword);
      return inputHash === storedHash;
    } catch (err) {
      console.error("Password validation error:", err);
      return false;
    }
  }
  function formatUptime(ms: number): string {
    if (ms < 0 || isNaN(ms)) return "00:00:00";

    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let result = "";
    if (days > 0) {
      result += `${days} Days & `;
    }
    result += `${hours.toString().padStart(2, "0")}H:` +
      `${minutes.toString().padStart(2, "0")}M:` +
      `${seconds.toString().padStart(2, "0")}S`;
    return result;
  }

  app.get("/api/uptime", async (req, res) => {
    const filePath = "start-time.log";
    const fileData = fs.readFileSync(filePath, "utf-8");
    const lines = fileData.split("\n");
    const startTime = new Date(lines[0]).getTime();
    const uptimeMs = Date.now() - startTime;

    res.json({ uptime: formatUptime(uptimeMs) });
  });

  app.post("/api/execute", async (req, res) => {
    try {
      const { command, password } = req.body;

      if (!command || !password) {
        return res.status(400).json({
          success: false,
          error: "Missing command or password",
        });
      }

      if (sha256Hash(password).toString() !== dashboardPassword.toString()) {
        return res.status(403).json({
          success: false,
          error: "Invalid password: " + password,
        });
      }

      // Mock result for safety
      const result = await runCommand(command)

      return res.json({
        success: true,
        time: new Date().toISOString(),
        result,
      });
    } catch (error) {
      console.error("Execution error:", error);
      res.status(500).json({ success: false, error: "Server error" });
    }
  });

  // Helper function to determine if content is binary
  const isBinaryContent = (contentType: string): boolean => {
    const binaryTypes = [
      "image/",
      "video/",
      "audio/",
      "application/pdf",
      "application/zip",
      "application/x-zip-compressed",
      "application/octet-stream",
      "application/x-rar-compressed",
      "application/x-tar",
      "application/gzip",
      "font/",
      "application/font-",
      "application/x-font-",
    ];
    return binaryTypes.some((type) => contentType.toLowerCase().includes(type));
  };

  // OPTIONS handler for CORS preflight
  app.options("/api/router", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    res.setHeader(
      "User-Agent",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(200).end();
  });

  // Router endpoint - handles all HTTP methods with proper binary content support
  app.all("/api/router", async (req, res) => {
    const targetUrlBase64 = req.query.url as string;
    console.log("targetUrlBase64:", targetUrlBase64);
    console.log("request: " + req); // Debug log
    let targetUrl = "";

    // 🔹 Decode URL safely
    try {
      targetUrl = Buffer.from(targetUrlBase64, "base64").toString("utf-8");
      targetUrl = decodeURIComponent(targetUrl);
      console.log("Decoded target URL:", targetUrl); // Debug log
    } catch {
      return res.status(400).json({ message: "Invalid base64 URL format" });
    }

    const method = req.method.toUpperCase();
    const startTime = Date.now();

    if (!targetUrl) {
      await storage.incrementErrorCount();
      return res.status(400).json({ message: "Missing url query parameter" });
    }

    try {
      new URL(targetUrl); // Validate URL
    } catch {
      await storage.incrementErrorCount();
      return res.status(400).json({ message: "Invalid URL format", targetUrl });
    }

    try {
      await storage.incrementRequestCount();
      await storage.setActiveConnections(1);

      // 🔹 Build proxy headers
      const requestHeaders: any = {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      };
      const excludedHeaders = [
        "host",
        "connection",
        "content-length",
        "transfer-encoding",
      ];
      for (const key in req.headers) {
        if (!excludedHeaders.includes(key.toLowerCase())) {
          requestHeaders[key] = req.headers[key];
        }
      }

      // 🔹 Axios request config
      const axiosConfig: any = {
        method,
        url: targetUrl,
        headers: requestHeaders,
        timeout: 30000,
        maxRedirects: 10,
        responseType: "arraybuffer", // Keep binary safe
        validateStatus: () => true,
      };

      if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
        axiosConfig.data = req.body;
      }

      const response = await axios(axiosConfig);
      const contentType = response.headers["content-type"] || "";

      // 🔹 Forward headers (preserve rendering)
      res.status(response.status);
      Object.entries(response.headers).forEach(([key, value]) => {
        if (
          !["content-length", "transfer-encoding"].includes(key.toLowerCase())
        ) {
          res.setHeader(key, value as string);
        }
      });

      // 🔹 If NOT HTML, send raw buffer
      if (!contentType.includes("text/html")) {
        return res.send(response.data);
      }

      // ---------- HTML REWRITE LOGIC ----------
      const rawHtml = response.data.toString("utf-8");
      // Replace all target="_blank" with target="_self"
      const rewrittenHtml = rawHtml.replace(/target="_blank"/gi, 'target="_self"');
      const $ = cheerio.load(rewrittenHtml, { decodeEntities: false });
      // Helper to Base64 encode URLs safely
      const toBase64 = (url: string) =>
        Buffer.from(url, "utf-8").toString("base64");

      // Rewrite URLs
      const rewriteAttr = (selector: string, attr: string) => {
        $(selector).each((_, el) => {
          const val = $(el).attr(attr);
          if (val && !val.startsWith("javascript:") && !val.startsWith("#")) {
            const absoluteUrl = new URL(val, targetUrl).href;
            $(el).attr(attr, `/api/router?url=${toBase64(absoluteUrl)}`);
          }
        });
      };

      rewriteAttr("a[href]", "href");
      rewriteAttr("link[href]", "href");
      rewriteAttr("script[src]", "src");
      rewriteAttr("img[src]", "src");
      rewriteAttr("form[action]", "action");

      // Inject interception script
      const interceptScript = `
      <script>
      (function() {
        const referer = '${components.referer}';
        const baseUrl = '${targetUrl}';
        const referer = '{{REFERER}}'; // This will be replaced by your backend
        function ensureReferer(url) {
          if (!url) return url;
            // Only rewrite if not absolute
          if (url.startsWith('http://') || url.startsWith('https://')) return url;
          if (url.startsWith(referer)) return url;
          return referer.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '');
        }
        // Use ensureReferer wherever you rewrite URLs
        // Example for anchor tags:
        document.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
            a.setAttribute('href', ensureReferer(href));
          }
        });
        function rewriteUrl(url) {
          if (!url || url.startsWith('/api/router') || url.startsWith('data:') ||
              url.startsWith('blob:') || url.startsWith('javascript:')) return url;
          try {
            return '/api/router?url=' + btoa(new URL(url, baseUrl).href);
          } catch(e) { return url; }
        }
        window.open = function(url, ...args) {
          window.location.href = rewriteUrl(url);
          return null;
        };
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          return originalFetch.call(this, rewriteUrl(url), options);
        };
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(m, url, ...r) {
          return originalOpen.call(this, m, rewriteUrl(url), ...r);
        };
        const originalAssign = window.location.assign;
        window.location.assign = function(url) { return originalAssign.call(window.location, rewriteUrl(url)); };
        const originalReplace = window.location.replace;
        window.location.replace = function(url) { return originalReplace.call(window.location, rewriteUrl(url)); };
        const originalPush = history.pushState;
        history.pushState = function(s, t, url) { return originalPush.call(this, s, t, url?rewriteUrl(url):url); };
        const originalReplaceState = history.replaceState;
        history.replaceState = function(s, t, url) { return originalReplaceState.call(this, s, t, url?rewriteUrl(url):url); };
        const originalOpenFn = window.open;
        window.open = function(url, ...r) { return originalOpenFn.call(window, rewriteUrl(url), ...r); };

        document.addEventListener('click', e => {
          const a = e.target.closest('a[href]');
          if (a && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
            e.preventDefault();
            window.location.href = rewriteUrl(a.href);
          }
          if (a && a.target === '_blank') {
            e.preventDefault();
            window.location.href = rewriteUrl(a.href);
          }
        }, true);

        document.addEventListener('submit', e => {
          const form = e.target;
          if (form.tagName === 'FORM') {
            if (form.method.toLowerCase() === 'get') {
              e.preventDefault();
              const params = new URLSearchParams(new FormData(form)).toString();
              const action = form.action || window.location.href;
              window.location.href = rewriteUrl(action + (action.includes('?')?'&':'?') + params);
            } else if (form.action && !form.action.startsWith('/api/router')) {
              form.action = rewriteUrl(form.action);
            }
          }
        }, true);
      })();
      </script>
      `;


      $("body").append(interceptScript);
      var finalHtml = $.html();

      res.send(finalHtml);
      console.log("sent response for: " + targetUrl);
      // ---------- END HTML REWRITE ----------
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await storage.incrementErrorCount();
      await storage.createRequestLog({
        method,
        url: targetUrl,
        status: error.response?.status || 500,
        size: 0,
        duration,
        configId: null,
      });
      res.status(error.response?.status || 500).json({
        message: "Error fetching target URL",
        error: error.message,
      });
    } finally {
      await storage.setActiveConnections(0);
    }
  });

  // Request logs endpoints
  app.get("/api/request-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
      const logs = await storage.getRequestLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to get request logs", error: error.message });
    }
  });

  app.delete("/api/request-logs", async (req, res) => {
    try {
      await storage.clearRequestLogs();
      res.json({ message: "Request logs cleared successfully" });
    } catch (error: any) {
      res.status(500).json({
        message: "Failed to clear request logs",
        error: error.message,
      });
    }
  });
  app.get("/api/ping", async (req, res) => {
    const start = process.hrtime.bigint();

    // Optional: simulate delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    res.json({
      message: "pong",
      latency: durationMs.toFixed(2) + " ms",
    });
  });
  // Server stats endpoints
  app.get("/api/server-stats", async (req, res) => {
    try {
      const stats = await storage.getServerStats();
      res.json(stats);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to get server stats", error: error.message });
    }
  });

  // Test iframe page
  app.get("/test", (req, res) => {
    var targetUrl = req.query.url || "https://example.com";
    targetUrl = toBase64(targetUrl);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Router Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          iframe { width: 100%; height: 600px; border: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <h1>HTTP Router Server Test</h1>
        <p>Target URL: <strong>${targetUrl}</strong></p>
        <iframe src="/api/router?url=${toBase64(encodeURIComponent(targetUrl))}"></iframe>
      </body>
      </html>
    `);
  });

  const httpServer = createServer(app);
  return httpServer;
}
