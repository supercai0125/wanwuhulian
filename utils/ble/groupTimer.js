import { sendTimerSwitchCommand } from './core.js'

// 生成分组定时命令
const generateGroupTimerCommand = (timerData) => {
    // 滚动码 (字节0-2) - 使用固定值
    const rollingCode = '112233';

    // 设备类型 (字节3) - 定时插座固定为1
    const deviceType = '01';

    // 功能码 (字节4) - 分组定时为3
    const functionCode = '03';

    // 分组定时序号 (字节5) - 0-9
    const timerIndex = (timerData.index || 0).toString(16).padStart(2, '0');

    // 星期设置 (字节6) - bit0-bit6对应星期一到星期日
    let weekBits = 0;
    if (timerData.repeatDays && timerData.repeatDays.length > 0) {
        timerData.repeatDays.forEach(day => {
            if (day === 0) {
                // 周日对应bit6 (0x40)
                weekBits |= 0x40;
            } else if (day >= 1 && day <= 6) {
                // 周一(1)到周六(6)对应bit0到bit5
                weekBits |= (1 << (day - 1));
            }
        });
    }
    const weekData = weekBits.toString(16).padStart(2, '0');

    // 解析开启时间
    const startTimeParts = timerData.startTime.split(':');
    const startHour = parseInt(startTimeParts[0]).toString(16).padStart(2, '0');
    const startMinute = parseInt(startTimeParts[1]).toString(16).padStart(2, '0');
    const startSecond = parseInt(startTimeParts[2] || 0).toString(16).padStart(2, '0');

    // 解析关闭时间
    const endTimeParts = timerData.endTime.split(':');
    const endHour = parseInt(endTimeParts[0]).toString(16).padStart(2, '0');
    const endMinute = parseInt(endTimeParts[1]).toString(16).padStart(2, '0');
    const endSecond = parseInt(endTimeParts[2] || 0).toString(16).padStart(2, '0');

    // 组合完整命令
    const command = rollingCode + deviceType + functionCode + timerIndex + weekData +
        startHour + startMinute + startSecond + endHour + endMinute + endSecond;

    return command.toUpperCase();
};

// 发送分组定时命令
export function sendGroupTimerCommand(timerData, successCallback, errorCallback) {
    console.log('开始发送分组定时命令:', timerData);

    try {
        // 生成分组定时命令
        const command = generateGroupTimerCommand(timerData);
        console.log('生成的分组定时命令:', command);

        // 发送命令
        sendTimerSwitchCommand(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送分组定时命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

export { generateGroupTimerCommand } 