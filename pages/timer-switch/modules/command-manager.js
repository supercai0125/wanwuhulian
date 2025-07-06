// 命令管理模块
import {
    sendCountdownCommand, sendLoopTimerCommand, sendGroupTimerCommand, sendSunsetTimerCommand, sendTimeSyncCommand,
    generateCountdownCommand, generateLoopTimerCommand, generateGroupTimerCommand, generateSunsetTimerCommand, generateTimeSyncCommand
} from '../../../utils/BLEUtil'
import { checkControlPermission, checkBatchOperationPermission } from '../../../utils/passwordUtil'
import { BLUETOOTH_CONFIG, UI_CONFIG } from '../../../utils/config'

class CommandManager {
    constructor(page, bluetoothManager) {
        this.page = page;
        this.bluetoothManager = bluetoothManager;
    }

    // 发送蓝牙广播命令
    sendBluetoothCommand(mode, power) {
        console.log('发送蓝牙命令 - 模式:', mode, '电源:', power);

        this.page.setData({
            bluetoothSending: true
        });

        // 根据模式选择不同的命令发送方式
        if (mode === 'countdown') {
            return this.handleCountdownMode();
        }

        if (mode === 'loop') {
            return this.handleLoopMode();
        }

        if (mode === 'group') {
            return this.handleGroupMode();
        }

        if (mode === 'sunset') {
            return this.handleSunsetMode();
        }

        // 常开和常关模式
        if (mode === 'off' || mode === 'on') {
            return this.handleSwitchMode(mode, power);
        }

        this.page.setData({
            bluetoothSending: false
        });
    }

    // 处理倒计时模式
    handleCountdownMode() {
        const countdownTime = this.page.data.device.timers.countdown;
        console.log('🔍 检查倒计时设置:', {
            countdownTime: countdownTime,
            type: typeof countdownTime,
            totalSeconds: countdownTime?.totalSeconds,
            isObject: typeof countdownTime === 'object',
            hasValidTime: countdownTime && countdownTime.totalSeconds > 0
        });

        if (!countdownTime || typeof countdownTime !== 'object' || !countdownTime.totalSeconds || countdownTime.totalSeconds <= 0) {
            console.log('❌ 倒计时检查失败，显示未设置提示');
            this.page.setData({
                bluetoothSending: false
            });
            wx.showModal({
                title: '倒计时未设置',
                content: '请先设置倒计时时间',
                showCancel: false
            });
            return;
        }

        const action = countdownTime.action || '开启';
        const bleAction = action === '开启' ? 'start' : 'stop';

        console.log('倒计时模式 - 执行操作:', action, '-> BLE动作:', bleAction);

        // 准备倒计时数据
        const countdownData = {
            action: bleAction,
            hours: countdownTime.hours || 0,
            minutes: countdownTime.minutes || 0,
            seconds: countdownTime.seconds || 0,
            totalSeconds: countdownTime.totalSeconds || 0
        };

        try {
            // 生成倒计时命令
            const command = generateCountdownCommand(countdownData);
            console.log('🔧 生成的倒计时命令:', command);

            // 使用蓝牙管理器发送命令，支持回复监听
            this.bluetoothManager.addCommandToQueue(command,
                (replyData) => {
                    console.log('✅ 倒计时命令执行成功，收到设备回复:', replyData);
                    this.page.setData({
                        bluetoothSending: false,
                        'device.mode': 'countdown'
                    });
                    this.page.showStatusTip(`倒计时${action}执行成功`, 1500);

                    // 重置离线检测状态
                    this.bluetoothManager.resetOfflineDetection();
                },
                (error) => {
                    console.error('❌ 倒计时命令执行失败:', error);
                    this.page.setData({
                        bluetoothSending: false
                    });

                    if (error.includes('离线')) {
                        this.page.showStatusTip(`倒计时${action}失败：设备可能离线`, 3000);
                    } else {
                        this.page.showStatusTip(`倒计时${action}发送失败`, 2000);
                    }
                },
                true // 期待设备回复
            );
        } catch (error) {
            console.error('生成倒计时命令失败:', error);
            this.page.setData({
                bluetoothSending: false
            });
            this.page.showStatusTip('生成倒计时命令失败', 2000);
        }
    }

    // 处理循环定时模式
    handleLoopMode() {
        const loopTimerData = wx.getStorageSync('loopTimerData');
        console.log('读取到的循环定时数据:', loopTimerData);

        if (!loopTimerData || (!loopTimerData.startDuration && !loopTimerData.endDuration)) {
            console.log('循环定时数据无效:', {
                hasData: !!loopTimerData,
                startDuration: loopTimerData?.startDuration,
                endDuration: loopTimerData?.endDuration
            });
            this.page.setData({
                bluetoothSending: false
            });
            wx.showModal({
                title: '循环定时未设置',
                content: '请先设置循环定时时长',
                showCancel: false
            });
            return;
        }

        console.log('准备发送循环定时命令:', loopTimerData);
        sendLoopTimerCommand(loopTimerData,
            () => {
                console.log('循环定时命令发送成功');
                this.page.setData({
                    bluetoothSending: false
                });
                this.page.showStatusTip('循环定时命令发送成功');
            },
            (error) => {
                console.error('循环定时命令发送失败:', error);
                this.page.setData({
                    bluetoothSending: false
                });
                wx.showModal({
                    title: '发送失败',
                    content: '循环定时命令发送失败，请检查蓝牙权限或重试',
                    showCancel: false
                });
            }
        );
    }

    // 处理分组定时模式
    handleGroupMode() {
        const timerList = wx.getStorageSync(`timers_${this.page.data.deviceId}`) || [];
        if (timerList.length === 0) {
            this.page.setData({
                bluetoothSending: false
            });
            wx.showModal({
                title: '分组定时未设置',
                content: '请先添加分组定时',
                showCancel: false
            });
            return;
        }

        if (timerList.length > 10) {
            this.page.setData({
                bluetoothSending: false
            });
            wx.showModal({
                title: '定时数量超限',
                content: '设备最多支持10个分组定时，当前有' + timerList.length + '个定时',
                showCancel: false
            });
            return;
        }

        checkBatchOperationPermission(this.page.data.deviceId, '发送所有分组定时')
            .then(() => {
                this.sendAllGroupTimers(timerList);
            })
            .catch((error) => {
                console.log('发送分组定时被取消:', error);
                this.page.setData({
                    bluetoothSending: false
                });
            });
    }

    // 处理日落定时模式
    handleSunsetMode() {
        const sunsetTimerData = wx.getStorageSync('sunsetTimerData');
        if (!sunsetTimerData || !sunsetTimerData.finalSunsetTime) {
            this.page.setData({
                bluetoothSending: false
            });
            wx.showModal({
                title: '日落定时未设置',
                content: '请先设置日落定时',
                showCancel: false
            });
            return;
        }

        const sunsetData = {
            weekDay: sunsetTimerData.weekDay || 0,
            sunsetTime: sunsetTimerData.finalSunsetTime
        };

        sendSunsetTimerCommand(sunsetData,
            () => {
                console.log('日落定时命令发送成功');
                this.page.setData({
                    bluetoothSending: false
                });
                this.page.showStatusTip('日落定时命令发送成功');
            },
            (error) => {
                console.error('日落定时命令发送失败:', error);
                this.page.setData({
                    bluetoothSending: false
                });
                wx.showModal({
                    title: '发送失败',
                    content: '日落定时命令发送失败，请检查蓝牙权限或重试',
                    showCancel: false
                });
            }
        );
    }

    // 处理开关模式
    handleSwitchMode(mode, power) {
        console.log('发送开关命令 - 电源状态:', power);

        const command = power ? '11223301026677889900112233' : '11223301016677889900112233';
        console.log('🔧 生成的开关命令:', command);

        const commandName = power ? '常开' : '常关';

        // 使用增强的命令队列，支持回复监听和离线检测
        this.bluetoothManager.addCommandToQueue(command,
            (replyData) => {
                console.log('✅ 命令执行成功，收到设备回复:', replyData);
                this.page.setData({
                    bluetoothSending: false,
                    'device.power': power,
                    'device.mode': mode
                });
                this.page.showStatusTip(`${commandName}执行成功`, 1500);

                // 重置离线检测状态（因为收到了回复）
                this.bluetoothManager.resetOfflineDetection();
            },
            (error) => {
                console.error('❌ 命令执行失败:', error);
                this.page.setData({
                    bluetoothSending: false
                });

                // 根据错误类型显示不同的提示
                if (error.includes('离线')) {
                    this.page.showStatusTip(`${commandName}失败：设备可能离线`, 3000);
                } else {
                    this.page.showStatusTip(`${commandName}发送失败`, 2000);
                }
            },
            true // 期待设备回复
        );
    }

    // 发送倒计时蓝牙命令
    sendCountdownCommand(action, countdownTime) {
        console.log('发送倒计时命令:', action, countdownTime);

        this.page.setData({
            bluetoothSending: true
        });

        let bleAction;
        if (action === 'start') {
            bleAction = 'on';
        } else if (action === 'stop') {
            bleAction = 'off';
        } else {
            bleAction = action;
        }

        const countdownData = {
            action: bleAction,
            hours: countdownTime.hours || 0,
            minutes: countdownTime.minutes || 0,
            seconds: countdownTime.seconds || 0,
            totalSeconds: countdownTime.totalSeconds || 0
        };

        console.log('BLE倒计时数据:', countdownData);

        sendCountdownCommand(countdownData,
            () => {
                console.log('倒计时命令发送成功');
                this.page.setData({
                    bluetoothSending: false
                });

                const actionText = action === 'start' ? '开启' : '关闭';
                this.page.showStatusTip(`倒计时${actionText}命令发送成功`);
            },
            (error) => {
                console.error('倒计时命令发送失败:', error);
                this.page.setData({
                    bluetoothSending: false
                });

                wx.showModal({
                    title: '发送失败',
                    content: '倒计时命令发送失败，请检查蓝牙权限或重试',
                    showCancel: false
                });
            }
        );
    }

    // 发送所有分组定时
    sendAllGroupTimers(timerList) {
        let currentIndex = 0;

        const sendNext = () => {
            if (currentIndex >= timerList.length) {
                this.page.setData({
                    bluetoothSending: false
                });
                this.page.showStatusTip('所有分组定时发送完成');
                return;
            }

            const timer = timerList[currentIndex];
            const timerData = {
                index: currentIndex,
                startTime: timer.startTime,
                endTime: timer.endTime,
                repeatDays: timer.repeatDays
            };

            sendGroupTimerCommand(timerData,
                () => {
                    console.log(`分组定时${currentIndex + 1}发送成功`);
                    currentIndex++;
                    setTimeout(sendNext, 1000);
                },
                (error) => {
                    console.error(`分组定时${currentIndex + 1}发送失败:`, error);
                    this.page.setData({
                        bluetoothSending: false
                    });

                    wx.showModal({
                        title: '发送失败',
                        content: `分组定时${currentIndex + 1}"${timer.name}"发送失败，是否继续发送剩余定时？`,
                        confirmText: '继续',
                        cancelText: '停止',
                        success: (res) => {
                            if (res.confirm) {
                                currentIndex++;
                                this.page.setData({
                                    bluetoothSending: true
                                });
                                setTimeout(sendNext, 1000);
                            }
                        }
                    });
                }
            );
        };

        sendNext();
    }

    // 时间同步功能
    syncDeviceTime() {
        console.log('🕐 开始手动时间同步');

        if (this.page.data.bluetoothSending) {
            wx.showToast({
                title: '正在处理中',
                icon: 'none',
                duration: UI_CONFIG.TOAST_NORMAL
            });
            return;
        }

        wx.showModal({
            title: '时间同步',
            content: '是否将当前系统时间同步到设备？',
            confirmText: '同步',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    this.performTimeSync();
                }
            }
        });
    }

    // 执行时间同步
    performTimeSync() {
        this.page.setData({
            bluetoothSending: true
        });

        wx.showLoading({
            title: '正在同步时间...',
        });

        const syncData = {
            rollingCode: this.page.data.deviceId || '112233',
            currentTime: new Date()
        };

        console.log('🕐 准备同步时间:', {
            deviceId: this.page.data.deviceId,
            currentTime: syncData.currentTime.toLocaleString()
        });

        sendTimeSyncCommand(syncData,
            () => {
                console.log('🕐 时间同步成功');
                wx.hideLoading();
                this.page.setData({
                    bluetoothSending: false
                });

                const deviceList = wx.getStorageSync('deviceList') || [];
                const deviceIndex = deviceList.findIndex(d => d.id === this.page.data.deviceId);
                if (deviceIndex !== -1) {
                    deviceList[deviceIndex].lastTimeSync = Date.now();
                    wx.setStorageSync('deviceList', deviceList);
                }

                this.page.showStatusTip('时间同步成功', UI_CONFIG.SUCCESS_TIP_DURATION);
            },
            (error) => {
                console.error('🕐 时间同步失败:', error);
                wx.hideLoading();
                this.page.setData({
                    bluetoothSending: false
                });

                wx.showModal({
                    title: '时间同步失败',
                    content: '无法同步时间到设备，请检查设备连接状态或重试。',
                    showCancel: false
                });
            }
        );
    }
}

export default CommandManager; 