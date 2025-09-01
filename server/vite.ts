import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  console.log(`🔍 [STATIC] serveStatic function called`);
  console.log(`🔍 [STATIC] __dirname value: ${__dirname}`);
  
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  console.log(`🔧 [STATIC DEBUG] Setting up static serving from: ${distPath}`);
  console.log(`🔧 [STATIC DEBUG] Directory exists: ${fs.existsSync(distPath)}`);
  
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    console.log(`🔧 [STATIC DEBUG] Files in directory: ${JSON.stringify(files)}`);
    
    const indexPath = path.join(distPath, 'index.html');
    console.log(`🔧 [STATIC DEBUG] index.html exists: ${fs.existsSync(indexPath)}`);
    if (fs.existsSync(indexPath)) {
      const indexSize = fs.statSync(indexPath).size;
      console.log(`🔧 [STATIC DEBUG] index.html size: ${indexSize} bytes`);
    }
  }

  if (!fs.existsSync(distPath)) {
    const error = new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
    console.error(`❌ [STATIC ERROR] ${error.message}`);
    throw error;
  }

  try {
    console.log(`🔍 [STATIC] Setting up express.static middleware`);
    app.use(express.static(distPath));
    console.log(`✅ [STATIC] express.static middleware set up successfully`);
  } catch (expressStaticError) {
    console.error(`❌ [STATIC] express.static setup failed:`, expressStaticError);
    throw expressStaticError;
  }

  // Add debugging middleware to see what requests come through
  app.use("*", (req, res, next) => {
    if (!req.originalUrl.startsWith('/api') && !req.originalUrl.startsWith('/health')) {
      console.log(`🔧 [STATIC DEBUG] Processing request: ${req.method} ${req.originalUrl}`);
    }
    next();
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (req, res, next) => {
    if (!req.originalUrl.startsWith('/api') && !req.originalUrl.startsWith('/health')) {
      console.log(`🔧 [STATIC DEBUG] Serving fallback index.html for: ${req.originalUrl}`);
      try {
        const indexPath = path.resolve(distPath, "index.html");
        console.log(`🔍 [STATIC] Attempting to serve: ${indexPath}`);
        res.sendFile(indexPath);
      } catch (sendFileError) {
        console.error(`❌ [STATIC] Failed to serve index.html:`, sendFileError);
        next(sendFileError);
      }
    } else {
      next();
    }
  });
}
