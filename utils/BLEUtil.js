// 蓝牙工具类 - 使用统一的蓝牙管理器
// 提供简化的接口，内部使用统一管理器处理广播和监听

import unifiedBluetoothManager from './ble/unified-manager.js'

// 启动设备回复监听
export function startDeviceReplyListener(callback) {
    try {
        unifiedBluetoothManager.setReplyCallback(callback);
        unifiedBluetoothManager.init().then(() => {
            if (callback) {
                callback();
            }
        }).catch(err => {
            if (callback) {
                callback(err);
            }
        });
    } catch (err) {
        if (callback) {
            callback(err);
        }
    }
}

// 停止设备回复监听
export function stopDeviceReplyListener() {
    unifiedBluetoothManager.stopListening();
}

// 发送时控开关命令
export function sendTimerSwitchCommand(command, successCallback, errorCallback) {
    unifiedBluetoothManager.sendCommand(command, {
        expectReply: true,
        timeout: 8000,
        successCallback: successCallback,
        errorCallback: errorCallback
    });
}

// 发送广播命令
export function sendBroadcastCommand(command, successCallback, errorCallback) {
    unifiedBluetoothManager.sendCommand(command, {
        expectReply: true,
        timeout: 8000,
        successCallback: successCallback,
        errorCallback: errorCallback
    });
}

// 发送仅广播命令（不监听回复）
export function sendBroadcastOnly(command, successCallback, errorCallback) {
    unifiedBluetoothManager.sendCommand(command, {
        expectReply: false,
        timeout: 1000,
        successCallback: successCallback,
        errorCallback: errorCallback
    });
}

// 重新导出switch.js中的函数以保持兼容性
export { sendSwitchCommand, sendSwitchBroadcastOnly, sendMatchBroadcastOnly } from './ble/switch.js'

// 重新导出其他命令函数
export { sendCountdownCommand } from './ble/countdown.js'
export { sendGroupTimerCommand } from './ble/groupTimer.js'
export { sendLoopTimerCommand } from './ble/loopTimer.js'
export { sendSunsetTimerCommand } from './ble/sunsetTimer.js'
export { sendTimeSyncCommand } from './ble/timeSync.js'

// 设置回复回调函数
export function setReplyCallback(callback) {
    unifiedBluetoothManager.setReplyCallback(callback);
}

// 初始化蓝牙管理器
export function initBluetoothManager() {
    return unifiedBluetoothManager.init();
}

// 清理蓝牙管理器资源
export function cleanupBluetoothManager() {
    unifiedBluetoothManager.cleanup();
}

// 获取管理器实例（用于高级用法）
export function getBluetoothManager() {
    return unifiedBluetoothManager;
}

// 导出生成函数（直接从各模块导入）
export { generateDataWithAddr, getServiceUUIDs } from './ble/common.js'
export { generateSwitchCommand } from './ble/switch.js'
export { generateCountdownCommand } from './ble/countdown.js'
export { generateGroupTimerCommand } from './ble/groupTimer.js'
export { generateLoopTimerCommand } from './ble/loopTimer.js'
export { generateSunsetTimerCommand } from './ble/sunsetTimer.js'
export { generateTimeSyncCommand } from './ble/timeSync.js'

// 导出统一管理器（默认导出）
export default unifiedBluetoothManager; 