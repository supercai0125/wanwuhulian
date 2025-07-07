// 倒计时相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 倒计时功能执行序号计数器
let countdownSequenceNumber = 0;

// 生成倒计时命令
const generateCountdownCommand = (countdownData, rollingCode) => {
    const { hours, minutes, seconds, power } = countdownData;

    // 根据协议表格，倒计时命令格式：
    // 字节0-1: 滚动码 (2字节，4个十六进制字符)
    // 字节2: 第三字节 (00 - 固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (04 - 倒计时功能)
    // 字节5: 倒计时功能执行序号 (按一次按钮加1，0-255循环)
    // 字节6: 倒计时结束后执行的操作 - 开启(01)/关闭(02)
    // 字节7: 小时 (0-23)
    // 字节8: 分钟 (0-59)
    // 字节9: 秒钟 (0-59)
    // 字节10-12: 其他数据字段 (用0填充)

    // 增加执行序号（0-255循环）
    countdownSequenceNumber = (countdownSequenceNumber + 1) % 256;
    const sequenceByte = countdownSequenceNumber.toString(16).padStart(2, '0');

    // 倒计时结束后执行的操作：开启(01)/关闭(02)
    const actionByte = power ? '01' : '02';

    const hoursByte = hours.toString(16).padStart(2, '0');
    const minutesByte = minutes.toString(16).padStart(2, '0');
    const secondsByte = seconds.toString(16).padStart(2, '0');

    // 使用实际的滚动码（2字节）+ 第三字节00 + 设备类型01 + 功能码04 + 执行序号 + 开启/关闭 + 时分秒 + 填充
    // 命令总长度13字节（26个十六进制字符）
    const command = `${rollingCode}000104${sequenceByte}${actionByte}${hoursByte}${minutesByte}${secondsByte}000000`;

    return command.toUpperCase();
}

// 发送倒计时命令
export function sendCountdownCommand(countdownData, rollingCode, successCallback, errorCallback) {
    try {

        // 生成倒计时命令
        const command = generateCountdownCommand(countdownData, rollingCode);

        // 使用统一管理器发送命令（期望回复，类似常开/常关命令）
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

export { generateCountdownCommand } 