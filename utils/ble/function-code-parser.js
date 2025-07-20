// 功能码解析器
// 用于从设备回复中提取功能码并映射到具体的模式

import { COMMAND_CONFIG } from '../config.js'

/**
 * 功能码到模式的映射
 */
const FUNCTION_CODE_TO_MODE = {
    '01': 'off',      // 常关模式
    '02': 'on',       // 常开模式
    '04': 'countdown', // 倒计时模式
    '05': 'loop',     // 循环定时模式
    '06': 'sunset',   // 日落定时模式
    '03': 'group',    // 分组定时模式
    '07': 'timeSync', // 时间同步
    '08': 'match'     // 匹配命令
};

/**
 * 模式到功能码的映射
 */
const MODE_TO_FUNCTION_CODE = {
    'off': '01',
    'on': '02',
    'countdown': '04',
    'loop': '05',
    'sunset': '06',
    'group': '03',
    'timeSync': '07',
    'match': '08'
};

/**
 * 模式名称映射
 */
const MODE_NAMES = {
    'off': '常关',
    'on': '常开',
    'countdown': '倒计时',
    'loop': '循环定时',
    'sunset': '日落定时',
    'group': '分组定时',
    'timeSync': '时间同步',
    'match': '匹配'
};

/**
 * 从设备回复数据中解析功能码
 * @param {string} hexData - 十六进制回复数据
 * @returns {object} 解析结果
 */
export function parseFunctionCode(hexData) {
    try {
        if (!hexData || hexData.length < 8) {
            console.log('📡 回复数据长度不足，无法解析功能码:', hexData);
            return null;
        }

        // 设备回复数据格式：
        // 字节0-1: 滚动码 (2字节，4个十六进制字符)
        // 字节2: 第三字节 (00 - 固定值)
        // 字节3: 设备类型 (01 - 固定值)
        // 字节4: 功能码 (1字节，2个十六进制字符)
        // 字节5-12: 其他数据

        // 提取功能码（第4个字节，即第8-9个十六进制字符）
        const functionCode = hexData.substring(8, 10);
        console.log('📡 解析到功能码:', functionCode, '来自数据:', hexData);

        // 映射到模式
        const mode = FUNCTION_CODE_TO_MODE[functionCode];
        if (!mode) {
            console.log('📡 未知的功能码:', functionCode);
            return {
                functionCode,
                mode: 'unknown',
                modeName: '未知模式',
                isValid: false
            };
        }

        const modeName = MODE_NAMES[mode] || '未知模式';
        console.log('📡 功能码映射到模式:', functionCode, '->', mode, '(', modeName, ')');

        return {
            functionCode,
            mode,
            modeName,
            isValid: true
        };

    } catch (error) {
        console.error('📡 解析功能码失败:', error);
        return null;
    }
}

/**
 * 从设备回复数据中提取滚动码
 * @param {string} hexData - 十六进制回复数据
 * @returns {string|null} 滚动码
 */
export function extractRollingCode(hexData) {
    try {
        if (!hexData || hexData.length < 4) {
            return null;
        }
        // 滚动码是前两字节，即前4个十六进制字符
        return hexData.substring(0, 4);
    } catch (error) {
        console.error('📡 提取滚动码失败:', error);
        return null;
    }
}

/**
 * 解析设备回复数据，提取滚动码和功能码
 * @param {string} hexData - 十六进制回复数据
 * @returns {object} 解析结果
 */
export function parseDeviceReply(hexData) {
    const rollingCode = extractRollingCode(hexData);
    const functionCodeInfo = parseFunctionCode(hexData);

    return {
        rollingCode,
        functionCode: functionCodeInfo?.functionCode,
        mode: functionCodeInfo?.mode,
        modeName: functionCodeInfo?.modeName,
        isValid: functionCodeInfo?.isValid || false
    };
}

/**
 * 获取模式对应的功能码
 * @param {string} mode - 模式名称
 * @returns {string|null} 功能码
 */
export function getFunctionCodeByMode(mode) {
    return MODE_TO_FUNCTION_CODE[mode] || null;
}

/**
 * 获取功能码对应的模式
 * @param {string} functionCode - 功能码
 * @returns {string|null} 模式名称
 */
export function getModeByFunctionCode(functionCode) {
    return FUNCTION_CODE_TO_MODE[functionCode] || null;
}

/**
 * 获取模式的中文名称
 * @param {string} mode - 模式名称
 * @returns {string} 中文名称
 */
export function getModeName(mode) {
    return MODE_NAMES[mode] || '未知模式';
}

/**
 * 验证功能码是否有效
 * @param {string} functionCode - 功能码
 * @returns {boolean} 是否有效
 */
export function isValidFunctionCode(functionCode) {
    return FUNCTION_CODE_TO_MODE.hasOwnProperty(functionCode);
}

/**
 * 验证模式是否有效
 * @param {string} mode - 模式名称
 * @returns {boolean} 是否有效
 */
export function isValidMode(mode) {
    return MODE_TO_FUNCTION_CODE.hasOwnProperty(mode);
}

// 导出常量供其他模块使用
export {
    FUNCTION_CODE_TO_MODE,
    MODE_TO_FUNCTION_CODE,
    MODE_NAMES
}; 