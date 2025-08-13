
const fs = require('fs');

const {wctomb: sbcsWctomb} = require('./sbcs.js');

const encodings = JSON.parse(fs.readFileSync('meta/encodings.json', 'utf8'));
const sbcs = encodings.classes.sbcs;

;(async()=>{
    for(let encoding of sbcs) {
        let code = await sbcsWctomb(encoding);
        fs.writeFileSync(`data/sbcs/wctomb/${encoding}.h`, code, 'utf8')
    }
})()