
const fs = require('fs');

if(fs.existsSync('meta')){
    fs.rmSync('meta', { recursive: true, force: true });
}

fs.mkdirSync('meta');