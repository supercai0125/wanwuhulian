// 重构后的时控开关主文件
import { checkControlPermission } from '../../utils/passwordUtil'
import { BLUETOOTH_CONFIG, UI_CONFIG } from '../../utils/config'
import BluetoothManager from './modules/bluetooth-manager.js'
import PasswordManager from './modules/password-manager.js'
import CommandManager from './modules/command-manager.js'
import unifiedBluetoothManager from '../../utils/ble/unified-manager.js'

Page({
    data: {
        deviceId: '',
        statusTip: '',
        bluetoothSending: false,
        advertiseReady: false,
        server: null,
        lastCommandTime: 0,
        lastCommandType: '',
        isAdvertising: false,
        commandQueue: [],
        deviceOfflineConfirmed: false,
        device: {
            id: '',
            name: '时控开关',
            type: 'timer-switch',
            status: true,
            power: false,
            mode: 'off',
            passwordEnabled: false,
            lastSeen: Date.now(), // 最后一次通信时间
            timers: {
                countdown: null,
                loop: {
                    enabled: false,
                    startTime: '18:00',
                    endTime: '06:00'
                },
                sunset: {
                    enabled: false,
                    offset: 0
                }
            }
        }
    },

    onLoad: function (options) {
        const deviceId = options.id;
        this.setData({
            deviceId: deviceId
        });

        // 初始化管理器
        this.bluetoothManager = new BluetoothManager(this);
        this.passwordManager = new PasswordManager(this);
        this.commandManager = new CommandManager(this, this.bluetoothManager);

        // 设置统一蓝牙管理器的设备滚动码
        if (deviceId) {
            unifiedBluetoothManager.deviceRollingCode = deviceId;
            console.log('📡 设置设备滚动码:', deviceId);
        }

        // 加载设备数据并初始化蓝牙
        this.loadDeviceData();
        this.bluetoothManager.initAdapter();
    },

    onShow: function () {
        this.loadDeviceData();

        // 页面显示时重置离线检测状态，因为用户可能刚从设备扫描页面返回
        if (this.bluetoothManager) {
            this.bluetoothManager.resetOfflineDetection();
            // 启动回复监听
            this.bluetoothManager.startReplyMonitoring();
        }

        // 不再自动检查设备状态，避免频繁发送匹配命令
        // 设备状态由列表页面的统一状态检测来管理
    },

    onHide: function () {
        // 页面隐藏时停止蓝牙广播和回复监听以节省资源
        if (this.data.server) {
            this.data.server.stopAdvertising({
                success: () => {
                    console.log('页面隐藏，蓝牙广播已停止');
                },
                fail: (err) => {
                    console.error('停止蓝牙广播失败:', err);
                }
            });
        }

        // 停止回复监听以节省资源
        if (this.bluetoothManager) {
            this.bluetoothManager.stopReplyMonitoring();
        }

        // 清理统一蓝牙管理器的命令队列
        unifiedBluetoothManager.clearCommandQueue();

        // 同步设备状态到存储，确保列表页面状态一致
        this.syncDeviceStatusToStorage();
    },

    onUnload: function () {
        // 清理资源
        if (this.bluetoothManager) {
            this.bluetoothManager.cleanup();
        }

        // 清理统一蓝牙管理器的命令队列
        unifiedBluetoothManager.clearCommandQueue();

        // 保存设备设置
        this.saveDeviceSettings();
    },

    // 加载设备数据
    loadDeviceData: function () {
        // 保存当前内存中的数据（如果存在）
        const currentCountdown = this.data.device?.timers?.countdown;
        const currentMode = this.data.device?.mode;
        const currentPower = this.data.device?.power;

        // 从已发现设备列表中获取设备信息（包含在线状态）
        const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
        const discoveredDevice = discoveredDevices.find(d => d.rollingCode === this.data.deviceId);

        // 从设备列表中获取控制器配置
        const deviceList = wx.getStorageSync('deviceList') || [];
        const device = deviceList.find(d => d.id === this.data.deviceId);

        let deviceData = {};

        if (discoveredDevice) {
            deviceData = {
                id: discoveredDevice.rollingCode,
                name: `设备 ${discoveredDevice.rollingCode}`,
                type: 'timer-switch',
                lastSeen: discoveredDevice.lastSeen
            };
        } else if (device) {
            deviceData = {
                ...device
            };
        } else {
            return;
        }

        // 初始化控制器数据
        let controllerData = {};
        if (device && device.controller) {
            controllerData = device.controller;

            // 修复旧版本的数据格式兼容性问题
            if (controllerData.timers && typeof controllerData.timers.countdown === 'number') {
                controllerData.timers.countdown = null;
            }
        } else {
            controllerData = {
                power: false,
                mode: 'off',
                passwordEnabled: false,
                timers: {
                    countdown: null,
                    loop: {
                        enabled: false,
                        startTime: '00:00:00',
                        endTime: '00:00:00'
                    },
                    sunset: {
                        enabled: false,
                        offset: 0
                    }
                }
            };
        }

        // 如果当前内存中有有效的数据，优先使用内存中的数据
        if (currentCountdown && typeof currentCountdown === 'object' && currentCountdown.totalSeconds > 0) {
            controllerData.timers.countdown = currentCountdown;
        }

        // 如果当前内存中有模式和电源状态，优先使用内存中的数据（避免页面切换时重置）
        if (currentMode) {
            controllerData.mode = currentMode;
        }

        if (typeof currentPower === 'boolean') {
            controllerData.power = currentPower;
        }

        this.setData({
            device: {
                ...deviceData,
                ...controllerData
            }
        });
    },

    // 显示状态提示
    showStatusTip: function (tip, duration = 2000) {
        this.setData({
            statusTip: tip
        });

        setTimeout(() => {
            this.setData({
                statusTip: ''
            });
        }, duration);
    },

    // 同步设备状态到存储
    syncDeviceStatusToStorage: function () {
        try {
            const deviceId = this.data.deviceId;
            const currentDevice = this.data.device;

            if (!deviceId || !currentDevice) {
                return;
            }

            // 更新已发现设备列表中的状态
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.map(device => {
                if (device.rollingCode === deviceId) {
                    return {
                        ...device,
                        lastSeen: currentDevice.lastSeen || device.lastSeen || Date.now()
                    };
                }
                return device;
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);

            return true; // 返回成功标识
        } catch (error) {
            console.error('同步设备状态到存储失败:', error);
            return false;
        }
    },

    // 设置模式
    setMode: function (e) {
        const mode = e.currentTarget.dataset.mode;
        const currentTime = Date.now();
        const currentCommandType = `mode_${mode}`;

        // 防重复点击检查
        if (this.data.lastCommandType === currentCommandType &&
            currentTime - this.data.lastCommandTime < BLUETOOTH_CONFIG.ANTI_DUPLICATE_CLICK) {
            wx.showToast({
                title: '请勿重复点击',
                icon: 'none',
                duration: UI_CONFIG.TOAST_SHORT
            });
            return;
        }

        // 检查是否正在发送命令
        if (this.data.bluetoothSending) {
            wx.showToast({
                title: '正在处理中',
                icon: 'none',
                duration: UI_CONFIG.TOAST_NORMAL
            });
            return;
        }

        let power = this.data.device.power;

        // 根据模式设置电源状态
        if (mode === 'off') {
            power = false;
        } else if (mode === 'on') {
            power = true;
        }

        // 获取模式名称用于显示
        const modeNames = {
            'off': '常关',
            'on': '常开',
            'countdown': '倒计时',
            'loop': '循环定时',
            'sunset': '日落定时',
            'group': '分组定时'
        };

        // 执行模式切换的函数
        const executeMode = () => {
            // 对于需要额外设置的模式，检查是否已经配置
            if (mode === 'countdown') {
                // 检查是否已经设置了倒计时
                const countdownTimer = this.data.device.timers?.countdown;
                if (!countdownTimer || !countdownTimer.totalSeconds || countdownTimer.totalSeconds <= 0) {
                    // 没有设置倒计时，提示用户先设置
                    this.showStatusTip('请先设置倒计时时间');
                    return;
                }
                // 已经设置了倒计时，准备发送倒计时命令
                const countdownData = {
                    action: 'start', // 启动倒计时
                    hours: countdownTimer.hours || 0,
                    minutes: countdownTimer.minutes || 0,
                    seconds: countdownTimer.seconds || 0,
                    // 添加倒计时结束后的执行操作
                    endAction: countdownTimer.action || '关闭' // 从倒计时设置中获取
                };

                this.setData({
                    'device.mode': mode,
                    'device.power': true, // 倒计时模式默认开启
                    lastCommandTime: currentTime,
                    lastCommandType: currentCommandType
                });

                this.updateDeviceSettings('mode', mode);
                this.updateDeviceSettings('power', true);

                this.showStatusTip('已切换到' + modeNames[mode] + '模式');

                // 发送倒计时命令
                this.commandManager.sendBluetoothCommand(mode, true, countdownData)
                    .then((result) => {
                        console.log('📡 倒计时命令发送成功:', result);
                        this.handleCommandSuccess('倒计时设置成功');
                    })
                    .catch((error) => {
                        console.error('📡 倒计时命令发送失败:', error);
                        this.handleCommandError(error);
                    });
                return;
            } else if (mode === 'loop') {
                // 检查是否已经设置了循环定时
                const loopTimerData = wx.getStorageSync('loopTimerData');
                if (!loopTimerData || (!loopTimerData.startDuration && !loopTimerData.endDuration)) {
                    this.showStatusTip('请先设置循环定时');
                    return;
                }

                // 转换数据格式为命令需要的格式
                const loopTimer = {
                    startTime: loopTimerData.startDuration || '00:00:00',
                    endTime: loopTimerData.endDuration || '00:00:00',
                    sequenceNumber: 0 // 功能执行序号，可以根据需要递增
                };

                // 切换到循环定时模式
                this.setData({
                    'device.mode': mode,
                    'device.power': true, // 循环定时模式默认开启
                    lastCommandTime: currentTime,
                    lastCommandType: currentCommandType
                });

                this.updateDeviceSettings('mode', mode);
                this.updateDeviceSettings('power', true);

                this.showStatusTip(`已切换到${modeNames[mode]}模式`);

                // 发送循环定时命令
                this.commandManager.sendBluetoothCommand('loop', true, loopTimer)
                    .then((result) => {
                        console.log('📡 循环定时命令发送成功:', result);
                        this.handleCommandSuccess('循环定时设置成功');
                    })
                    .catch((error) => {
                        console.error('📡 循环定时命令发送失败:', error);
                        this.handleCommandError(error);
                    });
                return;
            } else if (mode === 'sunset') {
                // 检查是否已经设置了日落定时
                const sunsetTimerData = wx.getStorageSync('sunsetTimerData');
                if (!sunsetTimerData || !sunsetTimerData.finalSunsetTime) {
                    this.showStatusTip('请先设置日落定时');
                    return;
                }

                // 解析日落时间
                const sunsetTime = sunsetTimerData.finalSunsetTime || '18:00:00';
                const [sunsetHour, sunsetMinute] = sunsetTime.split(':').map(t => parseInt(t));

                // 解析日出时间
                const sunriseTime = sunsetTimerData.finalSunriseTime || '06:00:00';
                const [sunriseHour, sunriseMinute] = sunriseTime.split(':').map(t => parseInt(t));

                // 切换到日落定时模式
                this.setData({
                    'device.mode': mode,
                    'device.power': true, // 日落定时模式默认开启
                    lastCommandTime: currentTime,
                    lastCommandType: currentCommandType
                });

                this.updateDeviceSettings('mode', mode);
                this.updateDeviceSettings('power', true);

                this.showStatusTip(`已切换到${modeNames[mode]}模式`);

                // 发送日落定时命令
                this.commandManager.sendBluetoothCommand('sunset', true, {
                    sunriseHour: sunriseHour,
                    sunriseMinute: sunriseMinute,
                    sunsetHour: sunsetHour,
                    sunsetMinute: sunsetMinute,
                    executeMode: sunsetTimerData.executeMode || 1
                })
                    .then((result) => {
                        console.log('📡 日落定时命令发送成功:', result);
                        this.handleCommandSuccess('日落定时设置成功');
                    })
                    .catch((error) => {
                        console.error('📡 日落定时命令发送失败:', error);
                        this.handleCommandError(error);
                    });
                return;
            } else if (mode === 'group') {
                // 检查是否已经设置了分组定时
                const groupTimers = wx.getStorageSync(`timers_${this.data.deviceId}`) || [];
                if (groupTimers.length === 0) {
                    this.showStatusTip('请先添加分组定时任务');
                    return;
                }

                // 切换到分组定时模式
                this.setData({
                    'device.mode': mode,
                    'device.power': true, // 分组定时模式默认开启
                    lastCommandTime: currentTime,
                    lastCommandType: currentCommandType
                });

                this.updateDeviceSettings('mode', mode);
                this.updateDeviceSettings('power', true);

                this.showStatusTip(`已切换到${modeNames[mode]}模式，将发送${groupTimers.length}个定时任务`);

                // 发送所有分组定时命令
                this.sendAllGroupTimers(groupTimers)
                    .then((results) => {
                        console.log('📡 所有分组定时命令发送成功:', results);
                        this.handleCommandSuccess('分组定时设置成功');
                    })
                    .catch((error) => {
                        console.error('📡 分组定时命令发送失败:', error);
                        this.handleCommandError(error);
                    });
                return;
            }

            // 对于简单的开关模式，直接设置并发送命令
            this.setData({
                'device.mode': mode,
                'device.power': power,
                lastCommandTime: currentTime,
                lastCommandType: currentCommandType
            });

            this.updateDeviceSettings('mode', mode);
            this.updateDeviceSettings('power', power);

            // 立即显示状态提示，提供更好的用户体验
            this.showStatusTip('已切换到' + modeNames[mode] + '模式');

            // 发送蓝牙广播命令（异步，不阻塞UI）
            this.commandManager.sendBluetoothCommand(mode, power)
                .then((result) => {
                    console.log('📡 模式切换命令发送成功:', result);
                    this.handleCommandSuccess();
                })
                .catch((error) => {
                    console.error('📡 模式切换命令发送失败:', error);
                    // 只有在发送失败时才显示错误提示
                    this.handleCommandError(error);
                });
        };

        if (this.data.device.passwordEnabled) {
            // 设备开启了密码保护，需要验证密码
            checkControlPermission(this.data.deviceId, `切换到${modeNames[mode]}模式`)
                .then(() => {
                    // 验证成功，执行模式切换
                    executeMode();
                })
                .catch((error) => {
                    console.log('🔐 模式切换被取消:', error);
                });
        } else {
            // 设备未开启密码保护，直接执行模式切换
            executeMode();
        }
    },

    // 显示倒计时设置
    showCountdownSetting: function () {
        wx.navigateTo({
            url: `/pages/countdown/index?deviceId=${this.data.deviceId}&returnTo=timer-switch`
        });
    },

    // 设置倒计时
    setCountdown: function (countdownTime) {
        console.log('📝 设置倒计时数据:', countdownTime);
        this.setData({
            'device.timers.countdown': countdownTime
        });
        this.updateDeviceSettings('timers', this.data.device.timers);

        console.log('📝 倒计时设置完成，当前数据:', this.data.device.timers.countdown);

        if (countdownTime && countdownTime.totalSeconds > 0) {
            const { hours, minutes, seconds } = countdownTime;
            const timeDisplay = hours > 0 ?
                `${hours}小时${minutes}分${seconds}秒` :
                minutes > 0 ?
                    `${minutes}分${seconds}秒` :
                    `${seconds}秒`;
            this.showStatusTip(`倒计时${timeDisplay}已设置`);
        } else {
            this.showStatusTip('倒计时已关闭');
        }
    },

    // 添加分组定时
    addGroupTimer: function () {
        wx.navigateTo({
            url: `/pages/timer-list/index?deviceId=${this.data.deviceId}`
        });
    },

    // 设置循环定时
    setLoopTimer: function () {
        wx.navigateTo({
            url: '/pages/loop-timer/index'
        });
    },

    // 设置日落定时
    setSunsetTimer: function () {
        wx.navigateTo({
            url: '/pages/sunset-timer/index'
        });
    },

    // 设置密码 - 委托给密码管理器
    setPassword: function () {
        this.passwordManager.setPassword();
    },

    // 切换密码开关 - 委托给密码管理器
    togglePassword: function (e) {
        this.passwordManager.togglePassword(e);
    },

    // 时间同步 - 委托给命令管理器
    syncDeviceTime: function () {
        this.commandManager.syncDeviceTime()
            .then((result) => {
                console.log('📡 时间同步成功:', result);
                this.handleCommandSuccess('时间同步成功');
            })
            .catch((error) => {
                console.error('📡 时间同步失败:', error);
                this.handleCommandError(error);
            });
    },

    // 发送所有分组定时命令
    sendAllGroupTimers: function (groupTimers) {
        return new Promise((resolve, reject) => {
            // 为没有groupId的定时器分配ID
            const timersWithGroupId = groupTimers.map((timer, index) => {
                // 如果定时器没有groupId，则根据索引分配
                if (timer.groupId === undefined || timer.groupId === null) {
                    timer.groupId = index; // 使用索引作为groupId (0-9)
                }

                return timer;
            });

            // 按照groupId从小到大排序，确保发送顺序正确
            const sortedTimers = timersWithGroupId.sort((a, b) => {
                const groupIdA = a.groupId || 0;
                const groupIdB = b.groupId || 0;
                return groupIdA - groupIdB;
            });

            sortedTimers.forEach((timer, index) => {
                console.log(`📡 序号${index + 1}, groupId:${timer.groupId}:`, {
                    timerId: timer.id,
                    groupId: timer.groupId,
                    startTime: timer.startTime,
                    endTime: timer.endTime,
                    repeatDays: timer.repeatDays
                });
            });

            const sendPromises = sortedTimers.map((timer, index) => {
                return new Promise((timerResolve, timerReject) => {
                    // 延迟发送，避免命令冲突
                    setTimeout(() => {
                        this.commandManager.sendBluetoothCommand('group', true, timer)
                            .then((result) => {
                                console.log(`📡 分组定时${index + 1}(groupId:${timer.groupId})命令发送成功:`, result);
                                // 单个定时器成功也要更新设备状态
                                this.updateDeviceOnlineStatus();
                                timerResolve(result);
                            })
                            .catch((error) => {
                                console.error(`📡 分组定时${index + 1}(groupId:${timer.groupId})命令发送失败:`, error);
                                // 单个定时器失败也要更新设备状态
                                if (!error || error.includes('离线') || error.includes('超时') || error.includes('设备可能离线')) {
                                    this.updateDeviceOfflineStatus();
                                }
                                timerReject(error);
                            });
                    }, index * 100); // 每个命令间隔100ms
                });
            });

            Promise.all(sendPromises)
                .then((results) => {
                    resolve(results);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    },



    // 更新设备设置到存储
    updateDeviceSettings: function (key, value) {
        const deviceList = wx.getStorageSync('deviceList') || [];
        const index = deviceList.findIndex(d => d.id === this.data.deviceId);

        if (index !== -1) {
            if (!deviceList[index].controller) {
                deviceList[index].controller = {};
            }

            deviceList[index].controller[key] = value;
            wx.setStorageSync('deviceList', deviceList);
        }
    },

    // 保存设备设置
    saveDeviceSettings: function () {
        const deviceList = wx.getStorageSync('deviceList') || [];
        const index = deviceList.findIndex(d => d.id === this.data.deviceId);

        if (index !== -1) {
            const { power, mode, passwordEnabled, timers } = this.data.device;

            deviceList[index].controller = {
                ...deviceList[index].controller,
                power, mode, passwordEnabled, timers
            };

            wx.setStorageSync('deviceList', deviceList);
        }
    },

    // 统一处理命令错误
    handleCommandError: function (error) {
        // 显示错误提示
        const errorMessage = error || '设备可能离线，请检查设备状态';
        this.showStatusTip(errorMessage);

        // 如果是设备离线相关的错误，更新设备状态为离线
        if (!error || error.includes('离线') || error.includes('超时') || error.includes('设备可能离线')) {
            this.updateDeviceOfflineStatus();
        }
    },

    // 统一处理命令成功
    handleCommandSuccess: function (message) {
        // 更新设备状态为在线
        this.updateDeviceOnlineStatus();
    },

    // 更新设备在线状态
    updateDeviceOnlineStatus: function () {
        // 更新设备最后通信时间
        this.setData({
            'device.lastSeen': Date.now(),
            deviceOfflineConfirmed: false
        });

        // 同步状态到存储
        this.syncDeviceStatusToStorage();
    },

    // 更新设备离线状态
    updateDeviceOfflineStatus: function () {
        // 更新设备最后通信时间
        this.setData({
            'device.lastSeen': Date.now(),
            deviceOfflineConfirmed: true
        });

        // 同步状态到存储
        this.syncDeviceStatusToStorage();

        console.log('📡 设备状态已更新为离线');
    }
}); 