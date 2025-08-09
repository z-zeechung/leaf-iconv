
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
#define IS_VALID_SURROGATE_PAIR(high, low) \
    (((high) >= 0xD800 && (high) <= 0xDBFF) && \
     ((low) >= 0xDC00 && (low) <= 0xDFFF))

// 错误处理宏
#define HANDLE_INVALID(skip_count) \
    do { \
        if (replacement == NULL) { \
            return ZICONV_ERR_INVALID; \
        } else if (replacement[0] == '\0') { \
            /* skip */ \
        } else { \
            if (*out_idx >= output_length) { \
                return ZICONV_ERR_OVERFLOW; \
            } \
            output[(*out_idx)++] = replacement[0]; \
        } \
        i += (skip_count); \
        continue; \
    } while(0)
/* ENDAIBLOCK */
}

// use a 2-level table to map utf16 to mb code
static inline uint8_t process_data(
    uint16_t input, 
    const char * restrict high_map, // level 1: map high byte to offset
    const char * restrict low_map   // level 2: map low byte to mb code, this is a continuous array, sth. like static linked list
){                                  // any invalid codepoints are mapped to 0x00, this enables determining invalid codepoints in batch
/* AIBLOCK process */
    // Optimized memory access with direct offset calculation
    // Cast to uint8_t first to avoid sign extension
    uint16_t offset = ((uint8_t)high_map[input >> 8]) << 8;
    return low_map[offset | (input & 0xFF)];
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
    *out_idx = 0;
    size_t i = 0;
    
    // 处理16字节块
    for (; i + 15 < input_length; i += 16) {
        uint8_t temp_output[16];
        uint64_t packed1 = 0, packed2 = 0;
        
        // 预计算16个字符的映射
        for (int j = 0; j < 16; j++) {  // 重要：不要修改这个循环体逻辑，也不要往里添加任何内容，这会使得编译器无法进行simd优化
            temp_output[j] = process_data(input[i+j], high_map, low_map);
        }
        
        // 检查前8字节和后8字节是否有0
        memcpy(&packed1, temp_output, 8);
        memcpy(&packed2, temp_output + 8, 8);
        
        // 使用位魔法检测0值（除了原始0x0000）
        uint64_t zero_mask = ~0ULL;
        for (int j = 0; j < 16; j++) {
            if (input[i+j] == 0) {
                // 原始0x0000不视为错误
                zero_mask &= ~(1ULL << (j * 8));
            }
        }
        
        if ((HAS_ZERO_BYTE(packed1) || HAS_ZERO_BYTE(packed2)) && zero_mask) {
            // 慢路径：使用位操作定位无效字符
            for (int j = 0; j < 16; j++) {
                uint16_t c = input[i+j];
                
                // 跳过原始0x0000
                if (c == 0) continue;   // TODO
                
                // 检查代理对
                if (c >= 0xD800 && c <= 0xDBFF) {
                    // 高代理项
                    if (j < 15) {
                        uint16_t next = input[i+j+1];
                        if (IS_VALID_SURROGATE_PAIR(c, next)) {
                            // 有效代理对，但映射表无法处理
                            HANDLE_INVALID(2);
                        } else {
                            // 无效高代理
                            HANDLE_INVALID(1);
                        }
                    } else {
                        // 块末尾的高代理
                        HANDLE_INVALID(1);
                    }
                } else if (c >= 0xDC00 && c <= 0xDFFF) {
                    // 孤立低代理
                    HANDLE_INVALID(1);
                } else if (temp_output[j] == 0) {
                    // 非代理项的无效字符
                    HANDLE_INVALID(1);
                }
                
                // 有效字符
                if (*out_idx >= output_length) {
                    return ZICONV_ERR_OVERFLOW;
                }
                output[(*out_idx)++] = temp_output[j];
            }
            i += 16; // 处理完整个块
        } else {
            // 快路径：无无效字符，直接复制有效字符
            for (int j = 0; j < 16; j++) {
                if (input[i+j] != 0) { // 跳过原始0x0000
                    if (*out_idx >= output_length) {
                        return ZICONV_ERR_OVERFLOW;
                    }
                    output[(*out_idx)++] = temp_output[j];
                }
            }
            i += 16;
        }
    }
    
    // 处理剩余字符（基线路径）
    for (; i < input_length; i++) {
        uint16_t c = input[i];
        
        // 跳过原始0x0000
        if (c == 0) continue;   // TODO
        
        // 检查代理对
        if (c >= 0xD800 && c <= 0xDBFF) {
            // 高代理项
            if (i + 1 < input_length) {
                uint16_t next = input[i+1];
                if (IS_VALID_SURROGATE_PAIR(c, next)) {
                    HANDLE_INVALID(2);
                } else {
                    HANDLE_INVALID(1);
                }
            } else {
                HANDLE_INVALID(1);
            }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
            // 孤立低代理
            HANDLE_INVALID(1);
        }
        
        // 处理有效字符
        uint8_t mapped = process_data(c, high_map, low_map);
        if (mapped == 0) {
            // 非代理项的无效字符
            HANDLE_INVALID(1);
        }
        
        if (*out_idx >= output_length) {
            return ZICONV_ERR_OVERFLOW;
        }
        output[(*out_idx)++] = mapped;
    }
    
    return 0;
/* ENDAIBLOCK */
}