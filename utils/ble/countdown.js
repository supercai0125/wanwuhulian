import { sendTimerSwitchCommand } from './core.js'

// 生成倒计时命令
const generateCountdownCommand = (countdownData) => {
    // 滚动码 (字节0-2) - 使用固定值
    const rollingCode = '112233';

    // 设备类型 (字节3) - 定时插座固定为1
    const deviceType = '01';

    // 功能码 (字节4) - 倒计时为4
    const functionCode = '04';

    // 倒计时功能执行序号 (字节5) - 0-9循环（暂定最大能执行10条）
    let currentSequence = wx.getStorageSync('countdownSequence') || 0;
    currentSequence = (currentSequence + 1) % 10; // 0-9循环
    wx.setStorageSync('countdownSequence', currentSequence);
    const sequenceNumber = currentSequence.toString(16).padStart(2, '0');

    // 倒计时开启（1）/倒计时关闭（2） (字节6)
    // 注意：这里的开启/关闭是指倒计时结束后要执行的操作
    let action;
    if (countdownData.action === 'on' || countdownData.action === 'start') {
        action = '01'; // 倒计时结束后开启设备
    } else if (countdownData.action === 'off' || countdownData.action === 'stop') {
        action = '02'; // 倒计时结束后关闭设备
    } else {
        action = '01'; // 默认开启
    }

    // 时分秒 (字节7-9) - 直接使用传入的时分秒
    const hours = countdownData.hours || 0;
    const minutes = countdownData.minutes || 0;
    const seconds = countdownData.seconds || 0;

    const hourHex = hours.toString(16).padStart(2, '0');
    const minuteHex = minutes.toString(16).padStart(2, '0');
    const secondHex = seconds.toString(16).padStart(2, '0');

    // 字节10-12: 无意义，填充00
    const padding = '000000';

    // 组合完整命令（13个字节，26个十六进制字符）
    const command = rollingCode + deviceType + functionCode + sequenceNumber + action +
        hourHex + minuteHex + secondHex + padding;

    return command.toUpperCase();
};

// 发送倒计时命令
export function sendCountdownCommand(countdownData, successCallback, errorCallback) {
    console.log('开始发送倒计时命令:', countdownData);

    try {
        // 生成倒计时命令
        const command = generateCountdownCommand(countdownData);
        console.log('生成的倒计时命令:', command);

        // 详细解析命令内容用于调试
        console.log('命令解析:');
        console.log('  滚动码 (字节0-2):', command.substring(0, 6));
        console.log('  设备类型 (字节3):', command.substring(6, 8));
        console.log('  功能码 (字节4):', command.substring(8, 10));
        console.log('  执行序号 (字节5):', command.substring(10, 12));
        console.log('  动作 (字节6):', command.substring(12, 14), countdownData.action === 'start' ? '(开启)' : '(关闭)');
        console.log('  时 (字节7):', command.substring(14, 16));
        console.log('  分 (字节8):', command.substring(16, 18));
        console.log('  秒 (字节9):', command.substring(18, 20));
        console.log('  填充 (字节10-12):', command.substring(20, 26));
        console.log('  命令长度:', command.length, '字符 (', command.length / 2, '字节)');

        // 发送命令
        sendTimerSwitchCommand(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送倒计时命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

export { generateCountdownCommand } 