import { sendTimerSwitchCommand } from './core.js'

// 生成日落定时命令
const generateSunsetTimerCommand = (sunsetData) => {
    // 滚动码 (字节0-2) - 使用固定值
    const rollingCode = '112233';

    // 设备类型 (字节3) - 定时插座固定为1
    const deviceType = '01';

    // 功能码 (字节4) - 日落定时为6
    const functionCode = '06';

    // 字节5: 无意义，填充00
    const padding1 = '00';

    // 星期几 (字节6) - 0-6对应周日到周六
    const weekDay = (sunsetData.weekDay || 0).toString(16).padStart(2, '0');

    // 解析日落时间 (字节7-9)
    const sunsetTimeParts = sunsetData.sunsetTime.split(':');
    const sunsetHour = parseInt(sunsetTimeParts[0]).toString(16).padStart(2, '0');
    const sunsetMinute = parseInt(sunsetTimeParts[1]).toString(16).padStart(2, '0');
    const sunsetSecond = parseInt(sunsetTimeParts[2] || 0).toString(16).padStart(2, '0');

    // 字节10-12: 填充000000
    const padding2 = '000000';

    // 组合完整命令（13个字节，26个十六进制字符）
    const command = rollingCode + deviceType + functionCode + padding1 + weekDay +
        sunsetHour + sunsetMinute + sunsetSecond + padding2;

    return command.toUpperCase();
};

// 发送日落定时命令
export function sendSunsetTimerCommand(sunsetData, successCallback, errorCallback) {
    console.log('开始发送日落定时命令:', sunsetData);

    try {
        // 生成日落定时命令
        const command = generateSunsetTimerCommand(sunsetData);
        console.log('生成的日落定时命令:', command);

        // 详细解析命令内容用于调试
        console.log('日落定时命令解析:');
        console.log('  滚动码 (字节0-2):', command.substring(0, 6));
        console.log('  设备类型 (字节3):', command.substring(6, 8));
        console.log('  功能码 (字节4):', command.substring(8, 10));
        console.log('  填充 (字节5):', command.substring(10, 12));
        console.log('  星期几 (字节6):', command.substring(12, 14));
        console.log('  日落时 (字节7):', command.substring(14, 16));
        console.log('  日落分 (字节8):', command.substring(16, 18));
        console.log('  日落秒 (字节9):', command.substring(18, 20));
        console.log('  填充 (字节10-12):', command.substring(20, 26));
        console.log('  命令长度:', command.length, '字符 (', command.length / 2, '字节)');

        // 发送命令
        sendTimerSwitchCommand(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送日落定时命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

export { generateSunsetTimerCommand } 