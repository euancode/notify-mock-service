// Very small stand-in for Notify's Jinja-based personalisation engine:
// replaces ((key)) placeholders with values from the personalisation object.
function render(text, personalisation = {}) {
  if (!text) return text;
  return text.replace(/\(\(\s*([a-zA-Z0-9_]+)\s*\)\)/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(personalisation, key)) {
      return String(personalisation[key]);
    }
    return match;
  });
}

function missingPlaceholders(text, personalisation = {}) {
  if (!text) return [];
  const found = new Set();
  const re = /\(\(\s*([a-zA-Z0-9_]+)\s*\)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!Object.prototype.hasOwnProperty.call(personalisation, m[1])) {
      found.add(m[1]);
    }
  }
  return [...found];
}

module.exports = { render, missingPlaceholders };
