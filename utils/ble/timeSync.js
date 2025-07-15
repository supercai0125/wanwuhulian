// 时间同步相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成时间同步命令
const generateTimeSyncCommand = (rollingCode, syncData = {}) => {
    const now = new Date();
    const {
        hour = now.getHours(),
        minute = now.getMinutes(),
        second = now.getSeconds(),
        weekDay = now.getDay()
    } = syncData;

    // 根据协议表格，时间同步命令格式：
    // 字节0-1: 滚动码 (两字节，从连接设备时获取)
    // 字节2: 00 (固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (07 - 时间同步功能)
    // 字节5: 00 (固定值)
    // 字节6: 星期 (0-6，0=周日)
    // 字节7: 时
    // 字节8: 分
    // 字节9: 秒
    // 字节10-12: 00 (固定值)

    // 确保滚动码是4位十六进制字符
    const rollingCodeHex = rollingCode ? rollingCode.padStart(4, '0') : '0000';

    const hourByte = hour.toString(16).padStart(2, '0');
    const minuteByte = minute.toString(16).padStart(2, '0');
    const secondByte = second.toString(16).padStart(2, '0');
    const weekDayByte = weekDay.toString(16).padStart(2, '0');

    // 滚动码(2字节) + 00 + 设备类型(01) + 功能码(07) + 00 + 星期 + 时分秒 + 00 00 00
    const command = `${rollingCodeHex} 00 01 07 00 ${weekDayByte} ${hourByte} ${minuteByte} ${secondByte} 00 00 00`;

    return command.replace(/\s/g, '').toUpperCase();
}

// 发送时间同步命令
export function sendTimeSyncCommand(rollingCode, syncData, successCallback, errorCallback) {
    try {
        // 生成时间同步命令
        const command = generateTimeSyncCommand(rollingCode, syncData);

        // 使用统一管理器发送命令
        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true,
            timeout: 4000,
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

export { generateTimeSyncCommand } 