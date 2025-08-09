
const attack = require('./attaker.js')
const fix = require('./fixer.js')
;
(async ()=>{
    while(true){
        await fix(await attack())   
    }
})()