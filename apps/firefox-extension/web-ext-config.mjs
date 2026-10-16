/** @type {import('web-ext').Config} */
export default {
  // Distribution zip: runtime add-on files only.
  // AMO source zip is produced separately via `npm run pack:source` / pack-source.sh.
  ignoreFiles: [
    'package.json',
    'package-lock.json',
    '.npmrc',
    'README.md',
    'build.sh',
    'pack-source.sh',
    'web-ext-config.mjs',
    '**/*.test.js',
  ],
};
