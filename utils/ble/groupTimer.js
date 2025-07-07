// 分组定时相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成分组定时命令
const generateGroupTimerCommand = (timerData, rollingCode) => {
    const { groupId, startTime, endTime, repeatDays } = timerData;

    // 根据协议表格，分组定时命令格式：
    // 字节0-1: 滚动码 (2字节，4个十六进制字符)
    // 字节2: 第三字节 (00 - 固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (05 - 分组定时功能)
    // 字节5: 分组ID (0-15)
    // 字节6: bit1-bit7为星期一到星期日
    // 字节7-9: 开启的时分秒
    // 字节10-12: 关闭的时分秒

    // 如果没有提供滚动码，使用默认值0000
    const deviceRollingCode = rollingCode || '0000';

    // 分组ID (0-15)
    const groupIdByte = (groupId || 0).toString(16).padStart(2, '0');

    // 生成星期字节：bit1-bit7为星期一到星期日
    // repeatDays数组：0=周日, 1=周一, 2=周二, ..., 6=周六
    // 需要转换为：bit1=周一, bit2=周二, ..., bit7=周日
    let weekByte = 0;
    if (repeatDays && Array.isArray(repeatDays)) {
        repeatDays.forEach(day => {
            if (day === 0) {
                // 周日 -> bit7
                weekByte |= 0x40; // bit7 = 01000000
            } else {
                // 周一到周六 -> bit1到bit6
                weekByte |= (1 << (day - 1)); // day=1->bit1, day=2->bit2, ...
            }
        });
    }
    const weekBytehex = weekByte.toString(16).padStart(2, '0');

    // 解析开启时间 (HH:MM:SS)
    const startTimeParts = startTime.split(':');
    const startHour = parseInt(startTimeParts[0]) || 0;
    const startMinute = parseInt(startTimeParts[1]) || 0;
    const startSecond = parseInt(startTimeParts[2]) || 0;

    // 解析关闭时间 (HH:MM:SS)
    const endTimeParts = endTime.split(':');
    const endHour = parseInt(endTimeParts[0]) || 0;
    const endMinute = parseInt(endTimeParts[1]) || 0;
    const endSecond = parseInt(endTimeParts[2]) || 0;

    // 转换为十六进制字节
    const startTimeBytes = `${startHour.toString(16).padStart(2, '0')}${startMinute.toString(16).padStart(2, '0')}${startSecond.toString(16).padStart(2, '0')}`;
    const endTimeBytes = `${endHour.toString(16).padStart(2, '0')}${endMinute.toString(16).padStart(2, '0')}${endSecond.toString(16).padStart(2, '0')}`;

    // 生成命令：滚动码 + 00 + 设备类型01 + 功能码05 + 分组ID + 星期字节 + 开启时分秒 + 关闭时分秒
    const command = `${deviceRollingCode}000105${groupIdByte}${weekBytehex}${startTimeBytes}${endTimeBytes}`;

    return command.toUpperCase();
}

// 发送分组定时命令
export function sendGroupTimerCommand(timerData, rollingCode, successCallback, errorCallback) {
    try {
        // 生成分组定时命令
        const command = generateGroupTimerCommand(timerData, rollingCode);

        // 使用统一管理器发送命令
        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true, // 分组定时命令期望回复
            timeout: 4000,
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

export { generateGroupTimerCommand } 