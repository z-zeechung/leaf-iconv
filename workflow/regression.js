
const ORACLE = {name: 'icu', tester: require('./testers/testUconv.js')}
const HIEREUS = {name: 'ziconv', tester: require('./testers/testUtf16ToInt8.js')}
const json = require('./data/testUtf16ToInt8.json')

for(let testCase of json.testCase){
    let result1 = ORACLE.tester(testCase)
    let result2 = HIEREUS.tester(testCase)
    console.log(result1)
    console.log(result2)
}