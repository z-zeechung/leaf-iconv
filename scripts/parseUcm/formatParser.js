
const commentRegex = /(.*)#.*/

const metaRegex = /<([A-Za-z0-9:_-]+)>\s*(.*)/
const charRegex = /<U([A-Fa-f0-9]+)>\s+((\\x[A-Fa-f0-9]{2})+)\s+\|([0-4])/

function formatParser (content) {
    let lns = content.split('\n')
    lns = lns.map(ln=>ln.trim())

    lns = lns.filter(ln=>!ln.startsWith('#'))
    lns = lns.map(ln=>commentRegex.test(ln)?commentRegex.exec(ln)[1]:ln)
    lns = lns.map(ln=>ln.trim()).filter(ln=>ln.length>0)

    lns = lns.map(ln=>{
        if(ln==='CHARMAP') return {type: 'charmap'}
        if(ln==='END CHARMAP') return {type: 'end_charmap'}
        if(charRegex.test(ln)) {
            let [_, wc, mb, __, kind] = charRegex.exec(ln)
            wc = Number.parseInt(wc, 16)
            mb = mb.split('\\x').filter(x=>x.length>0).map(x=>Number.parseInt(x, 16))
            kind = Number.parseInt(kind)
            return {type: 'char', wc, mb, kind}
        }
        if(metaRegex.test(ln)) {
            const [_, key, value] = metaRegex.exec(ln)
            return {type: 'meta', key, value}
        }
        throw new Error(`Unknown line: ${ln}`)
    })

    return lns
}

if(require.main === module) {
    console.log(formatParser(require('fs').readFileSync('mappings/gb18030-2022.ucm', 'utf-8')))
}

module.exports = formatParser