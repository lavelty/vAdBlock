const fs = require('fs');
const html = fs.readFileSync('test_pup.html', 'utf8');
let missing = [];
let rules = fs.readFileSync('rules.json', 'utf8');

let match = html.match(/\[([^\]]*facebook\.net[^\]]*)\]/is);
if (match) {
    const arr = match[1].split(',').map(s => s.trim().replace(/['\"]/g, ''));
    arr.forEach(domain => {
        if (!rules.includes(domain)) missing.push(domain);
    });
}

match = html.match(/\[([^\]]*googletagmanager[^\]]*)\]/is);
if (match) {
    const arr = match[1].split(',').map(s => s.trim().replace(/['\"]/g, ''));
    arr.forEach(domain => {
        if (!rules.includes(domain)) missing.push(domain);
    });
}
console.log('Missing domains:', missing.join(', '));
