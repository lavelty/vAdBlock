const fs = require('fs');
const text = fs.readFileSync('t.js', 'utf8');
const strings = text.match(/[\"'](.*?)[\"']/g);
if (strings) {
    const unique = [...new Set(strings.map(s => s.slice(1, -1)))];
    unique.filter(s => s.toLowerCase().includes('twitter') || s.toLowerCase().includes('gtm') || s.toLowerCase().includes('facebook')).forEach(s => console.log(s));
}
