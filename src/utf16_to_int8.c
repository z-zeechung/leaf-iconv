
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
    int hasUnreplacedInvalid = 0;
    
    while (i < input_length) {
        uint16_t code = input[i];
        int isInvalid = 0;
        int consumed = 1;
        uint32_t full_code = code;
        int isSurrogate = (code >= 0xD800 && code <= 0xDFFF);
        int isSurrogatePair = 0;

        // Handle surrogate characters
        if (isSurrogate) {
            if (code <= 0xDBFF && i+1 < input_length) {
                uint16_t next = input[i+1];
                if (next >= 0xDC00 && next <= 0xDFFF) {
                    full_code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00);
                    consumed = 2;
                    isSurrogatePair = 1;
                }
            }
            // All surrogates are invalid in target encoding
            isInvalid = 1;
        }

        // Process character
        uint8_t result = process_data(full_code, high_map, low_map);
        if (result == 0 && full_code != 0) {
            isInvalid = 1;
        } else if (!isSurrogate) { // Only output for non-surrogate characters
            if ((*out_idx) < output_length) {
                output[(*out_idx)++] = result;
            } else {
                return ZICONV_ERR_OVERFLOW;
            }
        }

        // Handle invalid characters according to ICU behavior
        if (isInvalid) {
            if (replacement != NULL) {
                if (replacement[0] != 0 && (*out_idx) < output_length) {
                    output[(*out_idx)++] = replacement[0];
                }
            } else {
                // Only report error for surrogate pairs and non-surrogate invalid chars
                // Single surrogates are silently skipped (ICU behavior)
                if (isSurrogatePair || !isSurrogate) {
                    hasUnreplacedInvalid = 1;
                }
            }
        }

        i += consumed;
    }
    
    if (hasUnreplacedInvalid) {
        *out_idx = 0; // Clear output on error (ICU behavior)
        return ZICONV_ERR_INVALID;
    }
    return ZICONV_OK;
/* ENDAIBLOCK */
}