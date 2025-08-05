
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
/* AIBLOCK 'marco' */

/* ENDAIBLOCK */
}

static inline uint8_t process_data(
    uint16_t input, 
    const char * restrict high_map,
    const char * restrict low_map
){
/* AIBLOCK 'process data' */
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
/* AIBLOCK 'convert' */
    
    for (int i = 0; i < input_length; i++) {
        if ((*out_idx) >= output_length) {
            return ZICONV_ERR_OVERFLOW;
        }
        
        uint8_t result = process_data(input[i], high_map, low_map);
        
        if (result != 0) {
            output[(*out_idx)++] = result;
        } else {
            if (replacement == NULL) {
                return ZICONV_ERR_INVALID;
            }
            
            size_t repl_len = strlen((char*)replacement);
            
            if ((*out_idx) + repl_len > output_length) {
                return ZICONV_ERR_OVERFLOW;
            }
            
            memcpy(output + (*out_idx), replacement, repl_len);
            (*out_idx) += repl_len;
        }
    }
    
    return ZICONV_OK;
/* ENDAIBLOCK */
}