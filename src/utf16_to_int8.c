
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
){                                  // this allow us to store mapping with less space
/* AIBLOCK process */
    uint8_t high = high_map[input >> 8];
    input = 0x00ff & input;
    input = input | (high << 8);
    return low_map[input];
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
    size_t i = 0;
    while (i < input_length) {
        uint16_t code = input[i];

        // Check for surrogate pairs
        if (code >= 0xD800 && code <= 0xDBFF) {
            // High surrogate found, check if next is low surrogate
            if (i+1 < input_length && input[i+1] >= 0xDC00 && input[i+1] <= 0xDFFF) {
                // Valid surrogate pair - treat as single invalid character
                if (replacement != NULL) {
                    size_t repl_len = strlen((char*)replacement);
                    if ((*out_idx) + repl_len > output_length) {
                        return ZICONV_ERR_OVERFLOW;
                    }
                    memcpy(output + (*out_idx), replacement, repl_len);
                    (*out_idx) += repl_len;
                }
                i += 2; // Skip both high and low surrogates
                continue;
            }
            // Fall through to invalid handling for unpaired high surrogate
        } else if (code >= 0xDC00 && code <= 0xDFFF) {
            // Unpaired low surrogate - fall through to invalid handling
        }

        // Normal character processing
        uint8_t result = process_data(code, high_map, low_map);
        if (result != 0 || code == 0) {
            if ((*out_idx) >= output_length) {
                return ZICONV_ERR_OVERFLOW;
            }
            output[(*out_idx)++] = result;
            i++;
            continue;
        }

        // Invalid character handling
        if (replacement != NULL) {
            size_t repl_len = strlen((char*)replacement);
            if ((*out_idx) + repl_len > output_length) {
                return ZICONV_ERR_OVERFLOW;
            }
            memcpy(output + (*out_idx), replacement, repl_len);
            (*out_idx) += repl_len;
        }
        i++;
    }
    return ZICONV_OK;
/* ENDAIBLOCK */
}