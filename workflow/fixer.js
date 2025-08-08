
const fs = require('fs')
const { isArray } = require('util')

const MAX_TRAILS = 48
const ORACLE = {name: 'icu', tester: require('./testers/testUconv.js')}
const HIEREUS = {name: 'ziconv', tester: require('./testers/testUtf16ToInt8.js')}
const CODES = ['ziconv.h', 'src/utf16_to_int8.c']
const FILE = './src/utf16_to_int8.c'
const DATAFILE = 'workflow/data/testUtf16ToInt8.json'

async function fix(testResult){

    let history = []

    let system = {role: 'user', content: GENERAL_PROMPT(testResult)}

    for(let i=0;i < MAX_TRAILS;i++){

        if(i%3==0){
            let analyze = await reasoning([system, ...history])
            history.push({role: 'assistant', content: analyze})
            history.push({role: 'user', content: FIX_PROMPT})
        }

        let fixedSegs = await genFixedCode([system, ...history])
        history.push({role: 'assistant', content: fixedSegs})

        let validateResult = validateFixedSegs(fixedSegs, testResult.testCase)
        console.log(validateResult)

        if(validateResult.success){
            addToTestCases(testResult.testCase)
            return
        }

        history.push({role: 'user', content: NEGATIVE_PROMPT(validateResult)})

        if(history.length > 24){
            history = history.slice(-16)
        }
    }

    throw new Error('failed to fix with this test case: ' + JSON.stringify(testCase))
}


const GENERAL_PROMPT = (testResult)=>`

/*
限制：
    - 只能修改AIBLOCK区间内的代码，其它代码无权修改。AIBLOCK外
    的代码已经过详细核验，确认无任何问题
    - 专注于当前测试用例的修复
    - 修改后的代码应当能通过回归测试
    - 不能引入新的头文件
    - Use English comments in output C code
*/

你是一个拥有十年经验的老C程序员，熟悉C语言的各种特性，擅长解决
疑难杂症。以下是你同事刚刚给你发来的测试用例，这个测试用例在我
们的实现上与神谕测试表现不一致。以下是测试用例的内容及运行结果：
\`\`\` json
// ${ORACLE.name}为神谕实现，${HIEREUS.name}为我们的实现
// testCase为输入的测试用例
${JSON.stringify(testResult)}
\`\`\`

我们预期的合法运行结果有两种：
- 测试用例同时在${ORACLE.name}和${HIEREUS.name}上失败
- 测试用例在${ORACLE.name}和${HIEREUS.name}上转换结果完全一致

请基于实际代码，分析为何会出现这种错误：
\`\`\` c
${getCodes()}
\`\`\`

尝试阐述如何修改以解决这个问题。
`

const FIX_PROMPT = `
既然你已经对错误产生的原因有了了解，并且已经有了大致的修改方案，
现在请对代码进行修改以排除错误。

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

const NEGATIVE_PROMPT = (result) => `
修改后的代码并未能按预期工作……请检查检查问题出在哪里吧。以下是
错误日志：
\`\`\` json
${JSON.stringify(result)}
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

async function genFixedCode(messages){
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

function validateFixedSegs(fixedSegs, testCase){
    let originalCode = fs.readFileSync(FILE, 'utf-8')
    let originalBlocks = matchCode(originalCode)
    let fixedBlocks = matchCode(fixedSegs)
    if(Object.keys(fixedBlocks).length === 0){
        return {error: 'No blocks found in fixed code'}
    }
    let fixedCode = JSON.parse(JSON.stringify(originalCode))
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

    let ret = {testCase, success: true}
    let result1 = ORACLE.tester(testCase)
    let result2 = HIEREUS.tester(testCase)
    ret[ORACLE.name] = result1
    ret[HIEREUS.name] = result2
    function arrcmp(arr1, arr2){
        if(!arr1 && arr2) return false
        if(arr1 && !arr2) return false
        if(arr1.length !== arr2.length) return false
        for(let i = 0; i < arr1.length; i++){
            if(arr1[i] !== arr2[i]) return false
        }
        return true
    }
    if(arrcmp(result1.result, result2.result)){ 
    }else{
        ret.success = false
        fs.writeFileSync(FILE, originalCode, 'utf-8')
    }

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

function matchCode(code){
    const regex = /AIBLOCK ([A-Za-z0-9]+)[\S\s]*?ENDAIBLOCK/g;
    const regex2 = /AIBLOCK ([A-Za-z0-9]+)[\S\s]*?ENDAIBLOCK/;
    const matches = code.match(regex);
    let segs = {}
    if(matches){
        for(let match of matches){
            let name = regex2.exec(match)[1]
            let code = match.split('\n').slice(1, -1).join('\n')
            segs[name] = code
        }
    }
    return segs
}

function addToTestCases(testCase){
    let json = JSON.parse(fs.readFileSync(DATAFILE, 'utf-8'))
    json.testCase.push(testCase)
    fs.writeFileSync(DATAFILE, JSON.stringify(json, null, 2))
}

fix({
  "testCase": {
    "input": "𐀀",
    "replacement": "fill",
    "encoding": "ibm-1123_P100-1995",
    "outputBufferLength": 8
  },
  "icu": {
    "result": [
      63
    ],
    "log": {
      "conversion": "",
      "result": "?"
    }
  },
  "ziconv": {
    "result": [
      127,
      127
    ],
    "log": {
      "compile": "",
      "result": ""
    }
  },
  "status": "positive",
  "message": ""
})