import { Router } from 'express';
import { openApiSpec } from '../docs/openapi';
import { ResponseUtils } from '../utils/ResponseUtils';

const router = Router();

// Serve OpenAPI specification
router.get('/openapi.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  ResponseUtils.success(res, openApiSpec);
});

// Serve Swagger UI (simple HTML page)
router.get('/swagger', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinanceHub Pro API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { background-color: #1f2937; }
        .swagger-ui .topbar .download-url-wrapper { display: none; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: '/api/docs/openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
            ],
            layout: "StandaloneLayout",
            validatorUrl: null,
            tryItOutEnabled: true,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
            onComplete: function() {
                console.log('Swagger UI loaded successfully');
            }
        });
    </script>
</body>
</html>`;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(swaggerHtml);
});

// API documentation landing page
router.get('/', (req, res) => {
  const docsHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinanceHub Pro API Documentation</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
        }
        .header { text-align: center; margin-bottom: 40px; }
        .version { 
            display: inline-block; 
            background: #007bff; 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 0.8em;
        }
        .endpoint { 
            background: #f8f9fa; 
            padding: 15px; 
            margin: 10px 0; 
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
        .method { 
            display: inline-block; 
            padding: 2px 8px; 
            border-radius: 4px; 
            font-weight: bold; 
            font-size: 0.8em;
        }
        .get { background: #28a745; color: white; }
        .post { background: #ffc107; color: black; }
        .put { background: #17a2b8; color: white; }
        .delete { background: #dc3545; color: white; }
        .nav-links { display: flex; gap: 20px; justify-content: center; margin: 30px 0; }
        .nav-links a { 
            padding: 10px 20px; 
            background: #007bff; 
            color: white; 
            text-decoration: none; 
            border-radius: 5px;
        }
        .nav-links a:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>FinanceHub Pro API</h1>
        <span class="version">v2.0.0</span>
        <p>Advanced financial intelligence platform API</p>
    </div>

    <div class="nav-links">
        <a href="/api/docs/swagger">Interactive Documentation</a>
        <a href="/api/docs/openapi.json">OpenAPI Spec</a>
        <a href="/api/v1/health">API Health</a>
    </div>

    <h2>Available Endpoints</h2>

    <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/v1/ai-summary</strong>
        <p>Get AI-powered market analysis and insights</p>
    </div>

    <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/v1/sectors</strong>
        <p>Get current sector ETF performance data</p>
    </div>

    <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/v1/stocks/{symbol}</strong>
        <p>Get real-time stock quote for a specific symbol</p>
    </div>

    <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/v1/stocks/{symbol}/history</strong>
        <p>Get paginated historical price data</p>
    </div>

    <div class="endpoint">
        <span class="method get">GET</span>
        <strong>/api/v1/technical/{symbol}</strong>
        <p>Get technical indicators (RSI, MACD, Bollinger Bands)</p>
    </div>

    <h2>API Versions</h2>
    <p><strong>v1</strong>: Stable version with core functionality</p>
    <p><strong>v2</strong>: Latest version with enhanced features (current)</p>

    <h2>Rate Limits</h2>
    <p>v1: 100 requests per 15 minutes</p>
    <p>v2: 200 requests per 15 minutes</p>

    <h2>Authentication</h2>
    <p>Include your API key in the <code>X-API-Key</code> header for authenticated endpoints.</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(docsHtml);
});

export { router as docsRoutes };