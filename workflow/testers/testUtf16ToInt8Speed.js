
const payload = `😄🤭🙂😡😷«Dar jangal-hā-ye anbuh-e shomāl-e Irān, guneyi-ye khāss az parandegān be nām-e "sehre-ye khāldār" (Fringilla polychroma) zendegi mikonad. In parande-ye rangārang bā āvāz-e pichide-ash shenākhte mishavad ke shāmel-e not-hā-ye zir-o-bami-ye gheyre montazere ast.»«در جنگلهای انبوه شمال ایران، گونهای خاص از پرندگان به نام "سهرهٔ خالدار" (Fringilla polychroma) زندگی میکند. این پرندهٔ رنگارنگ با آوازِ پیچیدهاش شناخته میشود که شامل نُتهای زیروبمیِ غیرمنتظره است.»`

const { spawnSync, execFileSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const util = require('util')

function test(){

    let code = `
        #include <stdint.h>
        #include <stdio.h>
        #include <wctomb/ibm-1097_P100-1995.h>
        #include <stdlib.h>
        #include "ziconv.h"
        #include <io.h>
        #include <fcntl.h>
        #include <stdlib.h>
        #include <time.h>
        #include <string.h>

        int64_t ziconv_utf16_to_int8_convert(
            uint16_t * restrict input,
            uint8_t * restrict output,
            size_t input_length,
            size_t output_length,
            uint8_t * restrict replacement,
            const char * restrict high_map,
            const char * restrict low_map,
            size_t * restrict out_idx
        );

        int main(){

            uint16_t *input = malloc(sizeof(uint16_t)*1024*1024*1000);
            uint8_t *output = malloc(sizeof(uint8_t)*1024*1024*1200);

            uint16_t payload[] = {${payload.split('').map(x=>`0x${x.codePointAt(0).toString(16)}`)}};

            int i = 0; for(; i < 1024*1024*1000; i+=sizeof(payload)/sizeof(uint16_t)){
                memcpy(input+i, payload, sizeof(payload));
            }

            size_t out_idx = 0;

            clock_t start = clock();

            char replacement[] = {'?', 0};

            int64_t status = ziconv_utf16_to_int8_convert(
                input, output,
                i,
                1024*1024*1200,
                replacement,
                ibm_1097_P100_1995_wctomb_high,
                ibm_1097_P100_1995_wctomb_low,
                &out_idx
            );

            clock_t end = clock();

            double elapsed_ms = (double)(end - start) * 1000 / CLOCKS_PER_SEC;
            int mb_per_sec = out_idx / (1024 * 1024) / (elapsed_ms / 1000);
            printf("%d", mb_per_sec);

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

    const env = util.parseEnv(fs.readFileSync('.env', 'utf-8'))

    const CC = env.CC || 'gcc'
    
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
        // output = e.output?.toString()
        throw e
    }

    // let encodeResult
    // let success = false
    try{
        let result = execFileSync(
            "test/test", {encoding: 'ascii'}
        )
        return mbPerSec = Number.parseInt(result)
    }catch(e){
        // encodeResult = e.stdout
        throw e
    }

    // return {
    //     result: success?[...Buffer.from(encodeResult, 'hex')]:undefined,
    //     log: {
    //         compile: output, 
    //         result: Buffer.from(encodeResult??'', 'hex').toString('latin1')
    //     }
    // }
}

module.exports = test