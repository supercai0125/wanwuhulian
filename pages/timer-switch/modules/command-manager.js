// 命令管理器 - 处理各种蓝牙命令的发送
// 基于统一蓝牙管理器，提供高级命令处理功能

import { verifyControlPassword } from '../../../utils/passwordUtil.js'
import { sendCountdownCommand } from '../../../utils/ble/countdown.js'
import { sendLoopTimerCommand } from '../../../utils/ble/loopTimer.js'
import { sendGroupTimerCommand } from '../../../utils/ble/groupTimer.js'
import { sendSunsetTimerCommand } from '../../../utils/ble/sunsetTimer.js'
import { sendTimeSyncCommand } from '../../../utils/ble/timeSync.js'
import { sendSwitchCommand, sendSwitchBroadcastOnly, sendMatchBroadcastOnly } from '../../../utils/ble/switch.js'
import unifiedBluetoothManager from '../../../utils/ble/unified-manager.js'

class CommandManager {
    constructor(page, bluetoothManager) {
        this.page = page;
        this.bluetoothManager = bluetoothManager;
        this.passwordRequired = false; // 是否需要密码验证
    }

    // 获取设备滚动码
    getDeviceRollingCode() {
        return this.page.data.deviceId || '0000';
    }

    // 发送蓝牙命令
    sendBluetoothCommand(mode, power, data = {}) {
        console.log('📡 CommandManager.sendBluetoothCommand 调用:', {
            mode: mode,
            power: power,
            data: data,
            modeType: typeof mode,
            powerType: typeof power
        });

        return new Promise((resolve, reject) => {
            switch (mode) {
                case 'switch':
                    console.log('📡 处理 switch 命令');
                    this.handleSwitchCommand(power, resolve, reject);
                    break;
                case 'off':
                case 'on':
                    // 常开/常关模式，映射到开关命令
                    console.log('📡 处理 off/on 命令，映射到开关命令');
                    this.handleSwitchCommand(power, resolve, reject);
                    break;
                case 'countdown':
                    console.log('📡 处理 countdown 命令');
                    this.handleCountdownCommand(data, resolve, reject);
                    break;
                case 'loop':
                    console.log('📡 处理 loop 命令');
                    this.handleLoopTimerCommand(data, resolve, reject);
                    break;
                case 'group':
                    console.log('📡 处理 group 命令');
                    this.handleGroupTimerCommand(data, resolve, reject);
                    break;
                case 'sunset':
                    console.log('📡 处理 sunset 命令');
                    this.handleSunsetTimerCommand(data, resolve, reject);
                    break;
                case 'timeSync':
                    console.log('📡 处理 timeSync 命令');
                    this.handleTimeSyncCommand(data, resolve, reject);
                    break;
                default:
                    console.error('📡 未知的命令模式:', mode);
                    reject(new Error('未知的命令模式: ' + mode));
            }
        });
    }

    // 处理开关命令
    handleSwitchCommand(power, resolve, reject) {
        console.log('📡 handleSwitchCommand 调用:', {
            power: power
        });

        // 对于常开/常关操作，使用快速广播模式，不等待回复
        sendSwitchBroadcastOnly(power, (result) => {
            console.log('📡 开关命令发送成功:', result);
            resolve(result);
        }, (error) => {
            console.error('📡 开关命令发送失败:', error);
            reject(error);
        });
    }

    // 处理倒计时命令
    handleCountdownCommand(data, resolve, reject) {
        if (!data.action || (data.hours === undefined && data.minutes === undefined && data.seconds === undefined)) {
            reject(new Error('倒计时数据不完整'));
            return;
        }

        const { action, hours = 0, minutes = 0, seconds = 0, endAction = '关闭' } = data;

        const countdownData = {
            // power字段表示倒计时结束后执行的操作：true=开启，false=关闭
            power: endAction === '开启',
            hours: parseInt(hours) || 0,
            minutes: parseInt(minutes) || 0,
            seconds: parseInt(seconds) || 0
        };

        if (this.passwordRequired) {
            verifyControlPassword('倒计时设置', () => {
                this.sendCountdownCommandInternal(countdownData, resolve, reject);
            }, reject);
        } else {
            this.sendCountdownCommandInternal(countdownData, resolve, reject);
        }
    }

    // 内部发送倒计时命令
    sendCountdownCommandInternal(countdownData, resolve, reject) {
        try {
            const rollingCode = this.getDeviceRollingCode();
            sendCountdownCommand(countdownData, rollingCode, (replyData) => {
                resolve(replyData);
            }, (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    }

    // 处理循环定时命令
    handleLoopTimerCommand(data, resolve, reject) {
        if (!data.startTime || !data.endTime) {
            reject(new Error('循环定时数据不完整'));
            return;
        }

        const { startTime, endTime, sequenceNumber = 0 } = data;

        const loopData = {
            startTime: startTime,
            endTime: endTime,
            sequenceNumber: parseInt(sequenceNumber) || 0 // 功能执行序号
        };

        if (this.passwordRequired) {
            verifyControlPassword('循环定时设置', () => {
                this.sendLoopTimerCommandInternal(loopData, resolve, reject);
            }, reject);
        } else {
            this.sendLoopTimerCommandInternal(loopData, resolve, reject);
        }
    }

    // 内部发送循环定时命令
    sendLoopTimerCommandInternal(loopData, resolve, reject) {
        try {
            const rollingCode = this.getDeviceRollingCode();
            sendLoopTimerCommand(loopData, rollingCode, (replyData) => {
                resolve(replyData);
            }, (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    }

    // 处理分组定时命令
    handleGroupTimerCommand(data, resolve, reject) {
        // 检查定时器数据格式
        if (!data.startTime || !data.endTime || !data.repeatDays) {
            reject(new Error('分组定时数据不完整'));
            return;
        }

        // 转换为分组定时命令格式，保留所有重要字段包括groupId
        const groupData = {
            id: data.id || 'timer_' + Date.now(),
            name: data.name || '定时任务',
            startTime: data.startTime,
            endTime: data.endTime,
            repeatDays: data.repeatDays,
            groupId: data.groupId, // 保留groupId字段
            enabled: true
        };

        if (this.passwordRequired) {
            verifyControlPassword('分组定时设置', () => {
                this.sendGroupTimerCommandInternal(groupData, resolve, reject);
            }, reject);
        } else {
            this.sendGroupTimerCommandInternal(groupData, resolve, reject);
        }
    }

    // 内部发送分组定时命令
    sendGroupTimerCommandInternal(groupData, resolve, reject) {
        try {
            const rollingCode = this.getDeviceRollingCode();
            sendGroupTimerCommand(groupData, rollingCode, (result) => {
                resolve(result);
            }, (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    }

    // 处理日落定时命令
    handleSunsetTimerCommand(data, resolve, reject) {
        const { sunriseHour = 6, sunriseMinute = 0, sunsetHour = 18, sunsetMinute = 0, executeMode = 1 } = data;

        const sunsetData = {
            sunriseHour: parseInt(sunriseHour) || 6,
            sunriseMinute: parseInt(sunriseMinute) || 0,
            sunsetHour: parseInt(sunsetHour) || 18,
            sunsetMinute: parseInt(sunsetMinute) || 0,
            executeMode: parseInt(executeMode) || 1
        };

        if (this.passwordRequired) {
            verifyControlPassword('日落定时设置', () => {
                this.sendSunsetTimerCommandInternal(sunsetData, resolve, reject);
            }, reject);
        } else {
            this.sendSunsetTimerCommandInternal(sunsetData, resolve, reject);
        }
    }

    // 内部发送日落定时命令
    sendSunsetTimerCommandInternal(sunsetData, resolve, reject) {
        try {
            const rollingCode = this.getDeviceRollingCode();
            sendSunsetTimerCommand(sunsetData, rollingCode, (replyData) => {
                resolve(replyData);
            }, (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    }

    // 处理时间同步命令
    handleTimeSyncCommand(data, resolve, reject) {
        const syncData = data || {};

        if (this.passwordRequired) {
            verifyControlPassword('时间同步', () => {
                this.sendTimeSyncCommandInternal(syncData, resolve, reject);
            }, reject);
        } else {
            this.sendTimeSyncCommandInternal(syncData, resolve, reject);
        }
    }

    // 内部发送时间同步命令
    sendTimeSyncCommandInternal(syncData, resolve, reject) {
        try {
            const rollingCode = this.getDeviceRollingCode();
            sendTimeSyncCommand(rollingCode, syncData, (replyData) => {
                resolve(replyData);
            }, (error) => {
                reject(error);
            });
        } catch (error) {
            reject(error);
        }
    }

    // 设置是否需要密码验证
    setPasswordRequired(required) {
        this.passwordRequired = required;
    }

    // 获取是否需要密码验证
    getPasswordRequired() {
        return this.passwordRequired;
    }

    // 时间同步
    syncDeviceTime() {
        console.log('📡 syncDeviceTime 调用');
        return this.sendBluetoothCommand('timeSync', null, {});
    }


}

export default CommandManager; 