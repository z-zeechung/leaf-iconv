
function parseFormatted (arr) {
    let meta = {}
    let i=0
    for(;i<arr.length;i++) {
        let seg = arr[i]
        if(seg.type == 'meta') {
            if(seg.key==='code_set_name'){
                meta.name = JSON.parse(seg.value)
            }else if(seg.key==='char_name_mask'){
                meta.mask = JSON.parse(seg.value)
            }else if(seg.key==='mb_cur_max'){
                meta.max = JSON.parse(seg.value)
            }else if(seg.key==='mb_cur_min'){
                meta.min = JSON.parse(seg.value)
            }else if(seg.key==='uconv_class'){
                meta.class = JSON.parse(seg.value)
            }else if(seg.key==='subchar'){
                meta.subchar = seg.value.split('\\x').filter(x=>x.length>0).map(x=>Number.parseInt(x, 16))
            }else if(seg.key==='subchar1'){
                meta.subchar1 = seg.value.split('\\x').filter(x=>x.length>0).map(x=>Number.parseInt(x, 16))
            }else if(seg.key==='icu:charsetFamily'){
                meta.family = JSON.parse(seg.value)
            }else if(seg.key==='icu:alias'){
                meta.alias = JSON.parse(seg.value)
            }else if(seg.key==='icu:base'){     // unsupported
                meta.base = JSON.parse(seg.value)
            }else if(seg.key==='icu:state'){    // unsupported
                if(!meta.state) meta.state = []
                meta.state.push(seg.value)
            }else{
                throw new Error('Unknown meta key: ' + seg.key + ' in encoding ucm '+meta.name)
            }
        }else if(seg.type==='charmap'){
            break
        }else{
            throw new Error('Unknown segment type: ' + seg.type + ' in encoding ucm '+meta.name)
        }
    }
    
    let mapping = [{},{},{},{},{}]

    while(arr[i++]?.type==='charmap'){
        for(;i<arr.length;i++){
            let seg = arr[i]
            if(seg.type==='end_charmap'){
                i++
                break
            }
            if(seg.type!=='char'){
                throw new Error('Expected char segment, got ' + seg.type + ' in encoding ucm '+meta.name)
            }
            let {wc, mb, kind: type} = seg
            switch(type){
                case 0:
                    mapping[0][wc.toString(16).padStart(4, '0').toUpperCase()] = mb
                    break
                case 1:
                    mapping[1][wc.toString(16).padStart(4, '0').toUpperCase()] = mb
                    break
                case 2:
                    mapping[2][wc.toString(16).padStart(4, '0').toUpperCase()] = mb
                    break
                case 3:
                    mapping[3][wc.toString(16).padStart(4, '0').toUpperCase()] = mb
                    break
                case 4:
                    mapping[4][wc.toString(16).padStart(4, '0').toUpperCase()] = mb
                    break
                default:
                    throw new Error('Unknown char type: ' + type + ' in encoding ucm '+meta.name)
            }
        }
    }

    if(i!=arr.length+1){
        throw new Error(`bad format ucm with remaining sequences: ${JSON.stringify(arr.slice(i))} in ${meta.name}`)
    }

    return {meta, mapping}
}

module.exports = parseFormatted

if(require.main == module) {
    const fs = require('fs')
    for(let name of fs.readdirSync('mappings', 'utf-8')){
        if(name.startsWith('icu-internal')) continue
        if(!name.endsWith('.ucm')) continue
        const data = fs.readFileSync('mappings/'+name, 'utf-8')
        console.log(name)
        parseFormatted(require('./formatParser.js')(data))
    }
    // console.log(JSON.stringify(parseFormatted(require('./formatParser.js')(require('fs').readFileSync('mappings/gb18030-2022.ucm', 'utf-8'))), null, 4))
}