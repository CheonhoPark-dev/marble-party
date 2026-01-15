const fs = require('fs');
const content = fs.readFileSync('apps/web/src/App.jsx', 'utf8');
const translationsMatch = content.match(/const TRANSLATIONS = (\{[\s\S]*?\n\})/);
const translationsText = translationsMatch[1];
const TRANSLATIONS = eval(`(${translationsText})`);
const langs = ['en', 'ko', 'ja', 'zh'];

function getAllKeys(obj, prefix = '') {
  let keys = [];
  if (typeof obj !== 'object' || obj === null) return keys;
  for (const key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    keys.push(path);
    const value = obj[key];
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          keys = keys.concat(getAllKeys(item, `${path}[${index}]`));
        }
      });
    } else if (typeof value === 'object' && typeof value !== 'function') {
      keys = keys.concat(getAllKeys(value, path));
    }
  }
  return keys;
}

langs.forEach(lang => {
    console.log(`${lang} has ${getAllKeys(TRANSLATIONS[lang]).length} keys.`);
});
