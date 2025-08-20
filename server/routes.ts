import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { insertProxyConfigSchema, insertRequestLogSchema, loginSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      
      // Simple password check - you can make this more secure
      const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin123";
      
      if (validatedData.password === DASHBOARD_PASSWORD) {
        res.json({ success: true, message: "Login successful" });
      } else {
        res.status(401).json({ message: "Invalid password" });
      }
    } catch (error: any) {
      res.status(400).json({ message: "Invalid request", error: error.message });
    }
  });

  // Proxy configuration endpoints
  app.post("/api/proxy-config", async (req, res) => {
    try {
      const validatedData = insertProxyConfigSchema.parse(req.body);
      const config = await storage.createProxyConfig(validatedData);
      res.json(config);
    } catch (error: any) {
      res.status(400).json({ message: "Invalid proxy configuration", error: error.message });
    }
  });

  app.get("/api/proxy-config", async (req, res) => {
    try {
      const config = await storage.getLatestProxyConfig();
      res.json(config || null);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to get proxy configuration", error: error.message });
    }
  });

  // Helper function to determine if content is binary
  const isBinaryContent = (contentType: string): boolean => {
    const binaryTypes = [
      'image/', 'video/', 'audio/', 'application/pdf', 'application/zip',
      'application/x-zip-compressed', 'application/octet-stream',
      'application/x-rar-compressed', 'application/x-tar', 'application/gzip',
      'font/', 'application/font-', 'application/x-font-'
    ];
    return binaryTypes.some(type => contentType.toLowerCase().includes(type));
  };

  // OPTIONS handler for CORS preflight
  app.options("/api/proxy", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Access-Control-Max-Age", "86400");
    res.status(200).end();
  });

  // Proxy endpoint - handles all HTTP methods with proper binary content support
  app.all("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    const method = req.method.toUpperCase();
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
      await storage.setActiveConnections(1);

      // Prepare request headers
      const requestHeaders: any = {
        'User-Agent': 'Mozilla/5.0 (compatible; ProxyServer/1.0)',
      };

      // Forward original headers (excluding host and connection-related ones)
      const excludeHeaders = ['host', 'connection', 'content-length', 'transfer-encoding'];
      Object.keys(req.headers).forEach(key => {
        if (!excludeHeaders.includes(key.toLowerCase())) {
          requestHeaders[key] = req.headers[key];
        }
      });

      // Prepare request config
      const axiosConfig: any = {
        method: method,
        url: targetUrl,
        timeout: 30000,
        maxRedirects: 5,
        headers: requestHeaders,
        responseType: 'arraybuffer', // Always use arraybuffer to handle both text and binary
        validateStatus: () => true, // Accept all status codes
      };

      // Add request body for POST, PUT, PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
        axiosConfig.data = req.body;
      }

      const response = await axios(axiosConfig);
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const contentLength = response.data.length;
      const duration = Date.now() - startTime;

      // Log the request
      await storage.createRequestLog({
        method: method,
        url: targetUrl,
        status: response.status,
        size: contentLength,
        duration,
        configId: null,
      });

      await storage.addDataTransferred(contentLength);

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

      // Forward response headers (excluding certain ones)
      const excludeResponseHeaders = ['transfer-encoding', 'connection', 'access-control-allow-origin'];
      Object.keys(response.headers).forEach(key => {
        if (!excludeResponseHeaders.includes(key.toLowerCase())) {
          res.setHeader(key, response.headers[key]);
        }
      });

      // Handle different content types
      if (contentType.includes('text/html')) {
        // Convert buffer to string for HTML processing
        const htmlContent = response.data.toString('utf8');
        const $ = cheerio.load(htmlContent);

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

        // Inject a script to intercept AJAX requests and handle different HTTP methods
        const interceptScript = `
          <script>
            (function() {
              const originalFetch = window.fetch;
              window.fetch = function(url, options = {}) {
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
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(response.status).send($.html());
      
      } else if (isBinaryContent(contentType)) {
        // Handle binary content (images, videos, etc.)
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', contentLength.toString());
        res.status(response.status).end(response.data);
      
      } else if (contentType.includes('text/') || contentType.includes('application/json') || contentType.includes('application/xml')) {
        // Handle text content (CSS, JS, JSON, XML, etc.)
        const textContent = response.data.toString('utf8');
        res.setHeader('Content-Type', contentType);
        res.status(response.status).send(textContent);
      
      } else {
        // Handle other content types as binary
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', contentLength.toString());
        res.status(response.status).end(response.data);
      }

    } catch (error: any) {
      const duration = Date.now() - startTime;
      await storage.incrementErrorCount();
      
      // Log the failed request
      await storage.createRequestLog({
        method: method,
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
      res.status(500).json({ message: "Failed to get request logs", error: error.message });
    }
  });

  app.delete("/api/request-logs", async (req, res) => {
    try {
      await storage.clearRequestLogs();
      res.json({ message: "Request logs cleared successfully" });
    } catch (error: any) {
      res.status(500).json({ message: "Failed to clear request logs", error: error.message });
    }
  });

  // Server stats endpoints
  app.get("/api/server-stats", async (req, res) => {
    try {
      const stats = await storage.getServerStats();
      res.json(stats);
    } catch (error: any) {
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
