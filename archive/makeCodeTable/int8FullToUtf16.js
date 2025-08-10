
const parseCharMap = require('./parseCharMap');

function int8ToUtf16(name) {
    const charMap = parseCharMap(name);
    
    let map = {};
    for(let [unicode, char, type] of charMap) {
        if(type === 1 || type === 2){
            continue
        }
        if(char.length !== 2){
            throw new Error(`char code length is not 2: ${char}`);
        }
        if(unicode.length !== 4){
            throw new Error(`unicode length is not 4: ${unicode}`)
        }
        char = Number.parseInt(char, 16)
        if(map[char]){
            continue
        }
        map[char] = unicode
    }

    let arr = [];
    for(let i=0;i<=Math.max(...Object.keys(map));i++){
        if(!map[i]){
            throw new Error(`missing code point: ${i}`)
        }
        arr[i] = map[i]
    }

    let identifier = name.replaceAll('-', '_');
    let IDENTIFIER = identifier.toUpperCase();

    let table = ''
    for(let i=0;i<arr.length;i++){
        if(i % 8 === 0){
            table += '    '
        }
        table += `0x${arr[i]}, `
        if(i!=arr.length-1 && (i+1) % 8 === 0){
            table += '\n'
        }
    }

    let code = 
`
#ifndef ZICONV_${IDENTIFIER}_MBTOWC_H
#define ZICONV_${IDENTIFIER}_MBTOWC_H

#include <stdint.h>

static const uint16_t ${identifier}_mbtowc_table[] = {
${table}
};

#endif // ZICONV_${IDENTIFIER}_MBTOWC_H
`
}