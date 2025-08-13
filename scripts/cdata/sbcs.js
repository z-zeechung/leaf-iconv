
const fs = require('fs');

const xml2js = require('xml2js');
const parser = new xml2js.Parser();

async function wctomb(name){
    const xml = await parser.parseStringPromise(fs.readFileSync(`./meta/xml/${name}.xml`, 'utf8'));
    let mapping = {}
    for(let { '$': { u, b } } of xml.characterMapping.assignments[0].a){
        let highByte = u.slice(0, 2);
        let lowByte = u.slice(2, 4);
        if(!mapping[highByte]){
            mapping[highByte] = {}
        }
        mapping[highByte][lowByte] = b
    }

    mapping = Object.entries(mapping)
    mapping = mapping.sort((a, b) => Object.keys(b[1]).length - Object.keys(a[1]).length)

    let highMapping = Array.from({length:256}).map(_=>'00')
    mapping.forEach(([highMap, _], idx)=>{
        highMapping[Number.parseInt(highMap, 16)] = (idx+1).toString(16).padStart(2, '0')
    })

    let level2Mapping = []
    level2Mapping.push(Array.from({length:256}).map(_=>'00'))

    for(let [high, lows] of mapping){
        let lowMapping = Array.from({length:256}).map(_=>'00')
        for(let [low, b] of Object.entries(lows)){
            lowMapping[Number.parseInt(low, 16)] = b
        }
        level2Mapping.push(lowMapping)
    }

    name = name.replaceAll('-', '_').replaceAll('.', '_')
    let NAME = name.toUpperCase()

    let code = 
`
# ifndef ZICONV_${NAME}_WCTOMB_H
# define ZICONV_${NAME}_WCTOMB_H

static const unsigned char ${name}_wctomb_high[] = {
${toCmap(highMapping)}
};

static const unsigned char ${name}_wctomb_low[] = {
${level2Mapping.map(toCmap).join('\n')}
};

# endif // ZICONV_${NAME}_WCTOMB_H
`

    return code
}

function toCmap(mapping){
    let cmap = ''
    for(let i=0;i<16;i++){
        cmap += `    `
        for(let j=0;j<16;j++){
            cmap += `0x${mapping[i*16+j]}, `
        }
        cmap += '\n'
    }
    return cmap
}

module.exports = {
    wctomb
}