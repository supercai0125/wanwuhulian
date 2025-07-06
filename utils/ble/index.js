// 蓝牙功能统一入口文件

// 导入公共方法
export { generateDataWithAddr, getServiceUUIDs } from './common.js'

// 导入核心发送功能
export { sendTimerSwitchCommand, sendBroadcastOnly, startListeningForDeviceReply, stopListeningForDeviceReply } from './core.js'

// 导入开关命令
export { sendSwitchCommand, sendSwitchBroadcastOnly, sendMatchBroadcastOnly, generateSwitchCommand } from './switch.js'

// 导入倒计时命令
export { sendCountdownCommand, generateCountdownCommand } from './countdown.js'

// 导入分组定时命令
export { sendGroupTimerCommand, generateGroupTimerCommand } from './groupTimer.js'

// 导入循环定时命令
export { sendLoopTimerCommand, generateLoopTimerCommand } from './loopTimer.js'

// 导入日落定时命令
export { sendSunsetTimerCommand, generateSunsetTimerCommand } from './sunsetTimer.js'

// 导入时间同步命令
export { sendTimeSyncCommand, generateTimeSyncCommand } from './timeSync.js' 