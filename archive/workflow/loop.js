
const attack = require('./attaker.js')
const fix = require('./fixer.js')
const optimize = require('./optimizer.js')
;
(async ()=>{
    while(true){
        try{
            while(true){
                await fix(await attack())
            }
        }catch(e){
            await optimize()
        }
    }
})()