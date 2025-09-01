# Node.js Version Requirements

## Required Version
**Node.js 18.0.0 or higher is required**

## Current Issue
The deployment environment is using Node.js v16.18.1, which is incompatible with several dependencies:
- `xml-name-validator@5.0.0` requires Node.js >=18
- `zod-validation-error@3.4.0` requires Node.js >=18
- Vite build process requires Node.js >=18 for crypto functions

## Fixes Applied

### 1. Updated Configuration Files
- ✅ `.replit` - Changed from `nodejs-16` to `nodejs-18`
- ✅ `package.json` - Engines requirement: `"node": ">=18.0.0"`
- ✅ `Dockerfile` - Updated to use `node:18-alpine`
- ✅ `runtime.txt` - Created with `nodejs-18.x` specification
- ✅ `.nvmrc` - Created with version `18`

### 2. Added Version Checks
- ✅ `build.sh` - Pre-build Node.js version validation
- ✅ `start-production.js` - Runtime Node.js version validation

### 3. Platform-Specific Instructions

#### Replit Deployment
The `.replit` file has been updated to use `nodejs-18`. Replit should automatically use this version on next deployment.

#### Cloud Run / Docker
The `Dockerfile` uses `node:18-alpine` base image.

#### Heroku / Platform with runtime.txt
The `runtime.txt` file specifies `nodejs-18.x`.

#### Development (nvm users)
Run `nvm use` to automatically switch to Node.js 18.

## Verification
Both build and start scripts now include version checks that will:
1. Detect the current Node.js version
2. Exit with clear error message if version < 18
3. Proceed normally if version >= 18

## Next Steps
1. Redeploy to ensure the deployment environment uses Node.js 18+
2. The build process will now succeed without the crypto errors
3. All dependency warnings about engine mismatches will be resolved