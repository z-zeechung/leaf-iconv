
const { spawnSync, execFileSync, execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const util = require('util')

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

    let validEncodings = require('../../encodings.json').wctomb.utf16ToInt8
    if (!validEncodings.includes(payload.encoding)){
        throw new Error(`Invalid encoding: ${payload.encoding}`)
    }

    let testFiles = fs.readdirSync('test', 'utf-8')
    for(let file of testFiles){
        if(file.startsWith('test')){
            fs.unlinkSync(`test/${file}`)
        }
    }

    fs.writeFileSync('test/test.txt', payload.input, 'utf-16le')

    let replacement
    if(payload.replacement){
        if(payload.replacement.length === 0){
            replacement = 'skip'
        }else if(payload.replacement.length === 1 && payload.replacement[0] === 0x7f){
            replacement = 'substitute'
        }else{
            throw new Error('unsupported replacement')
        }
    }

    const env = util.parseEnv(fs.readFileSync('.env', 'utf-8'))

    const uconv = env.uconv || 'uconv'

    let output
    let success = false
    try{
        let result = execFileSync(
            uconv,
            [
                '-f', 'utf-16le',
                '-t', payload.encoding,
                ...(replacement?['--callback', replacement]:[]),
                'test/test.txt',
                '-o', 'test/test2.txt',
            ], 
            {encoding: 'ascii'}
        )
        output = result.toString()
        success = true
    }catch(e){
        output = e.output?.toString()
    }

    let encodeResult = fs.readFileSync('test/test2.txt', 'binary')

    return {
        result: success?[...Buffer.from(encodeResult, 'binary')]:undefined,
        log: {
            conversion: output, 
            result: Buffer.from(encodeResult??'', 'binary').toString('latin1')
        }
    }
}

module.exports = test