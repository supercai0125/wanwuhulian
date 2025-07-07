// 循环定时相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成循环定时命令
const generateLoopTimerCommand = (loopData, rollingCode) => {
    const { startTime, endTime, sequenceNumber = 0 } = loopData;

    // 根据协议表格，循环定时命令格式：
    // 字节0-1: 滚动码 (2字节)
    // 字节2: 00 (固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (05 - 循环定时功能)
    // 字节5: 功能执行序号 (按一次按钮加1，0-255循环)
    // 字节6: 无意义 (00)
    // 字节7: 开启时间-时
    // 字节8: 开启时间-分
    // 字节9: 开启时间-秒
    // 字节10: 关闭时间-时
    // 字节11: 关闭时间-分
    // 字节12: 关闭时间-秒

    // 解析开启时间 "08:30:00"
    const [startHour, startMinute, startSecond] = startTime.split(':').map(t => parseInt(t));
    // 解析关闭时间 "18:30:00"
    const [endHour, endMinute, endSecond] = endTime.split(':').map(t => parseInt(t));

    const sequenceByte = (sequenceNumber % 256).toString(16).padStart(2, '0'); // 0-255循环
    const startHourByte = startHour.toString(16).padStart(2, '0');
    const startMinuteByte = startMinute.toString(16).padStart(2, '0');
    const startSecondByte = startSecond.toString(16).padStart(2, '0');
    const endHourByte = endHour.toString(16).padStart(2, '0');
    const endMinuteByte = endMinute.toString(16).padStart(2, '0');
    const endSecondByte = endSecond.toString(16).padStart(2, '0');

    // 构建完整命令
    const command = `${rollingCode}000105${sequenceByte}00${startHourByte}${startMinuteByte}${startSecondByte}${endHourByte}${endMinuteByte}${endSecondByte}`;

    return command.toUpperCase();
}

// 发送循环定时命令
export function sendLoopTimerCommand(loopData, rollingCode, successCallback, errorCallback) {
    try {
        // 生成循环定时命令
        const command = generateLoopTimerCommand(loopData, rollingCode);

        // 使用统一管理器发送命令
        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true, // 循环定时命令期望回复
            timeout: 4000,
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

export { generateLoopTimerCommand } 