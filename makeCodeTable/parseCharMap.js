
const fs = require('fs');
const path = require('path');

let re = /<U([A-F0-9]+)> ((\\x[0-9A-F][0-9A-F])+) \|([0-3])/

function parseCharMap(name) {
    let data = fs.readFileSync(`icu/icu4c/source/data/mappings/${name}.ucm`, 'utf-8')

    data = data.split('\n')

    let ret = []

    let parsingMap = false;
    for(let ln of data) {
        ln = ln.replace('\r', '')
        if(ln.trim() == 'CHARMAP'){
            parsingMap = true;
            continue
        }
        if(ln.trim() == 'END CHARMAP'){
            break;
        }
        if(ln.trim().startsWith('#') || ln.trim() == ''){
            continue
        }
        if(parsingMap){
            if(!re.test(ln)){
                throw new Error(`Could not parse line: ${ln}`)
            }
            let m = ln.match(re)
            ret.push([
                m[1],
                cleanMbCode(m[2]),
                m[m.length-1]
            ])
        }
    }

    return ret
}

function cleanMbCode(code){
    return code.replaceAll('\\x', '')
}

module.exports = parseCharMap