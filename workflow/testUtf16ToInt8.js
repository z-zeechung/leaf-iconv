
const { spawnSync, execFileSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * 
 * @param {{
 *  input: string,
 *  outputBufferLength: number,
 *  replacement: array<number> | undefined,
 *  encoding: string
 * }} payload 
 */
function test(payload){
    let validEncodings = require('../encodings.json').wctomb.utf16ToInt8
    if (!validEncodings.includes(payload.encoding)){
        throw new Error(`Invalid encoding: ${payload.encoding}`)
    }

    let input = []
    for(let i=0;i<payload.input.length;i++){
        input.push(payload.input.charCodeAt(i))
    }

    let encodingCName = payload.encoding.replaceAll('-', '_').replaceAll('.', '_')

    let code = `
        #include <stdint.h>
        #include <stdio.h>
        #include <wctomb/${payload.encoding}.h>
        #include <stdlib.h>
        #include "ziconv.h"

        int64_t ziconv_utf16_to_int8_convert(
            uint16_t * restrict input,
            uint8_t * restrict output,
            size_t input_length,
            size_t output_length,
            uint8_t * restrict replacement,
            const char * restrict high_map,
            const char * restrict low_map
        );

        int main(){

            uint16_t input[] = {${input.map(x=>`${x}`).join(',')}};
            uint8_t output[${payload.outputBufferLength}+1];

            // for(int i=0;i<${payload.outputBufferLength}+1;i++){
            //     output[i] = 0;
            // }

            ${payload.replacement?`
                uint8_t replacement[] = {${payload.replacement.map(x=>`${x},`).join('')} 0};
            `:''}

            int64_t length = ziconv_utf16_to_int8_convert(
                input, output,
                sizeof(input)/sizeof(uint16_t),
                ${payload.outputBufferLength},
                ${payload.replacement?`replacement`:'NULL'},
                ${encodingCName}_wctomb_high,
                ${encodingCName}_wctomb_low
            );

            if(length < 0){
                switch(length){
                    case ZICONV_ERR_OVERFLOW:
                        printf("The output buffer is too small.\\n");
                        break;
                    case ZICONV_ERR_INVALID:
                        printf("The input string contains invalid characters.\\n");
                        break;
                    default:
                        printf("Unknown error.\\n");
                }
                return length;
            }

            output[length] = 0;

            printf("%s", output);

            return 0;

        }
    `

    let testFiles = fs.readdirSync('test', 'utf-8')
    for(let file of testFiles){
        if(file.startsWith('test')){
            fs.unlinkSync(`test/${file}`)
        }
    }

    fs.writeFileSync(`test/test.c`, code)

    const CC = "D:/Program Files/mingw64/bin/gcc.exe"
    
    let output
    try{
        let result = execFileSync(
            CC,
            [
                "src/utf16_to_int8.c",
                "test/test.c",
                "-I.",
                "-o",
                "test/test"
            ], 
            {encoding: 'ascii'}
        )
        output = result.toString()
    }catch(e){
        output = e.output?.toString()
    }

    let encodeResult
    let success = false
    try{
        let result = execFileSync(
            "test/test", {encoding: 'hex'}
        )
        encodeResult = result
        success = true
    }catch(e){
        encodeResult = e.stdout
    }

    return {
        result: success?[...Buffer.from(encodeResult, 'hex')]:undefined,
        log: [output, Buffer.from(encodeResult??'', 'hex').toString('latin1')].join('\n')
    }
}

module.exports = test

// console.log(test({
//     input: 'ＴＨＥ　ＱＵＩＣＫ　ＢＲＯＷＮ　ＦＯＸ　ＪＵＭＰＳ　ＯＶＥＲ　ＴＨＥ　ＬＡＺＹ　ＤＯＧ．',
//     outputBufferLength: 500,
//     replacement: [0x20],
//     encoding: 'ibm-858_P100-1997'
// }))