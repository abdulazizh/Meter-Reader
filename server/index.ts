import express from "express";
import type { Request, Response, NextFunction } from "express";
import session from "express-session";
import multer from "multer";
import { registerRoutes } from "./routes";
import { registerAdminRoutes } from "./adminRoutes";
import * as fs from "fs";
import * as path from "path";
import { networkInterfaces } from "os";

const app = express();
app.set('trust proxy', true); // Trust Render's proxy for secure cookies
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origin = req.header("origin");
    
    // Log every request to see if it even reaches the server
    console.log(`[DEBUG] ${req.method} ${req.path} from ${req.ip} (Origin: ${origin || 'none'})`);

    // Standard CORS headers
    res.header("Access-Control-Allow-Origin", origin || "*");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.header(
      "Access-Control-Allow-Headers", 
      "Content-Type, Authorization, X-Requested-With, Accept, Origin, expo-platform, expo-protocol-version, expo-sfv-version"
    );
    res.header("Access-Control-Expose-Headers", "expo-protocol-version, expo-sfv-version, Set-Cookie");

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      limit: '50mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ limit: '50mb', extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    log(`ERROR: Manifest not found for ${platform} at ${manifestPath}`);
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  const manifestContent = fs.readFileSync(manifestPath, "utf-8");
  
  // Set required Expo Updates protocol headers
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("cache-control", "private, no-cache, no-store, must-revalidate");
  res.setHeader("pragma", "no-cache");
  res.setHeader("expires", "0");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "expo-protocol-version, expo-sfv-version");
  res.setHeader("content-type", "application/json; charset=utf-8");

  log(`Serving manifest for ${platform} (${manifestContent.length} bytes)`);
  res.send(manifestContent);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    // Set Expo protocol headers if requested or if it's an Expo path
    const isExpoRequest = req.header("expo-protocol-version") || 
                         req.path.includes("_expo") || 
                         req.path.includes("bundle.js") ||
                         req.path === "/android" || 
                         req.path === "/ios" || 
                         req.path === "/manifest";

    if (isExpoRequest) {
      res.setHeader("expo-protocol-version", "1");
      res.setHeader("expo-sfv-version", "0");
    }

    const path = req.path.replace(/\/$/, "");
    const platform = req.header("expo-platform") || req.query.platform as string;

    if (path === "/android" || (path === "/manifest" && platform === "android")) {
      log(`Manifest request for android from ${req.ip}`);
      return serveExpoManifest("android", res);
    }

    if (path === "/ios" || (path === "/manifest" && platform === "ios")) {
      log(`Manifest request for ios from ${req.ip}`);
      return serveExpoManifest("ios", res);
    }

    if (platform && (platform === "ios" || platform === "android")) {
      log(`Manifest request for ${platform} via header/query from ${req.ip}`);
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    // Log other requests to see what Expo Go is looking for
    if (req.path.includes("_expo") || req.path.includes("bundle.js")) {
      log(`Expo asset request: ${req.path}`);
    }

    next();
  });

  // Logger for Expo assets to track what Expo Go is requesting
  app.use((req, res, next) => {
    if (req.path.includes("_expo") || req.path.includes("bundle.js")) {
      const fullPath = path.join(process.cwd(), "static-build", req.path);
      const exists = fs.existsSync(fullPath);
      log(`Expo Asset Request: ${req.path} - Exists: ${exists} - IP: ${req.ip}`);
      
      // Ensure protocol headers and CORS for assets
      res.setHeader("expo-protocol-version", "1");
      res.setHeader("expo-sfv-version", "0");
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      if (!exists) {
        log(`CRITICAL: Expo asset not found at ${fullPath}`);
      }
    }
    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build"), {
    setHeaders: (res, path) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (path.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      }
      if (path.endsWith(".json")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      // Add Expo headers to static files too
      res.setHeader("expo-protocol-version", "1");
      res.setHeader("expo-sfv-version", "0");
    }
  }));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    res.status(status).json({ message });

    throw err;
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  
  // Multer configuration for file uploads
  const upload = multer({ dest: 'uploads/' });
  
  const isProd = process.env.NODE_ENV === 'production';
  log(`Session configuration: NODE_ENV=${process.env.NODE_ENV}, secureCookies=${isProd}`);

  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    proxy: true, // Required for secure cookies behind a proxy
    name: 'meter-reader.sid',
    cookie: { 
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));
  
  setupRequestLogging(app);

  registerAdminRoutes(app);
  
  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
      domain: process.env.EXPO_PUBLIC_DOMAIN || "not set"
    });
  });

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      const addresses = [];
      const interfaces = networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        const netInterface = interfaces[name];
        if (netInterface) {
          for (const net of netInterface) {
            if (net.family === 'IPv4') {
              addresses.push(`http://${net.address}:${port}`);
            }
          }
        }
      }
      log(`express server serving on port ${port}`);
      log(`Available on:`);
      addresses.forEach(addr => log(`  ${addr}`));
    },
  );
})();
