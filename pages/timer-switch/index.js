// 重构后的时控开关主文件
import { checkControlPermission } from '../../utils/passwordUtil'
import { BLUETOOTH_CONFIG, UI_CONFIG } from '../../utils/config'
import BluetoothManager from './modules/bluetooth-manager.js'
import PasswordManager from './modules/password-manager.js'
import CommandManager from './modules/command-manager.js'

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
            isOnline: true, // 设备在线状态
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

        // 加载设备数据并初始化蓝牙
        this.loadDeviceData();
        this.bluetoothManager.initAdapter();
    },

    onShow: function () {
        this.loadDeviceData();

        // 页面显示时重置离线检测状态，因为用户可能刚从设备扫描页面返回
        if (this.bluetoothManager) {
            this.bluetoothManager.resetOfflineDetection();
            // 启动回复监听，但不立即发送检测命令
            this.bluetoothManager.startReplyMonitoring();
        }
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

        // 同步设备状态到存储，确保列表页面状态一致
        this.syncDeviceStatusToStorage();
    },

    onUnload: function () {
        // 清理资源
        if (this.bluetoothManager) {
            this.bluetoothManager.cleanup();
        }

        // 停止设备回复监听
        try {
            const { stopListeningForDeviceReply } = require('../../utils/ble/core');
            stopListeningForDeviceReply();
            console.log('🧹 设备回复监听已停止');
        } catch (e) {
            console.log('🧹 停止设备回复监听时出错:', e);
        }

        // 保存设备设置
        this.saveDeviceSettings();
    },

    // 加载设备数据
    loadDeviceData: function () {
        // 保存当前内存中的数据（如果存在）
        const currentCountdown = this.data.device?.timers?.countdown;
        const currentMode = this.data.device?.mode;
        const currentPower = this.data.device?.power;
        console.log('🔄 loadDeviceData - 保存当前数据:', {
            countdown: currentCountdown,
            mode: currentMode,
            power: currentPower
        });

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
                isOnline: discoveredDevice.isOnline !== undefined ? discoveredDevice.isOnline : true,
                lastSeen: discoveredDevice.lastSeen
            };
            console.log('📱 从已发现设备加载数据:', deviceData.id, '在线状态:', deviceData.isOnline);
        } else if (device) {
            deviceData = {
                ...device,
                isOnline: device.isOnline !== undefined ? device.isOnline : true
            };
            console.log('📱 从设备列表加载数据:', deviceData.id, '在线状态:', deviceData.isOnline);
        } else {
            console.warn('⚠️ 未找到设备数据:', this.data.deviceId);
            return;
        }

        // 初始化控制器数据
        let controllerData = {};
        if (device && device.controller) {
            controllerData = device.controller;

            // 修复旧版本的数据格式兼容性问题
            if (controllerData.timers && typeof controllerData.timers.countdown === 'number') {
                console.log('🔧 修复旧版本倒计时数据格式:', controllerData.timers.countdown);
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
            console.log('🔄 使用内存中的倒计时数据，避免被存储数据覆盖');
            controllerData.timers.countdown = currentCountdown;
        }

        // 如果当前内存中有模式和电源状态，优先使用内存中的数据（避免页面切换时重置）
        if (currentMode) {
            console.log('🔄 使用内存中的模式数据，避免被存储数据覆盖:', currentMode);
            controllerData.mode = currentMode;
        }

        if (typeof currentPower === 'boolean') {
            console.log('🔄 使用内存中的电源状态，避免被存储数据覆盖:', currentPower);
            controllerData.power = currentPower;
        }

        this.setData({
            device: {
                ...deviceData,
                ...controllerData
            }
        });

        console.log('📱 设备数据加载完成:', {
            deviceId: this.data.deviceId,
            mode: this.data.device?.mode,
            power: this.data.device?.power,
            countdown: this.data.device?.timers?.countdown,
            countdownType: typeof this.data.device?.timers?.countdown,
            wasCountdownPreserved: currentCountdown && typeof currentCountdown === 'object' && currentCountdown.totalSeconds > 0,
            wasModePreserved: !!currentMode,
            wasPowerPreserved: typeof currentPower === 'boolean'
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
                console.log('📊 同步状态跳过：缺少设备信息');
                return;
            }

            // 更新已发现设备列表中的状态
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.map(device => {
                if (device.rollingCode === deviceId) {
                    return {
                        ...device,
                        isOnline: currentDevice.isOnline !== undefined ? currentDevice.isOnline : device.isOnline,
                        lastSeen: currentDevice.lastSeen || device.lastSeen || Date.now()
                    };
                }
                return device;
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);
            console.log('📊 设备状态已同步到存储:', deviceId, '在线状态:', currentDevice.isOnline);

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
            console.log('⚠️ 相同操作过于频繁，请稍后再试');
            wx.showToast({
                title: '请勿重复点击',
                icon: 'none',
                duration: UI_CONFIG.TOAST_SHORT
            });
            return;
        }

        // 检查是否正在发送命令
        if (this.data.bluetoothSending) {
            console.log('⚠️ 正在发送命令，请等待完成');
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

        // 密码验证
        checkControlPermission(this.data.deviceId, `切换到${modeNames[mode]}模式`)
            .then(() => {
                // 验证成功，执行模式切换
                this.setData({
                    'device.mode': mode,
                    'device.power': power,
                    lastCommandTime: currentTime,
                    lastCommandType: currentCommandType
                });

                this.updateDeviceSettings('mode', mode);
                this.updateDeviceSettings('power', power);

                // 发送蓝牙广播命令
                this.commandManager.sendBluetoothCommand(mode, power);

                // 显示状态提示
                this.showStatusTip('已切换到' + modeNames[mode] + '模式');
            })
            .catch((error) => {
                console.log('模式切换被取消:', error);
            });
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
        this.commandManager.syncDeviceTime();
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
    }
}); 