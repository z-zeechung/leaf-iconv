
const ORACLE = {name: 'icu', tester: require('./testers/testUconv.js')}
const HIEREUS = {name: 'ziconv', tester: require('./testers/testUtf16ToInt8.js')}

async function fix(testResult){

    let history = []

    let system = {role: 'user', content: GENERAL_PROMPT(testResult)}

    for(let i=0;i < MAX_TRAILS;i++){
        let analyze = await reasoning([system, ...history])
        history.push({role: 'assistant', content: analyze})

        let fixedSegs = await genFixedCode([system, ...history, {role: 'user', content: FIX_PROMPT}])
        console.log(fixedSegs)
        history.push({role: 'user', content: FIRST_TRAIL_PROMPT})
        history.push({role: 'assistant', content: fixedSegs})

        let testResult = validateFixedSegs(fixedSegs)
        console.log(testResult)

        if(testResult.status === 'positive'){
            updateCode(fixedSegs)
            return
        }

        history.push({role: 'user', content: NEGATIVE_PROMPT(testResult)})
    }

    throw new Error('failed to fix with this test case: ' + JSON.stringify(testCase))
}


const GENERAL_PROMPT = (testResult)=>`
你是一个拥有十年经验的老C程序员，熟悉C语言的各种特性，擅长解决
疑难杂症。以下是你同事刚刚给你发来的测试用例，这个测试用例在我
们的实现上与神谕测试表现不一致。以下是测试用例的内容及运行结果：
\`\`\` json
// ${ORACLE.name}为神谕实现，${HIEREUS.name}为我们的实现
${testResult}
\`\`\`

我们预期的运行结果有两种情况：
- 测试用例同时在${ORACLE.name}和${HIEREUS.name}上失败
- 测试用例在${ORACLE.name}和${HIEREUS.name}上转换结果完全一致

请基于实际代码，分析为何会出现这种错误：
\`\`\` c
${getCode()}
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


`

function reasoning(messages){

}

function genFixedCode(messages){

}