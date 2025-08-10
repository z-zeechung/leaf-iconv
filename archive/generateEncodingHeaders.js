
const fs = require('fs');

const encodings = require('./encodings.json');

const utf16ToInt8 = require('./makeCodeTable/utf16ToInt8.js')

for(let encoding of encodings.wctomb.utf16ToInt8){
    console.log(`generating ${encoding}...`)
    let code = utf16ToInt8(encoding);
    fs.writeFileSync(`wctomb/${encoding}.h`, code)
}