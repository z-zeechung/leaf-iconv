
const fs = require('fs')
const path = require('path')

let utf16ToInt8Map = []
const utf16ToInt8 = require('./makeCodeTable/utf16ToInt8.js')

let unsuported = []

let encodings = fs.readdirSync('icu/icu4c/source/data/mappings', 'utf-8')
                  .filter(name=>name.endsWith('.ucm'))
                  .map(name=>name.slice(0, -4))
                  .filter(name=>!name.includes('icu-internal'))

for(let encoding of encodings){
    try{
        utf16ToInt8(encoding)
        utf16ToInt8Map.push(encoding)
        console.log(`${encoding} is a utf16ToInt8 encoding`)
        continue
    }catch{}
    unsuported.push(encoding)
    console.log(`${encoding} is an unsupported encoding`)
}

let payload = {
    ...JSON.parse(fs.readFileSync('encodings.json', 'utf-8')),
    wctomb: {
        utf16ToInt8: utf16ToInt8Map,
        unsuported: unsuported
    },
}

fs.writeFileSync('encodings.json', JSON.stringify(payload, null, 4), 'utf-8')