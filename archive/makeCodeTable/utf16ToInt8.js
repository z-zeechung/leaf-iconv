
const parseCharMap = require('./parseCharMap');

function utf16ToInt8(name){
    const charMap = parseCharMap(name)

    let map = {}

    for(let [unicode, char, type] of charMap) {
        if(unicode.length !== 4){
            throw new Error('unicode length is not 4:' + unicode)
        }
        if(char.length !== 2){
            throw new Error('char length is not 2:' + char)
        }
        if(type === '3' || type === '2' || type === '1'){
            continue
        }

        let high16 = unicode.slice(0, 2)
        let low16 = unicode.slice(2, 4)
        
        if(!map[high16]){
            map[high16] = {}
        }

        map[high16][low16] = char
    }

    map = Object.entries(map).sort((a, b) => {
        let lenA = Object.keys(a[1]).length
        let lenB = Object.keys(b[1]).length

        if(a[0] === 'FF') lenA = -1
        if(b[0] === 'FF') lenB = -1

        return lenB - lenA
    })

    let pageCount = map.length
    let highBytesMap = {}
    for(let i = 1; i <= pageCount; i++){
        highBytesMap[map[i-1][0]] = i.toString(16).padStart(2, '0').toUpperCase()
    }

    let highBytesMapArr = []
    for(let i=0;i<256;i++){
        let idx = i.toString(16).padStart(2, '0').toUpperCase()
        if(highBytesMap[idx]){
            highBytesMapArr.push(highBytesMap[idx])
        }else{
            highBytesMapArr.push('00')
        }
    }

    let codePageArrs = []
    codePageArrs.push([`Invalid`, Array.from({length:256}).map(() => '00')])
    for(let page of map){
        let [high, lows] = page
        let lowArr = []
        for(let i=0;i<256;i++){
            let idx = i.toString(16).padStart(2, '0').toUpperCase()
            if(lows[idx]){
                lowArr.push(lows[idx])
            }else{
                lowArr.push('00')
            }
        }
        codePageArrs.push([high, lowArr])
    }

    let encodeName = name.replaceAll('-', '_').replaceAll('.', '_')
    let ENCODE_NAME = encodeName.toUpperCase()

    let code = 
`
#ifndef ZICONV_${ENCODE_NAME}_WCTOMB_H
#define ZICONV_${ENCODE_NAME}_WCTOMB_H

static const char ${encodeName}_wctomb_high[] = {
${toCArrCode('highBytesMap', highBytesMapArr)}
};

static const char ${encodeName}_wctomb_low[] = {
${codePageArrs.map(([high, lowArr]) => toCArrCode(high, lowArr)).join('\n')}
};

#endif /* ZICONV_${ENCODE_NAME}_WCTOMB_H */
`

    return code
}

function toCArrCode(title, bits){
    if(bits.length !== 256){
        throw new Error(title, 'bits.length !== 256:', bits.length)
    }
    let code = `  /* ${title} */\n`
    for(let i = 0; i < 256; i++){
        if(i % 16 === 0){
            code += '    '
        }
        code += '0x'+bits[i] + ', '
        if(i % 16 === 15 && i !== 255){
            code += '\n'
        }
    }
    return code
}

module.exports = utf16ToInt8