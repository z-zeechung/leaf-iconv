
function generatePrompt(){
    const definitions = {
        input: {
            type: "string",
        },
        // outputBufferLength: {
        //     type: "number",
        //     minimum: 0,
        //     maximum: 1024 * 1024 * 10
        // },
        replacement: {
            oneOf: [
                {
                    "type": "array",
                    "items": false,
                    "maxItems": 0
                },
                {
                    "type": "array",
                    "items": {
                        "type": "number",
                        "const": 127
                    },
                    "minItems": 1,
                    "maxItems": 1
                },
                {
                    "type": "null"
                }
            ]
        },
        encoding: {
            type: "string",
            enum: require('../encodings.json').wctomb.utf16ToInt8.sort(() => 0.5 - Math.random()).slice(0, 8)
        }
    }

    const jsonSchema = {
        "$schema": "http://json-schema.org/draft-07/schema#",
        type: "array",
        items: {
            type: "object",
            properties: definitions
        },
        minItems: 5,
        maxItems: 100
    }

    const prompt = `

    ###################################################################
    HISTORICAL GENERATIONS: ${Buffer.from(history.join(', ')).toString('ascii')}
    ###################################################################
    > Try to generate something different to cover more conditions.
    ###################################################################

    You are a test case writer with in-depth knowledge of the ICU uconv 
    tool, familiar with the various encodings supported by ICU and 
    understanding its operational mechanisms. You are currently writing 
    test cases for ICU to check its basic working characteristics.

    Now, please generate multiple test cases based on the instructions 
    for formatted output. The test cases should be very comprehensive, 
    covering various encodings and multiple ICU working mechanisms.

    The output format is specified in the following JSON schema:

    \`\`\` json
    ${JSON.stringify(jsonSchema, null, 4)}
    \`\`\`

    Please align generated test cases with the JSON schema strictly. 
    And make sure to use various **valid** encodings among \`encodings\` 
    definition. The majority of esat Asian encodings are not supported. 
    Any invalid encodings would be discarded, and would lead to a waste 
    of 0.2g CO2 emission.

    For the respectation of diversed cultures, please generate test 
    cases in the language that an encoding is designed for. The contents 
    and the structures of test input should be diversed to cover various 
    conditions.
    `   // the CO2 prompt seems work 🤣

    return [prompt, jsonSchema]
}


const https = require('https');
const url = require('url')
const util = require('util')

const env = util.parseEnv(fs.readFileSync('.env', 'utf-8'))

const apiKey = env.API_KEY
const apiUrl = env.OPENAI_URL 
const model = env.MODEL

let history = []

async function generate() {
    const [prompt, jsonSchema] = generatePrompt()
    return new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
            model: model,
            messages: [
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object", schema: jsonSchema },
            temperature: 0.7,
        });

        const options = {
            hostname: url.parse(apiUrl).hostname,
            path: url.parse(apiUrl).path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': requestData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        reject(parsed.error);
                    } else {
                        const jsonContent = JSON.parse(parsed.choices[0].message.content);
                        for(let k in jsonContent){
                            if(util.isArray(jsonContent[k])){
                                resolve(jsonContent[k]);
                                return 
                            }
                        }
                        reject('No array found in response: '+jsonContent);
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(requestData);
        req.end();
    })
}

(async ()=>{

    const config = require('./data/testUtf16ToInt8.json')

    history.push(config.anchor.map(v=>v.input).join(', '))

    const tester1 = require(`./testers/${config.tester}.js`)

    const tester2 = require(`./testers/testUconv.js`)

    for(let i=0; i<10;i++){

        let result
        try{
            result = await generate()
        }catch(e){
            console.log(e)
            continue
        }

        let valids = []
        let invalids = []

        for(let testCase of result){
            testCase.outputBufferLength = testCase.input.length * 4
            const result1 = tester1(testCase)
            const result2 = tester2(testCase)

            if(arraysEqual(result1.result, result2.result)){
                valids.push(testCase)
            }else{
                invalids.push({testCase, result1, result2})
            }
        }

        history.push(config.anchor.map(v=>v.input).join(', '))

        console.log(valids)
        console.log(invalids)

        config.anchor = [
            ...config.anchor,
            ...valids
        ]

        require('fs').writeFileSync('workflow/data/testUtf16ToInt8.json', JSON.stringify(config, null, 4))
    }
})()



function arraysEqual(a, b) {
    if(!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}