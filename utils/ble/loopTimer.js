import { sendTimerSwitchCommand } from './core.js'

// 生成循环定时命令 - 备用方案 (时分秒格式)
const generateLoopTimerCommandHMS = (loopData) => {
    const rollingCode = '112233';
    const deviceType = '01';
    const functionCode = '05';
    const enableFlag = '01';
    const padding1 = '00';

    // 使用时分秒格式
    const startDurationParts = loopData.startDuration.split(':');
    const startHour = parseInt(startDurationParts[0]).toString(16).padStart(2, '0');
    const startMinute = parseInt(startDurationParts[1]).toString(16).padStart(2, '0');
    const startSecond = parseInt(startDurationParts[2] || 0).toString(16).padStart(2, '0');

    const endDurationParts = loopData.endDuration.split(':');
    const endHour = parseInt(endDurationParts[0]).toString(16).padStart(2, '0');
    const endMinute = parseInt(endDurationParts[1]).toString(16).padStart(2, '0');
    const endSecond = parseInt(endDurationParts[2] || 0).toString(16).padStart(2, '0');

    const command = rollingCode + deviceType + functionCode + enableFlag + padding1 +
        startHour + startMinute + startSecond + endHour + endMinute + endSecond;

    console.log('备用方案 - 时分秒格式命令:', command);
    return command.toUpperCase();
};

// 生成循环定时命令
const generateLoopTimerCommand = (loopData) => {
    // 滚动码 (字节0-2) - 使用固定值
    const rollingCode = '112233';

    // 设备类型 (字节3) - 定时插座固定为1
    const deviceType = '01';

    // 功能码 (字节4) - 循环定时为5
    const functionCode = '05';

    // 循环定时启用标志 (字节5) - 01表示启用，00表示禁用
    const enableFlag = '01';

    // 字节6: 预留，填充00
    const padding1 = '00';

    // 方案1: 使用时分秒格式 (原方案)
    const startDurationParts = loopData.startDuration.split(':');
    const startHour = parseInt(startDurationParts[0]).toString(16).padStart(2, '0');
    const startMinute = parseInt(startDurationParts[1]).toString(16).padStart(2, '0');
    const startSecond = parseInt(startDurationParts[2] || 0).toString(16).padStart(2, '0');

    const endDurationParts = loopData.endDuration.split(':');
    const endHour = parseInt(endDurationParts[0]).toString(16).padStart(2, '0');
    const endMinute = parseInt(endDurationParts[1]).toString(16).padStart(2, '0');
    const endSecond = parseInt(endDurationParts[2] || 0).toString(16).padStart(2, '0');

    // 方案2: 使用总秒数格式 (新尝试)
    const startTotalSeconds = parseInt(startDurationParts[0]) * 3600 +
        parseInt(startDurationParts[1]) * 60 +
        parseInt(startDurationParts[2] || 0);
    const endTotalSeconds = parseInt(endDurationParts[0]) * 3600 +
        parseInt(endDurationParts[1]) * 60 +
        parseInt(endDurationParts[2] || 0);

    // 将总秒数转换为3字节十六进制 (最大支持16777215秒，约4660小时)
    const startSecondsHex = startTotalSeconds.toString(16).padStart(6, '0');
    const endSecondsHex = endTotalSeconds.toString(16).padStart(6, '0');

    console.log('循环定时命令生成调试:');
    console.log('  开启时长:', loopData.startDuration, '-> 总秒数:', startTotalSeconds, '-> 十六进制:', startSecondsHex);
    console.log('  关闭时长:', loopData.endDuration, '-> 总秒数:', endTotalSeconds, '-> 十六进制:', endSecondsHex);

    // 当前使用方案2: 总秒数格式
    const command = rollingCode + deviceType + functionCode + enableFlag + padding1 +
        startSecondsHex + endSecondsHex;

    console.log('使用总秒数格式的命令:', command);

    // 如果需要切换到时分秒格式，取消下面注释并注释上面的命令生成
    // const command = rollingCode + deviceType + functionCode + enableFlag + padding1 +
    //     startHour + startMinute + startSecond + endHour + endMinute + endSecond;
    // console.log('使用时分秒格式的命令:', command);

    return command.toUpperCase();
};

// 发送循环定时命令
export function sendLoopTimerCommand(loopData, successCallback, errorCallback) {
    console.log('开始发送循环定时命令:', loopData);

    try {
        // 验证输入数据
        if (!loopData.startDuration || !loopData.endDuration) {
            throw new Error('循环定时数据不完整');
        }

        // 详细解析输入数据
        console.log('循环定时输入数据详细解析:');
        console.log('  开启时长原始:', loopData.startDuration);
        console.log('  关闭时长原始:', loopData.endDuration);

        // 解析开启时长
        const startParts = loopData.startDuration.split(':');
        const startHours = parseInt(startParts[0]) || 0;
        const startMinutes = parseInt(startParts[1]) || 0;
        const startSeconds = parseInt(startParts[2]) || 0;

        console.log('  开启时长解析: 时=' + startHours + ', 分=' + startMinutes + ', 秒=' + startSeconds);
        console.log('  开启总秒数:', startHours * 3600 + startMinutes * 60 + startSeconds);

        // 解析关闭时长
        const endParts = loopData.endDuration.split(':');
        const endHours = parseInt(endParts[0]) || 0;
        const endMinutes = parseInt(endParts[1]) || 0;
        const endSeconds = parseInt(endParts[2]) || 0;

        console.log('  关闭时长解析: 时=' + endHours + ', 分=' + endMinutes + ', 秒=' + endSeconds);
        console.log('  关闭总秒数:', endHours * 3600 + endMinutes * 60 + endSeconds);

        // 生成循环定时命令
        const command = generateLoopTimerCommand(loopData);
        console.log('生成的循环定时命令:', command);

        // 详细解析命令内容用于调试
        console.log('循环定时命令解析:');
        console.log('  滚动码 (字节0-2):', command.substring(0, 6));
        console.log('  设备类型 (字节3):', command.substring(6, 8));
        console.log('  功能码 (字节4):', command.substring(8, 10));
        console.log('  启用标志 (字节5):', command.substring(10, 12));
        console.log('  填充 (字节6):', command.substring(12, 14));
        console.log('  开启总秒数 (字节7-9):', command.substring(14, 20), '(十进制:', parseInt(command.substring(14, 20), 16) + ')');
        console.log('  关闭总秒数 (字节10-12):', command.substring(20, 26), '(十进制:', parseInt(command.substring(20, 26), 16) + ')');
        console.log('  命令长度:', command.length, '字符 (', command.length / 2, '字节)');

        // 发送命令
        sendTimerSwitchCommand(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送循环定时命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

export { generateLoopTimerCommand } 