
const fs = require('fs');

let data = fs.readFileSync('meta/convrtrs.txt', 'utf-8')

const bracketRegex = /{[\s\S]*?}/g
data = data.replace(bracketRegex, '')

data = data.replaceAll('\t', '    ')

let lns = data.split('\n')

const commentRegex = /(.*?)#.*/
lns = lns.map(ln => ln.match(commentRegex) ? ln.match(commentRegex)[1] : ln)
         .filter(ln => ln.trim().length > 0)

let tuples = []
let buf = ""
for (let ln of lns) {
    if(!ln.startsWith(' ') && buf.length===0){
        buf = ln
    }else if(!ln.startsWith(' ') && buf.length>0){
        tuples.push(JSON.parse(JSON.stringify(buf)))
        buf = ln
    }else if(ln.startsWith(' ')){
        buf += ln
    }
}
if(buf.length>0){
    tuples.push(JSON.parse(JSON.stringify(buf)))
}

let aliases = {}
for (let tup of tuples) {
    tup = tup.split(' ').filter(ln => ln.length>0)
    aliases[tup[0]] = tup.slice(1)
}

fs.writeFileSync('meta/aliases.json', JSON.stringify(aliases, null, 4))