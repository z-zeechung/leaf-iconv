
#include <stdint.h>
#include "ziconv.h"
#include <stdlib.h>
#include <string.h>
#include <stddef.h>
#include <limits.h>

/* this function is useless. ai can define marcos here, 
   and this fucntion bracket prevents it from including 
   headers. */
static void _marco_definitions(){
/* AIBLOCK marco */

/* ENDAIBLOCK */
}

// use a 2-level table to map utf16 to mb code
static inline uint8_t process_data(
    uint16_t input, 
    const char * restrict high_map, // level 1: map high byte to offset
    const char * restrict low_map   // level 2: map low byte to mb code, this is a continuous array, sth. like static linked list
){                                  // any invalid codepoints are mapped to 0x00, this enables determining invalid codepoints in batch
/* AIBLOCK process */
    // Optimized to use direct memory access with proper typing
    // Use uint16_t for offset calculation to avoid potential sign extension
    uint16_t high_offset = (uint8_t)high_map[input >> 8];
    return low_map[(high_offset << 8) | (input & 0xFF)];
/* ENDAIBLOCK */
}

int64_t ziconv_utf16_to_int8_convert(
    uint16_t * restrict input,
    uint8_t * restrict output,
    size_t input_length,
    size_t output_length,
    uint8_t * restrict replacement, // for icu compatibility, only zero-len str (icu `skip`) & single-len str (icu `fill`) are supported
    const char * restrict high_map,
    const char * restrict low_map,
    size_t * restrict out_idx
){
/* AIBLOCK convert */
    uint8_t* out_ptr = output + *out_idx;
    const uint8_t* const end_ptr = output + output_length;
    const uint8_t repl_char = replacement ? *replacement : 0;
    int hasUnreplacedInvalid = 0;
    size_t i = 0;

    // Fast path: process 4 chars at a time when possible
    while (i + 3 < input_length) {
        // Check for any surrogate chars in next 4 chars
        uint32_t chunk = *(const uint32_t*)(input + i);
        if ((chunk & 0xF800F800) != 0xD800D800) {
            // Process 4 non-surrogate chars
            uint8_t results[4];
            results[0] = process_data(input[i], high_map, low_map);
            results[1] = process_data(input[i+1], high_map, low_map);
            results[2] = process_data(input[i+2], high_map, low_map);
            results[3] = process_data(input[i+3], high_map, low_map);

            // Check validity (0 is valid only for null char)
            uint32_t valid_mask = 
                ((input[i] == 0) | (results[0] != 0)) |
                (((input[i+1] == 0) | (results[1] != 0)) << 8) |
                (((input[i+2] == 0) | (results[2] != 0)) << 16) |
                (((input[i+3] == 0) | (results[3] != 0)) << 24);

            if (valid_mask == 0x01010101) {
                if (out_ptr + 4 > end_ptr) {
                    *out_idx = out_ptr - output;
                    return ZICONV_ERR_OVERFLOW;
                }
                *(uint32_t*)out_ptr = *(uint32_t*)results;
                out_ptr += 4;
                i += 4;
                continue;
            }
        }
        break; // Fall back to slow path
    }

    // Slow path for remaining chars
    for (; i < input_length; i++) {
        const uint16_t code = input[i];
        uint8_t result = process_data(code, high_map, low_map);
        
        // Non-surrogate case
        if ((code & 0xF800) != 0xD800) {
            if ((result != 0) || (code == 0)) {
                if (out_ptr >= end_ptr) {
                    *out_idx = out_ptr - output;
                    return ZICONV_ERR_OVERFLOW;
                }
                *out_ptr++ = result;
                continue;
            }
            goto handle_invalid;
        }
        
        // Surrogate case
        if ((code & 0xFC00) == 0xD800) { // High surrogate
            if (i + 1 < input_length && (input[i+1] & 0xFC00) == 0xDC00) {
                i++; // Skip low surrogate
            }
        }

    handle_invalid:
        if (repl_char != 0) {
            if (out_ptr >= end_ptr) {
                *out_idx = out_ptr - output;
                return ZICONV_ERR_OVERFLOW;
            }
            *out_ptr++ = repl_char;
        } else if (replacement == NULL) {
            hasUnreplacedInvalid = 1;
        }
    }

    *out_idx = out_ptr - output;
    return hasUnreplacedInvalid ? ZICONV_ERR_INVALID : ZICONV_OK;
/* ENDAIBLOCK */
}