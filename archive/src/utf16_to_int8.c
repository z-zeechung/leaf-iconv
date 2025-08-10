
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
#define HAS_ZERO_BYTE(v) (((v) - 0x0101010101010101ULL) & ~(v) & 0x8080808080808080ULL)
/* ENDAIBLOCK */
}

// use a 2-level table to map utf16 to mb code
static inline uint8_t process_data(
    uint16_t input, 
    const char * restrict high_map, // level 1: map high byte to offset
    const char * restrict low_map   // level 2: map low byte to mb code, this is a continuous array, sth. like static linked list
){                                  // any invalid codepoints are mapped to 0x00, this enables determining invalid codepoints in batch
/* AIBLOCK process */
    // Optimized lookup with direct index calculation
    uint16_t high = (uint8_t)high_map[input >> 8];
    uint16_t index = (high << 8) | (input & 0xFF);
    return low_map[index];
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
    size_t * restrict out_idx_p
){  
    #define out_idx (*out_idx_p)
/* AIBLOCK init */
    out_idx = 0;
    size_t i=0;
/* ENDAIBLOCK */
    for(; i+15 < input_length && out_idx+15 < output_length; i+=16){
        for(size_t j=0; j<16; j++){
            output[out_idx+j] = process_data(input[i+j], high_map, low_map);
        }
        // if output[k] is 0x00, that indicates corresponding input[m] is 0x0000(valid), invalid or surrogate
        // use bits magic to detect 0x00s, skip err handling if no 0x00 exists, it is safe
        // valid 0x0000 is always mapped to 0x00
/* AIBLOCK fasterr */
        // Process 16 characters with validity check
        uint8_t temp[16];
        size_t valid_count = 0;
        for (size_t j=0; j<16; j++) {
            uint16_t in_char = input[i+j];
            temp[j] = process_data(in_char, high_map, low_map);
            // Valid if input is 0x0000 or output byte is non-zero
            if (in_char == 0 || temp[j] != 0) {
                valid_count++;
            }
        }

        // Only proceed if we have space for all valid characters
        if (out_idx + valid_count <= output_length) {
            for (size_t j=0; j<16; j++) {
                uint16_t in_char = input[i+j];
                if (in_char == 0 || temp[j] != 0) {
                    output[out_idx++] = temp[j];
                }
            }
        } else {
            // Not enough space, process what we can
            for (size_t j=0; j<16 && out_idx < output_length; j++) {
                uint16_t in_char = input[i+j];
                if (in_char == 0 || temp[j] != 0) {
                    output[out_idx++] = temp[j];
                }
            }
        }
/* ENDAIBLOCK */
    }
    if (input_length - i >= 16 && output_length - out_idx >= 16){
        // don't exit fast path ahead of time
        return ZICONV_ERR_BAD_IMPL;
    }
    for(; i < input_length && out_idx < output_length; i++){
/* AIBLOCK slow */
        uint16_t in_char = input[i];
        uint8_t out_char = process_data(in_char, high_map, low_map);
        if (in_char == 0 || out_char != 0) {
            output[out_idx++] = out_char;
        }
        // else skip invalid character
/* ENDAIBLOCK */
    }
}