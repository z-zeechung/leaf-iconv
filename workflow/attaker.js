
const fs = require('fs')
const { isArray } = require('util')

const MAX_TRAILS = 10
const CHARSETS = '欧洲语言'
const ENCODINGS = ['wctomb', 'utf16ToInt8']
const ORACLE = {name: 'icu', tester: require('./testers/testUconv.js')}
const HIEREUS = {name: 'ziconv', tester: require('./testers/testUtf16ToInt8.js')}
const CODES = ['src/utf16_to_int8.c', ['注：以下这个码表文件只用作示例，用于展示一般性的码表结构，实际调用时会定向为指定的码表'], 'wctomb/ibm-1123_P100-1995.h']

async function attack(){

    let history = []

    let system = {role: 'user', content: GENERAL_PROMPT(getFileContent())}

    for(let i=0;i < MAX_TRAILS;i++){
        let analyze = await reasoning([system, ...history])
        history.push({role: 'assistant', content: analyze})

        let testCase = await genTestCase([system, ...history, {role: 'user', content: FIRST_TRAIL_PROMPT+CASE_FORMAT_PROMPT}])
        console.log(testCase)
        history.push({role: 'user', content: FIRST_TRAIL_PROMPT})
        history.push({role: 'assistant', content: `\`\`\`json\n${JSON.stringify(testCase)}\n\`\`\``})
        let testResult = tryTestCase(testCase)
        console.log(testResult)

        if(testResult.status === 'positive'){
            switch(testCase.replacement){
                case 'skip': testCase.replacement = []; return;
                case 'fill': testCase.replacement = [0x7f]; return;
                default: testCase.replacement = undefined
            }
            testResult.testCase['outputBufferLength'] = testResult.testCase.input.length*4
            console.log('\x1b[31mA POSITIVE TEST CASE DISCOVERED:', JSON.stringify(testResult, null, 2), '\x1b[0m')
            return testResult
        }else{
            for(let i=0;i<3;i++){
                testCase = await genTestCase([system, ...history, {role: 'user', content: NEGATIVE_PROMPT(testResult)+CASE_FORMAT_PROMPT}])
                console.log(testCase)
                history.push({role: 'user', content: NEGATIVE_PROMPT(testResult)})
                history.push({role: 'assistant', content: `\`\`\`json\n${JSON.stringify(testCase)}\n\`\`\``})
                testResult = tryTestCase(testCase)
                console.log(testResult)
                if(testResult.status === 'positive'){
                    switch(testCase.replacement){
                        case 'skip': testCase.replacement = []; return;
                        case 'fill': testCase.replacement = [0x7f]; return;
                        default: testCase.replacement = undefined
                    }
                    testResult.testCase['outputBufferLength'] = testResult.testCase.input.length*4
                    console.log('\x1b[31mA POSITIVE TEST CASE DISCOVERED:', JSON.stringify(testResult, null, 2), '\x1b[0m')
                    return testResult
                }
            }
        }

        history.push({role: 'user', content: TRY_AGAIN_PROMPT})

        if(history.length > 24){
            history = history.slice(-12)
        }
    }

    throw new Error('failed to find a test case')
}


const GENERAL_PROMPT = (code)=>`
// 测试用例定义：${JSON.stringify(testCaseScheme)}

你是一位擅长编写攻击性测试用例的测试人员。你通过观察代码，察觉其
中不易注意的逻辑问题、边界条件问题以及与神谕实现行为对齐的细节，
并撰写对应测试用例来暴露问题。

现在，你正在测试一个名为ziconv的项目，这个项目通过编译icu项目的数
据文件，来实现字符编码的转换。由于不明确字符转换接口所有行为细节，
因此我们使用icu作为神谕实现，并令我们的代码向其对齐。

以下为ziconv对于${CHARSETS}字符编码转换的代码实现：
\`\`\` c
${code}
\`\`\`

你的任务是找出代码当中的：
- 将会造成寻址、内存问题的错误边界行为定义
- 将会造成转码结果与icu不一致的定义
- 错误的代码逻辑
- 其它会造成非预期行为的定义

你编写的测试用例将会被送往测试引擎，测试引擎将分别在icu和ziconv上
执行测试用例，并**只**在如下情况时认为测试用例是*阳性的*：
- 测试用例在icu上正常运行，在ziconv上运行失败（抛出错误或崩溃）
- 测试用例在icu上报错，但ziconv未抛出错误
- 测试用例在icu和ziconv上正常运行，但转换结果不一致

以下情况是*阴性的*，这样的测试用例将被视为无效用例：
- 测试用例同时在icu和ziconv上失败
- 测试用例在icu和ziconv上转换结果一致

一旦你找到了*一个*阳性的测试用例，系统将会把测试用例交给迭代人员做
进一步处理，你的工作到此结束。

现在，请先*暂时不要*着急立即编写测试用例。请*首先*仔细审阅代码，分
析其中所存在的上述问题，阐明其机制，并概述如何触发这种错误。
`

CASE_FORMAT_PROMPT = `
测试用例由以下几部分组成：
- input：任意字符串，将被作为转换函数的输入数据。这个字符串将被解释
  为UTF-16序列，不支持转义符。
- encoding：目标字符编码的名称，可用的编码如列表所示，你所填写的编
  码名称必须与列表中给出的编码名称之一**完全一致**：${getEncodings()}
- replacement：当遇到目标编码未定义的字符时怎么做，replacement值类
  型为'skip' | 'fill' | undefined。为'skip'时，将会跳过未定义编码。
  为'fill'时，将用0x7f填充。为undefined时，将抛出错误并停止编码。

请严格按照如下TypeScript定义以JSON输出测试用例：
\`\`\` ts
{
    input: string,
    replacement: 'skip' | 'fill' | undefined,   // JSON中用null代替undefined
    encoding: string  // 必须是有效的编码名称
}
\`\`\`

**请将测试用例直接以JSON形式输出，不要使用\`\`\` bracket包裹，不要包
含任何额外内容**，我们将通过自动解析工具对你的输出进行解析并使用JSON 
Schema校验，请务必*确保输出**内容**与**格式**的准确性*！
`

FIRST_TRAIL_PROMPT = `
既然你已经发现了一些错误，并对其触发机理已经有了一定了解，你现在可
以开始撰写测试用例了。请以约定的格式输出测试用例的JSON。
`

NEGATIVE_PROMPT = (testResult) => {
    switch(testResult.status){
        case 'format':
            return `
                测试用例未能通过格式校验，看来是你输出的测试用例JSON
                格式有误。请仔细检查约定的格式，重新输出测试用例吧。
            `
        case 'fail':
            return `
                测试用例同时在icu和ziconv上运行失败，icu与ziconv对
                这个测试用例表现出了*一致的*行为。这不是一个有效的
                测试用例，再试一试吧。
                以下是具体的测试返回信息：${JSON.stringify(testResult)}
                请以约定的格式输出新的测试用例的JSON。
            `
        case 'success':
            return `
                测试用例在icu和ziconv上均成功运行，且二者输出结果完
                全一致。icu与ziconv对这个测试用例表现出了*一致的*行
                为。这不是一个有效的测试用例，再试一试吧。
                以下是具体的测试返回信息：${JSON.stringify(testResult)}
                请以约定的格式输出新的测试用例的JSON。
            `
    }
}

TRY_AGAIN_PROMPT = `
经历了多次尝试，我们还是未能成功触发阳性条件，一定是我们的分析在哪
里出了问题。让我们再重新研究一下到底是怎么回事吧。
`

function getEncodings(){
    const encodings = JSON.parse(fs.readFileSync('encodings.json', 'utf-8'))
    return encodings[ENCODINGS[0]][ENCODINGS[1]]
}

function getFileContent(){
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

const testCaseScheme = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "testCaseScheme",
  "type": "object",
  "properties": {
    "input": {
      "type": "string"
    },
    "replacement": {
      "type": ["string", "null"],
      "enum": ["skip", "fill", null]
    },
    "encoding": {
      "type": "string",
      "description": "必须是有效的编码名称"
    }
  },
  "required": ["input", "encoding"],
  "additionalProperties": false
}

const { ChatOpenAI } = require("@langchain/openai");
const {OutputFixingParser, JsonOutputFunctionsParser} = require('langchain/output_parsers')
process.env.OPENAI_API_KEY = env.API_KEY
const model = new ChatOpenAI({
  configuration: {
    baseURL: env.BASE_URL,
  },
  model: env.MODEL,
  temperature: 0.2,
});
const parser = new JsonOutputFunctionsParser();
const fixingParser = OutputFixingParser.fromLLM(
  model,
  parser
);
const chain = model
  .bind({
    functions: [
      {
        name: "output_formatter",
        description: "格式化输出以符合测试用例规范",
        parameters: testCaseScheme,
      },
    ],
    function_call: { name: "output_formatter" },
    response_format: { type: "json_object" }
  })
  .pipe(fixingParser);

async function genTestCase(messages){
    try{
        const result = await chain.invoke(messages);
        return result;
    }catch(e){
        return {error: 'Error during parsing structed output:'+e.message};
    }
}

/**
 * 
 * @param {{
 *  input: string,
 *  encoding: string,
 *  replacement: 'skip' | 'fill' | undefined
 * }} testCase 
 * 
 * @returns {{
 *  testCase: any,
 *  [oracle: string]: {
 *      result: array<number> | undefined,
 *      log: any
 *  },
 *  [hiereus: string]: {
 *      result: array<number> | undefined,
 *      log: any
 *  },
 *  status: 'positive' | 'format' | 'fail' | 'success'
 * }}
 */
function tryTestCase(testCase){

    let ret = {
        testCase: JSON.parse(JSON.stringify(testCase)),
        [ORACLE.name]: undefined,
        [HIEREUS.name]: undefined,
        status: 'format',
        message: ''
    }

    if(typeof testCase.input !== 'string'){
        ret.status = 'format'
        ret.message = 'the `input` of test case is not a string.'
    }else if(typeof testCase.encoding !== 'string'){
        ret.status = 'format'
        ret.message = 'the `encoding` of test case is not a string.'
    }else if(!getEncodings().includes(testCase.encoding)){
        ret.status = 'format'
        ret.message = 'the `encoding` of test case is not a valid encoding name.'
    }else if(testCase.replacement!=='skip'&&testCase.replacement!=='fill'&&testCase.replacement!==undefined&&testCase.replacement!==null){
        ret.status = 'format'
        ret.message = 'the `replacement` of test case is not a valid option.'
    }else{
        testCase['outputBufferLength'] = testCase.input.length * 4
        switch(testCase.replacement){
            case 'skip': testCase.replacement = []; break;
            case 'fill': testCase.replacement = [0x7f]; break;
            default: testCase.replacement = undefined
        }

        let result1 = ORACLE.tester(testCase)
        let result2 = HIEREUS.tester(testCase)

        ret[ORACLE.name] = result1
        ret[HIEREUS.name] = result2

        function arrcmp(arr1, arr2){
            if((!arr1&&arr2)||(arr1&&!arr2)){
                return false
            }
            if(arr1.length != arr2.length){
                return false
            }else{
                for(let i=0;i<arr1.length;i++){
                    if(arr1[i]!==arr2[i]){
                        return false
                    }
                }
                return true
            }
        }

        if(!result1.result && !result2.result){
            ret.status = 'fail'
        }else if(arrcmp(result1.result, result2.result)){
            ret.status = 'success'
        }else{
            ret.status = 'positive'
        }
    }

    return ret
}

attack()