
const fs = require('fs')
const path = require('path')

let utf16ToInt8Map = []
const utf16ToInt8 = require('./makeCodeTable/utf16ToInt8.js')

let unsuported = []

let encodings = fs.readdirSync('icu/icu4c/source/data/mappings', 'utf-8')
                  .filter(name=>name.endsWith('.ucm'))
                  .map(name=>name.slice(0, -4))
                  .filter(name=>!name.includes('icu-internal'))

let regex = /<subchar>\s*\\x([0-9A-Fa-f][0-9A-Fa-f])/
let mapping = {}
for(let encoding of encodings){
    encodingPath = path.join('icu/icu4c/source/data/mappings', encoding + '.ucm')
    let data = fs.readFileSync(encodingPath, 'utf-8')
    let subchar = regex.exec(data)?.[1]
    if(!subchar){
        subchar = '1A'
    }
    mapping[encoding] = Number.parseInt(subchar, 16)
}

let json = JSON.parse(fs.readFileSync('encodings.json', 'utf-8'))
json['subchar'] = mapping
fs.writeFileSync('encodings.json', JSON.stringify(json, null, 4), 'utf-8')