// 蓝牙工具类 - 重新导出模块化结构以保持向后兼容

// 导入所有蓝牙功能
export {
    // 公共方法
    generateDataWithAddr,
    getServiceUUIDs,

    // 核心发送功能
    sendTimerSwitchCommand,

    // 设备回复监听功能
    startListeningForDeviceReply,
    stopListeningForDeviceReply,

    // 开关命令
    sendSwitchCommand,
    sendSwitchBroadcastOnly,
    sendMatchBroadcastOnly,
    generateSwitchCommand,

    // 倒计时命令
    sendCountdownCommand,
    generateCountdownCommand,

    // 分组定时命令
    sendGroupTimerCommand,
    generateGroupTimerCommand,

    // 循环定时命令
    sendLoopTimerCommand,
    generateLoopTimerCommand,

    // 日落定时命令
    sendSunsetTimerCommand,
    generateSunsetTimerCommand,

    // 时间同步命令
    sendTimeSyncCommand,
    generateTimeSyncCommand
} from './ble/index.js'

// 为了保持向后兼容，也提供module.exports导出
import * as BLEFunctions from './ble/index.js'

module.exports = {
    ...BLEFunctions
} 