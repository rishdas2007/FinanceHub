import { Request, Response, NextFunction } from 'express';
import { ResponseUtils } from '../utils/ResponseUtils';

// Extend Request interface to include API version
declare global {
  namespace Express {
    interface Request {
      apiVersion?: string;
    }
  }
}

export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
  LATEST: 'v2'
} as const;

type ApiVersion = typeof API_VERSIONS[keyof typeof API_VERSIONS];

// Middleware to extract and validate API version
export function apiVersioning(req: Request, res: Response, next: NextFunction) {
  // Extract version from URL path
  const pathVersion = req.path.match(/^\/api\/(v\d+)\//)?.[1] as ApiVersion;
  
  // Extract version from Accept header (e.g., application/vnd.financehub.v2+json)
  const acceptHeader = req.get('Accept') || '';
  const headerVersion = acceptHeader.match(/vnd\.financehub\.(v\d+)/)?.[1] as ApiVersion;
  
  // Extract version from custom header
  const customVersion = req.get('API-Version') as ApiVersion;
  
  // Priority: URL > Custom Header > Accept Header > Default to latest
  let version: ApiVersion = pathVersion || customVersion || headerVersion || API_VERSIONS.LATEST;
  
  // Validate version
  if (!Object.values(API_VERSIONS).includes(version)) {
    return ResponseUtils.badRequest(res, `Unsupported API version: ${version}. Supported versions: ${Object.values(API_VERSIONS).join(', ')}`);
  }
  
  // Set version in request
  req.apiVersion = version;
  
  // Add version to response headers
  res.setHeader('API-Version', version);
  res.setHeader('Supported-Versions', Object.values(API_VERSIONS).join(', '));
  
  next();
}

// Middleware to handle version deprecation warnings
export function versionDeprecation(deprecatedVersions: ApiVersion[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.apiVersion;
    
    if (version && deprecatedVersions.includes(version)) {
      res.setHeader('Warning', `299 - "API version ${version} is deprecated. Please upgrade to ${API_VERSIONS.LATEST}"`);
      res.setHeader('Sunset', new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()); // 90 days from now
    }
    
    next();
  };
}

// Content negotiation for different response formats
export function contentNegotiation(req: Request, res: Response, next: NextFunction) {
  const acceptHeader = req.get('Accept') || '';
  
  // Default to JSON
  let responseFormat = 'json';
  
  // Check if client accepts different formats
  if (acceptHeader.includes('application/xml')) {
    responseFormat = 'xml';
  } else if (acceptHeader.includes('text/csv')) {
    responseFormat = 'csv';
  }
  
  // Store format in request for use in controllers
  (req as Request & { responseFormat?: string }).responseFormat = responseFormat;
  
  next();
}

// Rate limiting per API version
export function versionedRateLimit() {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.apiVersion;
    
    // Different rate limits for different versions
    const rateLimits = {
      [API_VERSIONS.V1]: { requests: 100, window: 15 * 60 * 1000 }, // 100 per 15 min
      [API_VERSIONS.V2]: { requests: 200, window: 15 * 60 * 1000 }  // 200 per 15 min (more generous for newer version)
    };
    
    const limit = rateLimits[version as keyof typeof rateLimits];
    if (limit) {
      // In a real implementation, you'd check against your rate limiting store
      res.setHeader('X-RateLimit-Limit', limit.requests.toString());
      res.setHeader('X-RateLimit-Window', (limit.window / 1000).toString());
    }
    
    next();
  };
}