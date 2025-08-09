module.exports = {
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
    'git add',
  ],
  '*.{json,md,yml,yaml}': [
    'prettier --write',
    'git add',
  ],
  '*.{ts,tsx}': [
    'bash -c "tsc --noEmit"',
  ],
  'server/**/*.{ts,tsx}': [
    'npm run test:unit -- --run --related',
  ],
};