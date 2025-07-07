// 时间同步相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成时间同步命令
const generateTimeSyncCommand = (rollingCode, syncData = {}) => {
    const now = new Date();
    const {
        year = now.getFullYear(),
        month = now.getMonth() + 1,
        day = now.getDate(),
        hour = now.getHours(),
        minute = now.getMinutes(),
        second = now.getSeconds(),
        weekDay = now.getDay()
    } = syncData;

    // 根据协议表格，时间同步命令格式：
    // 字节0-1: 滚动码 (两字节，从连接设备时获取)
    // 字节2: 00 (固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (03 - 时间同步功能)
    // 字节5-6: 年份 (2000-2099)
    // 字节7: 月份 (1-12)
    // 字节8: 日期 (1-31)
    // 字节9: 小时 (0-23)
    // 字节10: 分钟 (0-59)
    // 字节11: 秒钟 (0-59)
    // 字节12: 星期 (0-6，0=周日)

    // 确保滚动码是4位十六进制字符
    const rollingCodeHex = rollingCode ? rollingCode.padStart(4, '0') : '0000';

    const yearBytes = year.toString(16).padStart(4, '0');
    const monthByte = month.toString(16).padStart(2, '0');
    const dayByte = day.toString(16).padStart(2, '0');
    const hourByte = hour.toString(16).padStart(2, '0');
    const minuteByte = minute.toString(16).padStart(2, '0');
    const secondByte = second.toString(16).padStart(2, '0');
    const weekDayByte = weekDay.toString(16).padStart(2, '0');

    // 滚动码(2字节) + 00 + 设备类型(01) + 功能码(03) + 年份(4字符) + 月日时分秒星期(6字节)
    const command = `${rollingCodeHex} 00 01 03 ${yearBytes} ${monthByte} ${dayByte} ${hourByte} ${minuteByte} ${secondByte} ${weekDayByte}`;

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