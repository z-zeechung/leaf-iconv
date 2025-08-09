
const fs = require('fs')
const {isArray} = require('util')

const MAX_TRAILS = 10
const CODES = ['ziconv.h', 'src/utf16_to_int8.c']

async function optimize(){

    let bestResult = (require('./testers/testUtf16ToInt8Speed.js'))()
    console.log('Current best Mbs/s:', bestResult)
    
    let history = []

    let system = {role: 'user', content: GENERAL_PROMPT(bestResult)}

    for(let i=0;i < MAX_TRAILS;i++){
        let analyze = await reasoning([system, ...history])
        history.push({role: 'assistant', content: analyze})
        history.push({role: 'user', content: OPTIMIZE_PROMPT})

        let optimizedSegs = await genOptimizedCode([system, ...history])

        let validateResult = validateFixedSegs(optimizedSegs)
        console.log(validateResult)

        if(validateResult.success){
            let newResult = (require('./testers/testUtf16ToInt8Speed.js'))()
            if(newResult > bestResult){
                bestResult = newResult
                console.log('New best Mbs/s:', bestResult)
                history.push({role: 'user', content: `新纪录：${newResult} Mbs/s`})
            }else{
                console.log('New result:', newResult, 'is not faster than best result:', bestResult)
                history.push({role: 'user', content: NOT_FASTER_PROMPT(newResult, bestResult)})
            }
        }else{
            history.push({role: 'user', content: NEGATIVE_PROMPT(validateResult)})
        }
    }
}

const GENERAL_PROMPT = (mbPerS)=>`
/*
限制：
    - 只能修改AIBLOCK区间内的代码，其它代码无权修改。AIBLOCK外
    的代码已经过详细核验，确认无任何问题
    - 修改后的代码应当能通过回归测试
    - 不能引入新的头文件，当然因此也不能使用SIMD指令，不过你仍
    然可以使用SWAR或位魔法等技巧来诱导编译器进行SIMD展开。
    - Use English comments in output C code
*/

你是一个拥有丰富经验的C语言性能优化程序员，现在正在优化一段C语
言字符转换代码。请你尽可能地提高其性能。修复后的代码仍应能够通
过回归测试。

以下是代码实现：
\`\`\`c
${getCodes()}
\`\`\`

这段代码当前的吞吐量为${mbPerS}MB每秒，你的优化实现需要比这更快。
你不必现在就基于编码，你可以先对代码进行分析来确认该如何做优化。
`

const OPTIMIZE_PROMPT = `
既然你已经大概有了性能优化的思路，那么开始动手实施吧。

注意到那些由\`/* AIBLOCK ... */ ... /* ENDAIBLOCK */\`包围的代
码块了吗？你的修改范围被限制在这些代码块区域内。例如，假如你想
修复一个名为foobar的代码块的内容，你只需要输出：
\`\`\` c
/* AIBLOCK foobar */
    // 你修改后的代码
/* ENDAIBLOCK */
\`\`\`

你可以在输出中同时包含多个不同名称的代码块，我们会自动根据你的
输出更新代码。

请注意，在输出的代码块中省略既有代码是不支持的。
`

const NOT_FASTER_PROMPT = (newResult, bestResult)=>`
先前代码性能为${bestResult}MB/s，现在代码性能为${newResult}MB/s。
优化后的代码并未在吞吐量上取得提升，再试一试吧
`

const NEGATIVE_PROMPT = (result) => `
修改后的代码并未能按预期工作……请检查检查问题出在哪里吧。以下是
错误日志：
\`\`\` json
${JSON.stringify(result, replacer)}
\`\`\`
`

function getCodes(){
    let code = ""
    for(let f of CODES){
        if(isArray(f)){
            code += `// ${f[0]}\n`
        }else{
            code += `// ${f}\n${fs.readFileSync(f, 'utf-8')}\n`
        }
    }
    return code
}

const env = require('util').parseEnv(fs.readFileSync('.env', 'utf-8'))

const openai = new (require('openai').OpenAI)({
    apiKey: env.API_KEY,
    baseURL: env.BASE_URL,
})

async function reasoning(messages){
    const stream = await openai.chat.completions.create({
      model: env.REASONER, 
      messages,
      stream: true, 
      temperature: 0.2,
    });
    let stack = ''
    for await (const chunk of stream) {
      const reasoning_content = chunk.choices[0]?.delta?.reasoning_content;
      const content = chunk.choices[0]?.delta?.content;
      if(reasoning_content){
        process.stdout.write('\x1b[94m'+reasoning_content+'\x1b[0m')
      } else if(content) {
        process.stdout.write(content)
        stack += content
      }else{
        // console.log(chunk)
      }
    }
    return stack
}

async function genOptimizedCode(messages){
    const stream = await openai.chat.completions.create({
      model: env.MODEL, 
      messages,
      stream: true, 
      temperature: 0.2,
    });
    let stack = ''
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if(content) {
        process.stdout.write('\x1b[32m'+content+'\x1b[0m')
        stack += content
      }else{
        // console.log(chunk)
      }
    }
    return stack
}

function validateFixedSegs(fixedSegs){
    let originalCode = fs.readFileSync(FILE, 'utf-8')
    let originalBlocks = matchCode(originalCode)
    let fixedBlocks = matchCode(fixedSegs)
    if(Object.keys(fixedBlocks).length === 0){
        return {error: 'No blocks found in fixed code'}
    }
    let fixedCode = JSON.parse(JSON.stringify(originalCode, replacer))
    for(let block in fixedBlocks){
        if(!originalBlocks[block]){
            return {error: `Block ${block} not found in original code`}
        }
        let originalBlock = originalBlocks[block]
        let fixedBlock = fixedBlocks[block]
        if(!originalCode.includes(originalBlock)){
            throw new Error(`Original block ${block} not found in original code`)
        }
        fixedCode = fixedCode.replace(originalBlock, fixedBlock)
    }
    fs.writeFileSync(FILE, fixedCode)

    let ret = {/*testCase,*/ success: true}
    // let result1 = ORACLE.tester(testCase)
    // let result2 = HIEREUS.tester(testCase)
    // ret[ORACLE.name] = result1
    // ret[HIEREUS.name] = result2
    function arrcmp(arr1, arr2){
        if(!arr1 && !arr2) return true
        if(!arr1 && arr2) return false
        if(arr1 && !arr2) return false
        if(arr1.length !== arr2.length) return false
        for(let i = 0; i < arr1.length; i++){
            if(arr1[i] !== arr2[i]) return false
        }
        return true
    }
    // if(arrcmp(result1.result, result2.result)){ 
    // }else{
    //     ret.success = false
    //     fs.writeFileSync(FILE, originalCode, 'utf-8')
    // }

    // regression test
    let json = JSON.parse(fs.readFileSync(DATAFILE, 'utf-8'))
    for(let testCase of json.testCase){
        let result1 = ORACLE.tester(testCase)
        let result2 = HIEREUS.tester(testCase)
        if(!arrcmp(result1.result, result2.result)){
            ret.success = false
            ret['error'] = {
                message: 'regression test case failed',
                testCase: testCase,
                [ORACLE.name]: result1,
                [HIEREUS.name]: result2
            }
            fs.writeFileSync(FILE, originalCode, 'utf-8')
            break
        }
    }

    return ret
}



optimize()