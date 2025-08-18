// Deployment safety utilities for graceful degradation

export interface SafeApiResponse<T = any> {
  success: boolean;
  data: T;
  warning?: string;
  message?: string;
}

/**
 * Safely import a module with fallback for deployment environments
 * @param modulePath Module path to import
 * @param fallback Fallback value if import fails
 * @returns Imported module or fallback
 */
export async function safeImport<T = any>(
  modulePath: string, 
  fallback: T
): Promise<T> {
  try {
    const module = await import(modulePath);
    return module;
  } catch (error) {
    console.error(`[safeImport] Failed to import ${modulePath}:`, error);
    return fallback;
  }
}

/**
 * Wrap API handlers with deployment safety
 * @param handler The async handler function
 * @param fallbackData Fallback data to return on error
 * @returns Safe response or fallback
 */
export function withDeploymentSafety<T = any>(
  handler: (req: any, res: any) => Promise<void>,
  fallbackData: T = [] as T
) {
  return async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('[withDeploymentSafety] Handler failed:', error);
      
      // Return graceful fallback instead of 500 error
      const safeResponse: SafeApiResponse<T> = {
        success: true,
        data: fallbackData,
        warning: "data_temporarily_unavailable",
        message: "Service temporarily unavailable, please try again in a moment"
      };
      
      res.status(200).json(safeResponse);
    }
  };
}

/**
 * Validate build artifacts exist
 * @param paths Array of critical paths to check
 * @returns Validation results
 */
export function validateBuildArtifacts(paths: string[]): { valid: boolean; missing: string[] } {
  const fs = require('fs');
  const missing: string[] = [];
  
  for (const path of paths) {
    try {
      if (!fs.existsSync(path)) {
        missing.push(path);
      }
    } catch (error) {
      missing.push(path);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}