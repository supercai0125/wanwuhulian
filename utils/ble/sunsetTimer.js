// 日落定时相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成日落定时命令
const generateSunsetTimerCommand = (sunsetData, rollingCode) => {
    const { sunriseHour = 6, sunriseMinute = 0, sunsetHour = 18, sunsetMinute = 0, executeMode = 1 } = sunsetData;

    // 根据协议表格，日落定时命令格式：
    // 字节0-1: 滚动码 (2字节)
    // 字节2: 00 (固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (06 - 日落定时功能)
    // 字节5: 没有意义 (填充00)
    // 字节6: 执行模式 (1=白天开晚上关, 2=白天关晚上开)
    // 字节7-8: 日出时分
    // 字节9: 没有意义 (填充00)
    // 字节10-11: 日落时分
    // 字节12: 填充0

    // 如果没有提供滚动码，使用默认值0000
    const deviceRollingCode = rollingCode || '0000';

    // 执行模式字节
    const executeModeByte = executeMode.toString(16).padStart(2, '0');

    // 转换时间为十六进制字节
    const sunriseHourByte = sunriseHour.toString(16).padStart(2, '0');
    const sunriseMinuteByte = sunriseMinute.toString(16).padStart(2, '0');
    const sunsetHourByte = sunsetHour.toString(16).padStart(2, '0');
    const sunsetMinuteByte = sunsetMinute.toString(16).padStart(2, '0');

    // 构建完整命令 - 修复：字节5填充00，字节6放执行模式
    const command = `${deviceRollingCode}00010600${executeModeByte}${sunriseHourByte}${sunriseMinuteByte}00${sunsetHourByte}${sunsetMinuteByte}00`;

    return command.toUpperCase();
}

// 发送日落定时命令
export function sendSunsetTimerCommand(sunsetData, rollingCode, successCallback, errorCallback) {
    try {
        // 生成日落定时命令
        const command = generateSunsetTimerCommand(sunsetData, rollingCode);

        // 使用统一管理器发送命令
        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true, // 日落定时命令期望回复
            timeout: 4000,
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

export { generateSunsetTimerCommand } 