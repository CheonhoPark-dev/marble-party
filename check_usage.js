const fs = require('fs');
const content = fs.readFileSync('apps/web/src/App.jsx', 'utf8');

// Get keys from en as reference
const translationsMatch = content.match(/const TRANSLATIONS = (\{[\s\S]*?\n\})/);
const translationsText = translationsMatch[1];
const TRANSLATIONS = eval(`(${translationsText})`);

function getAllKeys(obj, prefix = '') {
  let keys = [];
  if (typeof obj !== 'object' || obj === null) return keys;
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value !== 'function') {
      keys = keys.concat(getAllKeys(value, path));
    }
  }
  return keys;
}

const definedKeys = new Set(getAllKeys(TRANSLATIONS.en));

// Find usages like t.home.title or t['home']['title']
// This is a bit complex for a regex, but we can look for "t." followed by word characters and dots
const usages = content.match(/t\.[a-zA-Z0-9._]+/g) || [];
const uniqueUsages = new Set(usages.map(u => u.slice(2)));

const missingUsages = [];
uniqueUsages.forEach(u => {
    // If it's a prefix (like "home"), it's fine if it's used as an object
    // but usually we care about the leaf nodes.
    // Let's just check if the path exists.
    if (!definedKeys.has(u)) {
        missingUsages.push(u);
    }
});

console.log('Missing usages in code:');
missingUsages.forEach(u => console.log(`  - ${u}`));
