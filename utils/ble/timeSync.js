import { sendTimerSwitchCommand } from './core.js'
import { COMMAND_CONFIG } from '../config.js'

/**
 * 生成时间同步命令
 * @param {Object} syncData - 时间同步数据
 * @param {string} syncData.rollingCode - 设备滚动码（可选，默认使用112233）
 * @param {Date} syncData.currentTime - 当前时间（可选，默认使用当前系统时间）
 * @returns {string} 十六进制命令字符串
 */
const generateTimeSyncCommand = (syncData = {}) => {
    // 滚动码 (字节0-2) - 使用传入的滚动码或默认值
    const rollingCode = syncData.rollingCode || '112233';

    // 设备类型 (字节3) - 定时插座固定为01
    const deviceType = '01';

    // 功能码 (字节4) - 时间同步功能码为07
    const functionCode = COMMAND_CONFIG.FUNCTION_CODE.TIME_SYNC;

    // 获取当前时间
    const currentTime = syncData.currentTime || new Date();

    // 字节5 - 保留字节，用00填充
    const reserved = '00';

    // 星期 (字节6) - 0=周日, 1=周一, ..., 6=周六
    const weekDay = currentTime.getDay().toString(16).padStart(2, '0');

    // 小时 (字节7) - 0-23时
    const hour = currentTime.getHours().toString(16).padStart(2, '0');

    // 分钟 (字节8) - 0-59分
    const minute = currentTime.getMinutes().toString(16).padStart(2, '0');

    // 秒钟 (字节9) - 0-59秒
    const second = currentTime.getSeconds().toString(16).padStart(2, '0');

    // 填充字节 (字节10-12) - 用000000填充
    const padding = '000000';

    // 组合完整命令 (13字节)
    const command = rollingCode + deviceType + functionCode + reserved + weekDay +
        hour + minute + second + padding;

    console.log('生成时间同步命令:', {
        rollingCode,
        deviceType,
        functionCode,
        reserved,
        weekDay: weekDay + ' (' + ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][currentTime.getDay()] + ')',
        hour: hour + ' (' + currentTime.getHours() + '时)',
        minute: minute + ' (' + currentTime.getMinutes() + '分)',
        second: second + ' (' + currentTime.getSeconds() + '秒)',
        time: `${currentTime.getFullYear()}-${(currentTime.getMonth() + 1).toString().padStart(2, '0')}-${currentTime.getDate().toString().padStart(2, '0')} ${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}:${currentTime.getSeconds().toString().padStart(2, '0')}`,
        command: command.toUpperCase()
    });

    return command.toUpperCase();
};

/**
 * 发送时间同步命令
 * @param {Object} syncData - 时间同步数据
 * @param {Function} successCallback - 成功回调
 * @param {Function} errorCallback - 失败回调
 */
export function sendTimeSyncCommand(syncData = {}, successCallback, errorCallback) {
    console.log('🕐 开始发送时间同步命令:', syncData);

    try {
        // 生成时间同步命令
        const command = generateTimeSyncCommand(syncData);
        console.log('🕐 生成的时间同步命令:', command);

        // 详细解析命令内容用于调试
        console.log('🕐 时间同步命令解析:');
        console.log('  滚动码 (字节0-2):', command.substring(0, 6));
        console.log('  设备类型 (字节3):', command.substring(6, 8));
        console.log('  功能码 (字节4):', command.substring(8, 10));
        console.log('  保留字节 (字节5):', command.substring(10, 12));
        console.log('  星期 (字节6):', command.substring(12, 14), '(周' + ['日', '一', '二', '三', '四', '五', '六'][parseInt(command.substring(12, 14), 16)] + ')');
        console.log('  小时 (字节7):', command.substring(14, 16), '(' + parseInt(command.substring(14, 16), 16) + '时)');
        console.log('  分钟 (字节8):', command.substring(16, 18), '(' + parseInt(command.substring(16, 18), 16) + '分)');
        console.log('  秒钟 (字节9):', command.substring(18, 20), '(' + parseInt(command.substring(18, 20), 16) + '秒)');
        console.log('  填充 (字节10-12):', command.substring(20, 26));
        console.log('  命令长度:', command.length, '字符 (', command.length / 2, '字节)');

        // 发送命令
        sendTimerSwitchCommand(command, successCallback, errorCallback);

    } catch (error) {
        console.error('🕐 发送时间同步命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

/**
 * 生成时间同步命令（导出用于测试）
 */
export { generateTimeSyncCommand }; 