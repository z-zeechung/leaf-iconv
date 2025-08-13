
const fs = require('fs');
const path = require('path');

const xml2js = require('xml2js');
const parser = new xml2js.Parser();

const aliases = JSON.parse(fs.readFileSync('./meta/aliases.json', 'utf8'))

let types = {
    sbcs: [],
    unknown: [],
}

;(async()=>{
    for(let key in aliases) {
        if(!fs.existsSync(`./meta/xml/${key}.xml`)){
            types.unknown.push(key)
            continue;
        }
        const xml = await parser.parseStringPromise(fs.readFileSync(`./meta/xml/${key}.xml`, 'utf8'));
        if(!xml.characterMapping.assignments[0].a){
            types.unknown.push(key)
            continue;
        }
        let valid = true;
        for(let { '$': { u, b } } of xml.characterMapping.assignments[0].a){
            if(u?.length!==4 || b?.length!==2){
                valid = false;
                break
            } 
        }
        if(!valid){
            types.unknown.push(key)
            continue;
        }
        types.sbcs.push(key)
    }

    fs.writeFileSync('./meta/encodings.json', JSON.stringify({classes: types}, null, 4), 'utf8')
})()