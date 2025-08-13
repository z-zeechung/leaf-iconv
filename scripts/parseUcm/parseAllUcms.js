
const formatParser = require('./formatParser.js')
const parseFormatted = require('./parseFormatted.js')

const fs = require('fs')

function parseAllUcms () {
    fs.rmSync('metadata', {recursive: true, force: true})
    fs.mkdirSync('metadata')
    for(let name of fs.readdirSync('mappings', 'utf-8')){
        if(name.startsWith('icu-internal')) continue
        if(!name.endsWith('.ucm')) continue
        const data = fs.readFileSync('mappings/'+name, 'utf-8')
        const {meta, mapping} = parseFormatted(formatParser(data))
        meta.mapping = mapping
        fs.writeFileSync(`metadata/${meta.name}.json`, JSON.stringify(meta, null, 4))
    }
}

parseAllUcms()