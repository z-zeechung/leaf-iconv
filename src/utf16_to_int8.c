
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
// level 1: map high byte to offset
// level 2: map low byte to mb code, this is a continuous array, sth. like static linked list
static inline uint8_t process_data(
    uint16_t input, 
    const char * restrict high_map,
    const char * restrict low_map
){
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
    uint8_t * restrict replacement,
    const char * restrict high_map,
    const char * restrict low_map,
    size_t * restrict out_idx
){
/* AIBLOCK convert */
    for (int i = 0; i < input_length; i++) {
        if ((*out_idx) >= output_length) {
            return ZICONV_ERR_OVERFLOW;
        }
        
        uint8_t result = process_data(input[i], high_map, low_map);
        
        // Accept:
        // 1. Non-zero mapping results
        // 2. U+0000 character (even if mapped to 0)
        if (result != 0 || input[i] == 0) {
            output[(*out_idx)++] = result;
        } else {
            // Only process replacement if provided, otherwise skip invalid character
            if (replacement != NULL) {
                size_t repl_len = strlen((char*)replacement);
                
                if ((*out_idx) + repl_len > output_length) {
                    return ZICONV_ERR_OVERFLOW;
                }
                
                memcpy(output + (*out_idx), replacement, repl_len);
                (*out_idx) += repl_len;
            }
            // No error returned for invalid characters when replacement is NULL
        }
    }
    
    return ZICONV_OK;
/* ENDAIBLOCK */
}