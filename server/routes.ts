import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { insertProxyConfigSchema, insertRequestLogSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Proxy configuration endpoints
  app.post("/api/proxy-config", async (req, res) => {
    try {
      const validatedData = insertProxyConfigSchema.parse(req.body);
      const config = await storage.createProxyConfig(validatedData);
      res.json(config);
    } catch (error) {
      res.status(400).json({ message: "Invalid proxy configuration", error: error.message });
    }
  });

  app.get("/api/proxy-config", async (req, res) => {
    try {
      const config = await storage.getLatestProxyConfig();
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to get proxy configuration", error: error.message });
    }
  });

  // Proxy endpoint - handles the actual proxying with HTML rewriting
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    const startTime = Date.now();

    if (!targetUrl) {
      await storage.incrementErrorCount();
      return res.status(400).json({ message: "Missing url query parameter" });
    }

    try {
      // Validate URL
      new URL(targetUrl);
    } catch {
      await storage.incrementErrorCount();
      return res.status(400).json({ message: "Invalid URL format" });
    }

    try {
      await storage.incrementRequestCount();
      await storage.setActiveConnections(1); // Simplified for demo

      const response = await axios.get(targetUrl, {
        timeout: 30000,
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ProxyServer/1.0)',
        }
      });

      const contentType = response.headers['content-type'] || '';
      const contentLength = Buffer.byteLength(response.data);
      const duration = Date.now() - startTime;

      // Log the request
      await storage.createRequestLog({
        method: 'GET',
        url: targetUrl,
        status: response.status,
        size: contentLength,
        duration,
        configId: null, // Could be linked to current config
      });

      await storage.addDataTransferred(contentLength);

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (contentType.includes('text/html')) {
        const $ = cheerio.load(response.data);

        // Rewrite all src and href attributes to go through the proxy
        $('*[src], *[href]').each((i, el) => {
          const $el = $(el);
          const attr = $el.attr('src') ? 'src' : 'href';
          const originalUrl = $el.attr(attr);

          if (originalUrl) {
            try {
              // Handle relative URLs
              const absoluteUrl = new URL(originalUrl, targetUrl).href;
              $el.attr(attr, `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            } catch {
              // Ignore malformed URLs
            }
          }
        });

        // Rewrite form actions
        $('form[action]').each((i, el) => {
          const $el = $(el);
          const action = $el.attr('action');
          if (action) {
            try {
              const absoluteUrl = new URL(action, targetUrl).href;
              $el.attr('action', `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`);
            } catch {
              // Ignore malformed URLs
            }
          }
        });

        // Inject a script to intercept AJAX requests
        const interceptScript = `
          <script>
            (function() {
              const originalFetch = window.fetch;
              window.fetch = function(url, options) {
                if (typeof url === 'string' && !url.startsWith('/api/proxy')) {
                  try {
                    const absoluteUrl = new URL(url, '${targetUrl}').href;
                    url = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                  } catch (e) {}
                }
                return originalFetch.call(this, url, options);
              };

              const originalXHROpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url, ...args) {
                if (typeof url === 'string' && !url.startsWith('/api/proxy')) {
                  try {
                    const absoluteUrl = new URL(url, '${targetUrl}').href;
                    url = '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                  } catch (e) {}
                }
                return originalXHROpen.call(this, method, url, ...args);
              };
            })();
          </script>
        `;

        $('head').append(interceptScript);

        res.set('Content-Type', 'text/html');
        res.send($.html());
      } else {
        // Forward other content types as-is
        res.set('Content-Type', contentType);
        res.send(response.data);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      await storage.incrementErrorCount();
      
      // Log the failed request
      await storage.createRequestLog({
        method: 'GET',
        url: targetUrl,
        status: error.response?.status || 500,
        size: 0,
        duration,
        configId: null,
      });

      res.status(error.response?.status || 500).json({ 
        message: "Error fetching the target URL", 
        error: error.message 
      });
    } finally {
      await storage.setActiveConnections(0); // Simplified for demo
    }
  });

  // Request logs endpoints
  app.get("/api/request-logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      const logs = await storage.getRequestLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to get request logs", error: error.message });
    }
  });

  app.delete("/api/request-logs", async (req, res) => {
    try {
      await storage.clearRequestLogs();
      res.json({ message: "Request logs cleared successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to clear request logs", error: error.message });
    }
  });

  // Server stats endpoints
  app.get("/api/server-stats", async (req, res) => {
    try {
      const stats = await storage.getServerStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get server stats", error: error.message });
    }
  });

  // Test iframe page
  app.get("/test", (req, res) => {
    const targetUrl = req.query.url || 'https://example.com';
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proxy Test</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          iframe { width: 100%; height: 600px; border: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <h1>HTTP Proxy Server Test</h1>
        <p>Target URL: <strong>${targetUrl}</strong></p>
        <iframe src="/api/proxy?url=${encodeURIComponent(targetUrl)}"></iframe>
      </body>
      </html>
    `);
  });

  const httpServer = createServer(app);
  return httpServer;
}
