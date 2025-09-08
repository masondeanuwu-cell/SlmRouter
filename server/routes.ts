import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import nodemailer from "nodemailer";
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
import componets from "../components.json";

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

  // Landing page signup: save request and email admin
  app.post('/api/signup', async (req, res) => {
    try {
      const payload = req.body || {};

      const entry = {
        id: Date.now().toString(),
        ...payload,
        createdAt: new Date().toISOString(),
      };

      // persist to server/signups.json
      const signupsPath = path.join('server', 'signups.json');
      let list: any[] = [];
      if (fs.existsSync(signupsPath)) {
        try {
          const raw = fs.readFileSync(signupsPath, 'utf-8') || '[]';
          list = JSON.parse(raw || '[]');
          if (!Array.isArray(list)) list = [];
        } catch (e) {
          list = [];
        }
      }
      list.push(entry);
      fs.writeFileSync(signupsPath, JSON.stringify(list, null, 2), 'utf-8');

  // Send email to admin with request details
  const toEmail = process.env.ADMIN_EMAIL || 'masondeanuwu@gmail.com';

      // SMTP configuration from environment
      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpSecure = process.env.SMTP_SECURE === 'true';

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
        console.error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.');
        return res.status(500).json({ message: `SMTP not configured on server; cannot send email, ${JSON.stringify({ smtpHost, smtpPort, smtpUser, smtpPass })}` });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure || (smtpPort === 465),
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const plain = `New signup request received:\n\n${JSON.stringify(entry, null, 2)}\n\nReceived at: ${entry.createdAt}`;
      const html = `<h2>New signup request</h2><pre style="white-space:pre-wrap;background:#f4f4f4;padding:10px;border-radius:6px">${JSON.stringify(entry, null, 2)}</pre><p>Received at: ${entry.createdAt}</p>`;

      await transporter.sendMail({
        from: `${smtpUser}`,
        to: toEmail,
        subject: `SLM Router - New signup request from ${payload.fullName || 'unknown'}`,
        text: plain,
        html,
      });

      res.status(201).json({ success: true, message: 'Signup saved and email sent' });
    } catch (err: any) {
      console.error('Signup handler error:', err);
      res.status(500).json({ message: 'Server error saving signup' });
    }
  });

  // Return saved signup requests (admin view)
  app.get('/api/signups', async (req, res) => {
    try {
      const signupsPath = path.join('server', 'signups.json');
      if (!fs.existsSync(signupsPath)) return res.json([]);
      const raw = fs.readFileSync(signupsPath, 'utf-8') || '[]';
      const list = JSON.parse(raw || '[]');
      return res.json(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.error('Failed to read signups.json', err);
      res.status(500).json({ message: 'Failed to read signups', error: err?.message || String(err) });
    }
  });

  // Fetch metadata (title + favicon) for a given URL. Client should pass an encoded URL.
  app.get('/api/meta', async (req, res) => {
    try {
      const raw = String(req.query.url || "");
      if (!raw) return res.status(400).json({ message: 'Missing url query param' });

      // Accept either an encoded URL or a base64 input
      let target = Buffer.from(raw, 'base64').toString('utf-8');
      try {
        // try decodeURIComponent first
        target = decodeURIComponent(target);
      } catch (e) {
        // ignore
      }

      // If it looks like base64 (only A-Za-z0-9+/= and no ://), attempt to decode
      if (!/^https?:\/\//i.test(target) && /^[A-Za-z0-9+/=]+$/.test(raw)) {
        try {
          target = Buffer.from(raw, 'base64').toString('utf-8');
        } catch (e) {}
      }

      if (!/^https?:\/\//i.test(target)) {
        return res.status(400).json({ message: 'Invalid url format', url: target });
      }

      const response = await axios.get(target, {
        timeout: 8000,
        headers: {
          'User-Agent': 'SlmRouter/MetaFetcher (+https://slmrouter.local)'
        },
        responseType: 'text'
      });

      const $ = cheerio.load(response.data || '');
      const title = $('title').first().text().trim() || null;

      // attempt to find favicon links
      let favicon: string | null = null;
      const candidates = [] as string[];
      $('link').each((_, el) => {
        const rel = ($(el).attr('rel') || '').toLowerCase();
        const href = $(el).attr('href') || '';
        if (!href) return;
        if (rel.includes('icon') || rel.includes('shortcut') || rel.includes('apple-touch-icon')) {
          candidates.push(href);
        }
      });
      // fallback to /favicon.ico
      if (candidates.length === 0) candidates.push('/favicon.ico');

      for (const c of candidates) {
        try {
          const abs = new URL(c, target).href;
          // quick HEAD to see if exists (skip for now to save requests) — just return first
          favicon = abs;
          break;
        } catch (e) {
          continue;
        }
      }

      return res.json({ title, favicon });
    } catch (err: any) {
      console.error('meta fetch error', err?.message || err);
      return res.status(500).json({ message: 'Failed to fetch meta', error: err?.message || String(err) });
    }
  });

  // Delete a signup by id
  app.delete('/api/signups/:id', async (req, res) => {
    try {
      const id = req.params.id;
      if (!id) return res.status(400).json({ message: 'Missing id parameter' });

      const signupsPath = path.join('server', 'signups.json');
      if (!fs.existsSync(signupsPath)) return res.status(404).json({ message: 'No signups file' });

      const raw = fs.readFileSync(signupsPath, 'utf-8') || '[]';
      let list: any[] = [];
      try {
        list = JSON.parse(raw || '[]');
        if (!Array.isArray(list)) list = [];
      } catch (e) {
        list = [];
      }

      const index = list.findIndex((it: any) => String(it.id) === String(id) || String(it._id) === String(id));
      if (index === -1) return res.status(404).json({ message: 'Signup not found' });

      // remove the item
      list.splice(index, 1);

      // write back
      fs.writeFileSync(signupsPath, JSON.stringify(list, null, 2), 'utf-8');

      return res.json({ success: true, message: 'Signup deleted' });
    } catch (err: any) {
      console.error('Failed to delete signup', err);
      return res.status(500).json({ message: 'Failed to delete signup', error: err?.message || String(err) });
    }
  });

  
  
  app.get("/api/browse", async (req, res) => {
    /* legacy code to serve browser.html
    const filePath = "client/src/pages/browser.html";
    try {
      const html = await fs.promises.readFile(filePath, "utf-8");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (err) {
      res.status(404).send("browser.html not found");
    }
    */ // serve react app instead
    const filePath = "/home/mason/Downloads/FrameRouter/client/src/pages/Browser.tsx";
    res.sendFile(filePath);
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
        // Use streaming so large binaries (videos, large downloads) are
        // proxied without buffering the entire file into Node's heap.
        responseType: "stream",
        validateStatus: () => true,
      };

      if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
        axiosConfig.data = req.body;
      }

  const response = await axios(axiosConfig);
  const contentType = (response.headers && (response.headers["content-type"] || response.headers["Content-Type"])) || "";

      // Detect common static resource extensions (js, mjs, wasm) and
      // override incorrect upstream Content-Type headers (some sites
      // erroneously serve JS as text/html). This prevents browser strict
      // MIME type errors for module scripts.
      let overrideContentType: string | null = null;
      try {
        const parsed = new URL(targetUrl);
        const ext = path.extname(parsed.pathname || "").toLowerCase();
        if ((ext === ".js" || ext === ".mjs") && contentType.includes("text/html")) {
          overrideContentType = "application/javascript; charset=utf-8";
        }
        if (ext === ".wasm" && contentType.includes("text/html")) {
          overrideContentType = "application/wasm";
        }
      } catch (e) {
        // ignore URL parse errors
      }

  // 🔹 Forward headers (preserve rendering) but apply any overrides and
  // strip framing protections that would prevent embedding in our iframe.
  res.status(response.status);
  Object.entries(response.headers).forEach(([key, value]) => {
        const k = key.toLowerCase();
        // skip these hop-by-hop headers
        if (["content-length", "transfer-encoding"].includes(k)) return;

        // Remove X-Frame-Options (DENY / SAMEORIGIN) so our iframe can render.
        // Also log if upstream explicitly set DENY so it's clear why it was dropped.
        if (k === 'x-frame-options' || k === 'frame-options') {
          const val = String(value || '').toLowerCase();
          if (val.includes('deny')) console.log('Dropping X-Frame-Options: DENY for', targetUrl);
          else console.log('Stripping header X-Frame-Options for', targetUrl, 'value=', value);
          return;
        }

        // Remove Content-Security-Policy headers (including Report-Only variants)
        if (k.includes('content-security-policy') || k === 'x-webkit-csp') {
          console.log('Dropping CSP header (or Report-Only) for', targetUrl, 'header=', key);
          return;
        }

        // Apply content-type override for JS/WASM when needed
        if (k === 'content-type' && overrideContentType) {
          res.setHeader('content-type', overrideContentType);
          return;
        }

        // otherwise forward header as-is
        res.setHeader(key, value as string);
      });

      // 🔹 If NOT HTML, stream the response directly to the client (avoid buffering)
      if (!contentType.includes("text/html")) {
        try {
          const stream = response.data as NodeJS.ReadableStream;
          // ensure headers already set above; pipe and return
          stream.pipe(res);
          return;
        } catch (e) {
          // fallback to sending whatever axios provided (may throw)
          return res.send(response.data);
        }
      }
      res.setHeader("X-Content-Type-Options", "nosniff");
      // ---------- HTML REWRITE LOGIC ----------
      // Collect the HTML stream into a string for rewriting
      let rawHtml = "";
      try {
        const chunks: Buffer[] = [];
        const stream = response.data as NodeJS.ReadableStream;
        await new Promise<void>((resolve, reject) => {
          stream.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))));
          stream.on('end', () => resolve());
          stream.on('error', (err: any) => reject(err));
        });
        rawHtml = Buffer.concat(chunks).toString('utf-8');
      } catch (e) {
        // If stream collection fails, fallback to an empty string so rewrite doesn't crash
        rawHtml = '';
      }
      // Replace all target="_blank" with target="_self"
      const rewrittenHtml = rawHtml.replace(/target="_blank"/gi, 'target="_self"');
  const $ = cheerio.load(rewrittenHtml);
      // Helper to Base64 encode URLs safely
      const toBase64 = (url: string) =>
        Buffer.from(url, "utf-8").toString("base64");

      // Remove meta X-Frame-Options tags (some pages include this in HTML)
      try {
        $('meta[http-equiv]').each((_, el) => {
          const http = ($(el).attr('http-equiv') || '').toLowerCase();
          if (http === 'x-frame-options') $(el).remove();
        });
      } catch (e) {
        // ignore
      }

      // Remove <link rel="preload"> tags — many sites preload large media or fonts
      // which can trigger "preloaded but not used" warnings when proxied. Removing
      // these reduces wasted requests and browser console noise.
      try {
        $('link[rel~="preload"]').remove();
      } catch (e) {}

      // Sanitize inline scripts to remove common frame-busting patterns
      try {
        $('script:not([src])').each((_, el) => {
          try {
            const code = $(el).html() || '';
            if (!code) return;
            // Replace attempts to navigate top/parent or check framing
            let safe = code
              .replace(/top\.location/g, '/* suppressed top.location */')
              .replace(/parent\.location/g, '/* suppressed parent.location */')
              .replace(/window\.top/g, 'window.self')
              .replace(/window\.frameElement/g, 'null')
              .replace(/frameElement/g, 'null')
              .replace(/if\s*\(\s*self\s*(!==|!=)\s*top\s*\)/g, 'if(false)')
              .replace(/if\s*\(\s*top\s*!==\s*self\s*\)/g, 'if(false)');
            // Overwrite the inline script with sanitized version
            $(el).text(safe);
          } catch (e) {}
        });
      } catch (e) {
        // ignore
      }

  // Build absolute proxy prefix so rewritten URLs always point to our proxy
  const proxyPrefix = `${req.protocol}://${req.get('host')}`;

  // Rewrite URLs
      // Helper: rewrite attributes like href/action/src using the targetUrl as base
      const rewriteAttr = (selector: string, attr: string) => {
        $(selector).each((_, el) => {
          const val = $(el).attr(attr);
          if (!val) return;
          const low = String(val).trim();
          if (low.startsWith('javascript:') || low.startsWith('#') || low.startsWith('data:') || low.startsWith('mailto:')) return;
          try {
            const absoluteUrl = new URL(val, targetUrl).href;
            $(el).attr(attr, `${proxyPrefix}/api/router?url=${toBase64(absoluteUrl)}`);
          } catch (e) {
            // leave as-is on parse errors
          }
        });
      };

      // Basic href/action rewrites
      rewriteAttr('a[href]', 'href');
      rewriteAttr('link[href]', 'href');
      rewriteAttr('form[action]', 'action');

      // Rewrite all src attributes (img, script, iframe, video, audio, source, embed, etc.)
      // but do NOT proxy video files — leave them as absolute remote URLs so
      // the browser can stream them directly.
      const videoExts = ['.mp4', '.webm', '.ogg', '.m3u8', '.mpd', '.mov'];
      $('[src]').each((_, el) => {
        const val = $(el).attr('src');
        if (!val) return;
        const low = String(val).trim();
        if (low.startsWith('javascript:') || low.startsWith('#') || low.startsWith('data:')) return;
        try {
          const absoluteUrl = new URL(val, targetUrl).href;
          const tag = (($(el).prop && $(el).prop('tagName')) || '').toLowerCase();
          let ext = '';
          try { ext = path.extname(new URL(absoluteUrl).pathname || '').toLowerCase(); } catch(e) { ext = ''; }
          const isVideo = tag === 'video' || tag === 'source' || videoExts.includes(ext);
          if (isVideo) {
            // leave as absolute remote URL (not proxied)
            $(el).attr('src', absoluteUrl);
          } else {
            $(el).attr('src', `${proxyPrefix}/api/router?url=${toBase64(absoluteUrl)}`);
          }
        } catch (e) {}
      });

      // Rewrite srcset attributes (comma-separated list of URLs + descriptors)
      $('[srcset]').each((_, el) => {
        const val = $(el).attr('srcset');
        if (!val) return;
        try {
          const parts = String(val).split(',').map(s => s.trim()).filter(Boolean);
          const rewritten = parts.map(p => {
            const sub = p.split(/\s+/);
            const urlPart = sub[0];
            const desc = sub.slice(1).join(' ');
            if (!urlPart || urlPart.startsWith('data:') || urlPart.startsWith('javascript:') || urlPart.startsWith('#')) return p;
            try {
              const absoluteUrl = new URL(urlPart, targetUrl).href;
              return `${proxyPrefix}/api/router?url=${toBase64(absoluteUrl)}` + (desc ? ' ' + desc : '');
            } catch (e) {
              return p;
            }
          }).join(', ');
          $(el).attr('srcset', rewritten);
        } catch (e) {}
      });

      // Inject interception script and frame-detection neutralizers (prepended to head)
      const interceptScript = `
      <script>
      (function() {
        // Base URL for rewrites inside the iframe
        const baseUrl = '${targetUrl}';

        // Stronger frame-detection neutralizers: mask top/parent/frameElement
        try {
          Object.defineProperty(window, 'top', { get: function(){ return window; }, configurable: true });
          Object.defineProperty(window, 'parent', { get: function(){ return window; }, configurable: true });
          Object.defineProperty(window, 'frameElement', { get: function(){ return null; }, configurable: true });
        } catch(e) {}
        // legacy fallbacks
        try { window.__defineGetter__ && window.__defineGetter__('top', function(){ return window; }); } catch(e) {}
        try { window.__defineGetter__ && window.__defineGetter__('parent', function(){ return window; }); } catch(e) {}

        // Force self references to the same window (helps checks like self!==top)
        try { if (window.self !== window) window.self = window; } catch(e) {}

        // single rewrite helper — use location.origin at runtime so rewritten
        // links point to the proxy host (avoid the browser resolving them
        // against the asset origin which causes CORS issues).
        function rewriteUrl(url) {
          if (!url || url.startsWith('/api/router') || url.startsWith('data:') ||
              url.startsWith('blob:') || url.startsWith('javascript:')) return url;
          try {
            return location.origin + '/api/router?url=' + btoa(new URL(url, baseUrl).href);
          } catch(e) { return url; }
        }

        // Intercept network/navigation APIs to keep requests inside the iframe
        try {
          const originalFetch = window.fetch && window.fetch.bind(window);
          if (originalFetch) window.fetch = function(url, options) { return originalFetch(rewriteUrl(url), options); };
        } catch(e){}

        try {
          const XHROpen = XMLHttpRequest.prototype.open;
          XMLHttpRequest.prototype.open = function(method, url, ...args) {
            return XHROpen.call(this, method, rewriteUrl(url), ...args);
          };
        } catch(e){}

        try {
          const origOpen = window.open;
          window.open = function(url, ...args) { return origOpen.call(this, rewriteUrl(url), ...args); };
        } catch(e){}

        try {
          const origAssign = window.location.assign;
          window.location.assign = function(url) { return origAssign.call(window.location, rewriteUrl(url)); };
          const origReplace = window.location.replace;
          window.location.replace = function(url) { return origReplace.call(window.location, rewriteUrl(url)); };
        } catch(e){}

        try {
          const origPush = history.pushState;
          history.pushState = function(s, t, url) { return origPush.call(this, s, t, url?rewriteUrl(url):url); };
          const origReplaceState = history.replaceState;
          history.replaceState = function(s, t, url) { return origReplaceState.call(this, s, t, url?rewriteUrl(url):url); };
        } catch(e){}

        // Intercept clicks and form submissions
        document.addEventListener('click', e => {
          const a = e.target.closest && e.target.closest('a[href]');
          if (a && a.href && !a.href.startsWith('javascript:') && !a.href.startsWith('#')) {
            e.preventDefault();
            window.location.href = rewriteUrl(a.href);
          }
        }, true);

        document.addEventListener('submit', e => {
          const form = e.target;
          if (form && form.tagName === 'FORM') {
            if ((form.method || 'get').toLowerCase() === 'get') {
              e.preventDefault();
              const params = new URLSearchParams(new FormData(form)).toString();
              const action = form.action || window.location.href;
              window.location.href = rewriteUrl(action + (action.includes('?')?'&':'?') + params);
            } else if (form.action && !form.action.startsWith('/api/router')) {
              form.action = rewriteUrl(form.action);
            }
          }
        }, true);

        // Remove any meta tags indicating X-Frame-Options (in-case server missed them)
        try {
          document.querySelectorAll('meta[http-equiv]').forEach(m => {
            if ((m.getAttribute('http-equiv')||'').toLowerCase() === 'x-frame-options') m.remove();
          });
        } catch(e){}

      })();
      </script>
      `;


      // Prepend to head if present so this runs before most inline scripts execute
      if ($('head').length) {
        $('head').prepend(interceptScript);
      } else {
        $('body').append(interceptScript);
      }
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
