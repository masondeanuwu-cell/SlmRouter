import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import * as cheerio from "cheerio";
import { URL } from "url";
import { insertProxyConfigSchema, insertRequestLogSchema, loginSchema, changePasswordSchema } from "@shared/schema";
import fs from 'fs';
import path from 'path';

export async function registerRoutes(app: Express): Promise<Server> {
  // Load users from JSON file
  const getUsersFromFile = () => {
    try {
      const usersPath = path.join(process.cwd(), 'server', 'users.json');
      const usersData = fs.readFileSync(usersPath, 'utf8');
      return JSON.parse(usersData);
    } catch (error) {
      console.error('Error reading users file:', error);
      return [];
    }
  };

  const saveUsersToFile = (users: any[]) => {
    try {
      const usersPath = path.join(process.cwd(), 'server', 'users.json');
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving users file:', error);
    }
  };

  // Authentication endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const validatedData = loginSchema.parse(req.body);
      const users = getUsersFromFile();
      
      const user = users.find((u: any) => 
        u.username === validatedData.username && u.password === validatedData.password
      );
      
      if (user) {
        res.json({ success: true, message: "Login successful", username: user.username });
      } else {
        res.status(401).json({ message: "Invalid username or password" });
      }
    } catch (error: any) {
      res.status(400).json({ message: "Invalid request", error: error.message });
    }
  });

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const validatedData = changePasswordSchema.parse(req.body);
      const users = getUsersFromFile();
      
      // Find user and verify current password
      const userIndex = users.findIndex((u: any) => 
        u.username === validatedData.username && u.password === validatedData.currentPassword
      );
      
      if (userIndex === -1) {
        return res.status(401).json({ message: "Current username or password is incorrect" });
      }
      
      // Update password
      users[userIndex].password = validatedData.newPassword;
      saveUsersToFile(users);
      
      res.json({ success: true, message: "Password changed successfully" });
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
      // Log details about the missing URL request for debugging
      console.log(`Missing URL parameter - Method: ${method}, Referer: ${req.headers.referer}, User-Agent: ${req.headers['user-agent']}, Query:`, req.query);
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
              const baseUrl = '${targetUrl}';
              
              // Helper function to rewrite URLs
              function rewriteUrl(url) {
                if (typeof url !== 'string' || url.startsWith('/api/proxy') || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:')) {
                  return url;
                }
                try {
                  const absoluteUrl = new URL(url, baseUrl).href;
                  return '/api/proxy?url=' + encodeURIComponent(absoluteUrl);
                } catch (e) {
                  return url;
                }
              }

              // Intercept fetch
              const originalFetch = window.fetch;
              window.fetch = function(url, options = {}) {
                url = rewriteUrl(url);
                return originalFetch.call(this, url, options);
              };

              // Intercept XMLHttpRequest
              const originalXHROpen = XMLHttpRequest.prototype.open;
              XMLHttpRequest.prototype.open = function(method, url, ...args) {
                url = rewriteUrl(url);
                return originalXHROpen.call(this, method, url, ...args);
              };

              // Intercept window.location changes
              const originalLocation = window.location;
              Object.defineProperty(window, 'location', {
                get: function() {
                  return originalLocation;
                },
                set: function(url) {
                  const rewrittenUrl = rewriteUrl(url);
                  originalLocation.href = rewrittenUrl;
                }
              });

              // Intercept location.href changes
              let originalHref = originalLocation.href;
              Object.defineProperty(originalLocation, 'href', {
                get: function() {
                  return originalHref;
                },
                set: function(url) {
                  const rewrittenUrl = rewriteUrl(url);
                  originalHref = rewrittenUrl;
                  window.location.replace(rewrittenUrl);
                }
              });

              // Intercept navigation methods
              const originalAssign = originalLocation.assign;
              originalLocation.assign = function(url) {
                const rewrittenUrl = rewriteUrl(url);
                return originalAssign.call(this, rewrittenUrl);
              };

              const originalReplace = originalLocation.replace;
              originalLocation.replace = function(url) {
                const rewrittenUrl = rewriteUrl(url);
                return originalReplace.call(this, rewrittenUrl);
              };

              // Handle form submissions with GET method (like Google search)
              document.addEventListener('submit', function(event) {
                const form = event.target;
                if (form.tagName === 'FORM') {
                  if (form.method.toLowerCase() === 'get') {
                    event.preventDefault();
                    const formData = new FormData(form);
                    const params = new URLSearchParams();
                    for (const [key, value] of formData.entries()) {
                      params.append(key, value);
                    }
                    const actionUrl = form.action || window.location.href;
                    const fullUrl = actionUrl + (actionUrl.includes('?') ? '&' : '?') + params.toString();
                    window.location.href = rewriteUrl(fullUrl);
                  } else {
                    // For POST forms, rewrite the action URL
                    if (form.action && !form.action.startsWith('/api/proxy')) {
                      form.action = rewriteUrl(form.action);
                    }
                  }
                }
              }, true);

              // Intercept link clicks to handle any missed rewrites
              document.addEventListener('click', function(event) {
                const link = event.target.closest('a[href]');
                if (link && !link.href.startsWith('/api/proxy') && !link.href.startsWith('javascript:') && !link.href.startsWith('#')) {
                  event.preventDefault();
                  const rewrittenUrl = rewriteUrl(link.href);
                  window.location.href = rewrittenUrl;
                }
              }, true);

              // Additional interception for any navigation that might be missed
              window.addEventListener('beforeunload', function(event) {
                // This won't prevent the navigation but helps us debug
                console.log('Page unloading, current URL:', window.location.href);
              });

              // Override pushState and replaceState for single-page apps
              const originalPushState = history.pushState;
              const originalReplaceState = history.replaceState;
              
              history.pushState = function(state, title, url) {
                if (url) {
                  url = rewriteUrl(url);
                }
                return originalPushState.call(this, state, title, url);
              };
              
              history.replaceState = function(state, title, url) {
                if (url) {
                  url = rewriteUrl(url);
                }
                return originalReplaceState.call(this, state, title, url);
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
