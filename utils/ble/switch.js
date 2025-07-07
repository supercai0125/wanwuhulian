// 开关相关的蓝牙命令生成
// 移除对core.js的依赖，只提供命令生成功能

import unifiedBluetoothManager from './unified-manager.js'

// 生成开关命令
const generateSwitchCommand = (power, rollingCode) => {
    // 根据协议表格，开关命令格式：
    // 字节0-1: 滚动码 (2字节，4个十六进制字符)
    // 字节2: 第三字节 (00 - 固定值)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (01常关/02常开)
    // 字节5-12: 从字节5开始都填充0

    // 如果没有提供滚动码，使用默认值0000
    const deviceRollingCode = rollingCode || '0000';

    // 功能码：常开(02)，常关(01)
    const functionCode = power ? '02' : '01';

    // 生成命令：滚动码 + 00 + 设备类型01 + 功能码 + 从字节5开始填充0
    const command = `${deviceRollingCode}0001${functionCode}0000000000000000`;

    return command.toUpperCase();
}

// 生成匹配命令（用于小程序设备发现）
const generateMatchCommand = () => {
    // 根据协议表格，小程序配对命令格式：
    // 字节0-2: 滚动码 (00 00 00)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (08 - 小程序配对)
    // 字节5-12: 其他数据字段 (用0填充)
    return '00000001080000000000000000';
}

// 发送开关命令
export function sendSwitchCommand(power, successCallback, errorCallback) {
    try {
        // 获取当前设备的滚动码
        const rollingCode = unifiedBluetoothManager.deviceRollingCode;

        // 生成开关命令
        const command = generateSwitchCommand(power, rollingCode);

        // 使用统一管理器发送命令
        // 如果还没有设备滚动码，需要先发送匹配命令
        if (!rollingCode) {
            unifiedBluetoothManager.resetDeviceFilter();

            // 先发送匹配命令，等待设备回复
            setTimeout(() => {
                unifiedBluetoothManager.sendCommand(command, {
                    expectReply: true,
                    timeout: 8000,
                    successCallback: successCallback,
                    errorCallback: errorCallback
                });
            }, 1500); // 等待1.5秒让设备回复匹配命令
        } else {
            // 直接发送开关命令
            unifiedBluetoothManager.sendCommand(command, {
                expectReply: true,
                timeout: 8000,
                successCallback: successCallback,
                errorCallback: errorCallback
            });
        }

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

// 只发送广播命令，不监听回复（用于设备扫描页面）
export function sendSwitchBroadcastOnly(power, successCallback, errorCallback) {
    try {
        // 获取当前设备的滚动码
        const rollingCode = unifiedBluetoothManager.deviceRollingCode;

        // 生成开关命令
        const command = generateSwitchCommand(power, rollingCode);

        // 使用统一管理器发送命令，期望回复以便检测设备离线状态
        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true,
            timeout: 3000, // 增加超时时间以便检测设备离线
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

// 发送匹配命令用于设备发现（只发送广播）
export function sendMatchBroadcastOnly(successCallback, errorCallback) {
    try {
        // 生成匹配命令
        const command = generateMatchCommand();

        // 使用统一管理器发送仅广播命令
        // 重置设备过滤条件为0000（用于接收设备回复）
        unifiedBluetoothManager.resetDeviceFilter();

        unifiedBluetoothManager.sendCommand(command, {
            expectReply: true,
            timeout: 4000, // 仅广播，短超时
            successCallback: successCallback,
            errorCallback: errorCallback
        });

    } catch (error) {
        errorCallback && errorCallback(error);
    }
}

export { generateSwitchCommand, generateMatchCommand } 