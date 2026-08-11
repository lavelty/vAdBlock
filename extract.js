const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
const regex = /<script\b[^>]*src=[\"'](.*?)[\"'][^>]*>/gi;
let match;
while ((match = regex.exec(html)) !== null) {
    console.log(match[1]);
}
