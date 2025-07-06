// 蓝牙管理模块
import { BLUETOOTH_CONFIG } from '../../../utils/config'
import { startListeningForDeviceReply, stopListeningForDeviceReply } from '../../../utils/BLEUtil'

class BluetoothManager {
    constructor(page) {
        this.page = page;
        this.server = null;
        this.advertiseReady = false;
        this.isAdvertising = false;
        this.commandQueue = [];

        // 新增：设备在线状态监控相关
        this.isListeningForReply = false;
        this.pendingCommands = new Map(); // 存储待回复的命令
        this.commandTimeouts = new Map(); // 存储命令超时定时器
        this.consecutiveFailures = 0; // 连续失败计数
        this.maxConsecutiveFailures = 3; // 最大连续失败次数
        this.replyTimeout = 8000; // 回复超时时间（毫秒）- 延长到8秒
        this.deviceOfflineNotified = false; // 避免重复提醒
        this.isInitialCheck = true; // 标记是否为初始检查
    }

    // 初始化蓝牙广播适配器
    initAdapter() {
        console.log('🔧 设备详情页面初始化蓝牙广播适配器');

        wx.openBluetoothAdapter({
            mode: 'peripheral',
            success: (res) => {
                console.log('✅ 设备详情页面蓝牙广播适配器初始化成功', res);
                this.createServer();
            },
            fail: (res) => {
                console.error('❌ 设备详情页面蓝牙广播适配器初始化失败', res);
            }
        });
    }

    // 创建蓝牙外围设备服务器
    createServer() {
        console.log('🔧 设备详情页面创建蓝牙服务器');

        // 如果已经有服务器，先清理
        if (this.server) {
            console.log('🔧 清理现有服务器');
            try {
                this.server.close();
            } catch (e) {
                console.log('🔧 清理现有服务器失败:', e);
            }
            this.advertiseReady = false;
            this.server = null;
        }

        wx.createBLEPeripheralServer().then(res => {
            console.log('✅ 设备详情页面蓝牙服务器创建成功', res);
            this.advertiseReady = true;
            this.server = res.server;
            this.page.setData({
                advertiseReady: true,
                server: res.server
            });
        }).catch(err => {
            console.error('❌ 设备详情页面蓝牙服务器创建失败', err);
            this.advertiseReady = false;
            this.server = null;
            this.page.setData({
                advertiseReady: false,
                server: null
            });

            // 延迟重试一次
            setTimeout(() => {
                console.log('🔄 重试创建蓝牙服务器');
                wx.createBLEPeripheralServer().then(res => {
                    console.log('✅ 重试创建蓝牙服务器成功', res);
                    this.advertiseReady = true;
                    this.server = res.server;
                    this.page.setData({
                        advertiseReady: true,
                        server: res.server
                    });
                }).catch(retryErr => {
                    console.error('❌ 重试创建蓝牙服务器失败', retryErr);
                });
            }, 2000);
        });
    }

    // 添加命令到队列 - 增强版本，支持回复监听
    addCommandToQueue(command, successCallback, errorCallback, expectReply = true) {
        console.log('📝 添加命令到队列:', command, '期待回复:', expectReply);

        const commandItem = {
            command: command,
            successCallback: successCallback,
            errorCallback: errorCallback,
            timestamp: Date.now(),
            id: Date.now() + Math.random(),
            expectReply: expectReply
        };

        this.commandQueue.push(commandItem);
        this.processCommandQueue();
    }

    // 处理命令队列 - 增强版本
    processCommandQueue() {
        if (this.isAdvertising || this.commandQueue.length === 0) {
            return;
        }

        const commandItem = this.commandQueue.shift();
        console.log('🔄 处理队列中的命令:', commandItem.command);

        // 如果期待回复，设置监听
        if (commandItem.expectReply) {
            this.setupReplyListening(commandItem);
        }

        this.sendDirectBroadcast(commandItem.command, commandItem.successCallback, commandItem.errorCallback);
    }

    // 设置回复监听
    setupReplyListening(commandItem) {
        console.log('🎯 设置命令回复监听:', commandItem.id);

        // 启动监听（如果尚未启动）
        if (!this.isListeningForReply) {
            this.startReplyMonitoring();
        }

        // 存储待回复的命令
        this.pendingCommands.set(commandItem.id, {
            command: commandItem.command,
            timestamp: commandItem.timestamp,
            successCallback: commandItem.successCallback,
            errorCallback: commandItem.errorCallback
        });

        // 延迟设置超时定时器，给监听启动一些时间
        setTimeout(() => {
            // 再次检查命令是否还在待回复列表中（可能已经收到回复了）
            if (this.pendingCommands.has(commandItem.id)) {
                const timeoutId = setTimeout(() => {
                    this.handleCommandTimeout(commandItem.id);
                }, this.replyTimeout);

                this.commandTimeouts.set(commandItem.id, timeoutId);
                console.log('⏰ 已设置命令超时定时器:', commandItem.id);
            } else {
                console.log('⏰ 命令已处理，跳过设置超时定时器:', commandItem.id);
            }
        }, 100); // 延迟100毫秒设置超时定时器
    }

    // 启动回复监控
    startReplyMonitoring() {
        if (this.isListeningForReply) {
            return;
        }

        console.log('🔍 启动设备回复监控');
        this.isListeningForReply = true;

        startListeningForDeviceReply((replyData) => {
            this.handleDeviceReply(replyData);
        }).then(() => {
            console.log('✅ 设备回复监控启动成功');
        }).catch(err => {
            console.error('❌ 设备回复监控启动失败:', err);
            this.isListeningForReply = false;
        });
    }

    // 处理设备回复
    handleDeviceReply(replyData) {
        console.log('📨 收到设备回复:', replyData.time, replyData.data);

        // 设备有回复，重置连续失败计数和初始检查标记
        this.consecutiveFailures = 0;
        this.deviceOfflineNotified = false;
        this.isInitialCheck = false;

        // 检查是否有匹配的待回复命令
        const now = Date.now();
        let matchedCommandId = null;

        // 如果有待回复的命令，按时间顺序匹配最早的命令
        if (this.pendingCommands.size > 0) {
            let earliestCommand = null;
            let earliestTime = Infinity;

            for (let [commandId, commandInfo] of this.pendingCommands) {
                // 在超时时间内的命令都可能匹配
                if (now - commandInfo.timestamp < this.replyTimeout) {
                    if (commandInfo.timestamp < earliestTime) {
                        earliestTime = commandInfo.timestamp;
                        earliestCommand = commandId;
                    }
                }
            }

            matchedCommandId = earliestCommand;
        }

        if (matchedCommandId) {
            this.handleCommandSuccess(matchedCommandId, replyData);
        } else {
            console.log('📨 收到回复但没有匹配的待回复命令，可能是其他设备的回复');
            // 即使没有匹配的命令，收到任何回复也说明设备在线
            // 这可以避免因为回复匹配失败而误判设备离线
        }

        // 更新设备在线状态显示
        this.updateDeviceOnlineStatus(true);
    }

    // 处理命令成功
    handleCommandSuccess(commandId, replyData) {
        console.log('✅ 命令执行成功:', commandId);

        const commandInfo = this.pendingCommands.get(commandId);
        if (commandInfo) {
            // 清除超时定时器
            const timeoutId = this.commandTimeouts.get(commandId);
            if (timeoutId) {
                clearTimeout(timeoutId);
                this.commandTimeouts.delete(commandId);
            }

            // 移除待回复命令
            this.pendingCommands.delete(commandId);

            // 调用成功回调
            if (commandInfo.successCallback) {
                commandInfo.successCallback(replyData);
            }
        }
    }

    // 处理命令超时
    handleCommandTimeout(commandId) {
        console.log('⏰ 命令超时:', commandId);

        const commandInfo = this.pendingCommands.get(commandId);
        if (commandInfo) {
            // 移除待回复命令和超时定时器
            this.pendingCommands.delete(commandId);
            this.commandTimeouts.delete(commandId);

            // 增加连续失败计数
            this.consecutiveFailures++;
            console.log('📊 连续失败次数:', this.consecutiveFailures, '初始检查阶段:', this.isInitialCheck);

            // 如果是初始检查阶段，更宽松的判断标准
            const failureThreshold = this.isInitialCheck ? this.maxConsecutiveFailures + 2 : this.maxConsecutiveFailures;

            // 只有在连续失败次数达到阈值时才更新为离线状态
            // 避免单次超时就误判为离线
            if (this.consecutiveFailures >= failureThreshold) {
                if (!this.deviceOfflineNotified) {
                    this.notifyDeviceOffline();
                }
                // 只有在确认离线时才更新状态显示
                this.updateDeviceOnlineStatus(false);
                this.isInitialCheck = false; // 结束初始检查阶段
            } else {
                // 未达到离线阈值时，不改变在线状态显示，只记录失败
                console.log('📊 命令超时但未达到离线阈值，保持当前状态');
            }

            // 调用错误回调
            if (commandInfo.errorCallback) {
                const errorMsg = this.consecutiveFailures >= failureThreshold
                    ? '设备无回复，可能已离线'
                    : '命令执行超时，请重试';
                commandInfo.errorCallback(errorMsg);
            }
        }
    }

    // 提醒设备离线
    notifyDeviceOffline() {
        console.log('🚨 设备可能已离线');
        this.deviceOfflineNotified = true;

        // 显示设备离线提示
        wx.showModal({
            title: '设备离线提醒',
            content: `设备可能已离线，多个命令无回复。请检查设备状态或重新扫描设备。`,
            showCancel: true,
            cancelText: '稍后处理',
            confirmText: '重新扫描',
            success: (res) => {
                if (res.confirm) {
                    // 跳转到设备扫描页面
                    wx.navigateTo({
                        url: '/pages/device-scan/index'
                    });
                }
            }
        });

        // 更新页面状态
        this.page.setData({
            deviceOfflineConfirmed: true
        });
    }

    // 更新设备在线状态显示
    updateDeviceOnlineStatus(isOnline) {
        console.log('📊 更新设备在线状态:', isOnline);

        const now = Date.now();

        // 更新页面的设备状态显示
        this.page.setData({
            'device.isOnline': isOnline,
            'device.lastSeen': now
        });

        // 同时更新存储中的设备状态
        this.updateStoredDeviceStatus(now, isOnline);

        // 如果设备重新上线，清除离线状态
        if (isOnline && this.deviceOfflineNotified) {
            this.deviceOfflineNotified = false;
            this.page.setData({
                deviceOfflineConfirmed: false
            });

            // 显示设备重新上线提示
            this.page.showStatusTip('设备已重新上线', 2000);
        }
    }

    // 更新存储中的设备状态
    updateStoredDeviceStatus(lastSeen, isOnline = true) {
        try {
            const deviceId = this.page.data.deviceId;
            if (!deviceId) return;

            // 更新已发现设备列表中的状态
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.map(device => {
                if (device.rollingCode === deviceId) {
                    return {
                        ...device,
                        isOnline: isOnline,
                        lastSeen: lastSeen
                    };
                }
                return device;
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);
            console.log('📊 已更新存储中的设备状态:', deviceId, '在线状态:', isOnline);
        } catch (error) {
            console.error('更新存储中的设备状态失败:', error);
        }
    }

    // 停止回复监控
    stopReplyMonitoring() {
        if (!this.isListeningForReply) {
            return;
        }

        console.log('🛑 停止设备回复监控');
        this.isListeningForReply = false;

        // 停止监听
        stopListeningForDeviceReply();

        // 清理所有待回复命令和超时定时器
        for (let timeoutId of this.commandTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.commandTimeouts.clear();
        this.pendingCommands.clear();
    }

    // 重置离线检测状态
    resetOfflineDetection() {
        console.log('🔄 重置离线检测状态');
        this.consecutiveFailures = 0;
        this.deviceOfflineNotified = false;
        this.isInitialCheck = true; // 重新进入初始检查阶段
        this.page.setData({
            deviceOfflineConfirmed: false
        });
    }

    // 直接发送广播
    sendDirectBroadcast(command, successCallback, errorCallback) {
        console.log('🚀 设备详情页面直接发送广播:', command);

        if (this.isAdvertising) {
            console.log('⚠️ 正在广播中，添加到队列');
            this.addCommandToQueue(command, successCallback, errorCallback);
            return;
        }

        if (!this.advertiseReady || !this.server) {
            console.warn('⚠️ 蓝牙服务器未准备好，尝试重新初始化');
            this.initAdapter();

            setTimeout(() => {
                if (this.advertiseReady && this.server) {
                    this.sendDirectBroadcast(command, successCallback, errorCallback);
                } else {
                    console.error('❌ 蓝牙服务器重新初始化失败');
                    errorCallback && errorCallback('蓝牙服务器初始化失败');
                }
            }, 1000);
            return;
        }

        this.isAdvertising = true;
        this.page.setData({ isAdvertising: true });

        wx.getSystemInfo({
            success: (systemInfo) => {
                const system = systemInfo.system;
                const isIos = system.indexOf('iOS') >= 0;
                const isIos13 = isIos && system.indexOf('13.') >= 0;

                console.log('📱 系统信息:', system, 'iOS:', isIos, 'iOS13:', isIos13);

                const { generateDataWithAddr, getServiceUUIDs } = require('../../../utils/BLEUtil');

                const defaultAddress = 'cccccccccc';
                const actPayload = generateDataWithAddr(defaultAddress, command, isIos);

                if (!actPayload) {
                    console.error('❌ 生成广播数据失败');
                    errorCallback && errorCallback('生成广播数据失败');
                    return;
                }

                console.log('📡 生成的广播数据:', actPayload);

                let advertiseConfig;
                if (isIos) {
                    const uuids = getServiceUUIDs(actPayload, isIos13);
                    console.log('🍎 iOS 服务UUIDs:', uuids);

                    advertiseConfig = {
                        advertiseRequest: {
                            connectable: true,
                            deviceName: '11',
                            serviceUuids: uuids,
                            manufacturerData: []
                        },
                        powerLevel: 'high'
                    };
                } else {
                    advertiseConfig = {
                        advertiseRequest: {
                            connectable: true,
                            deviceName: '',
                            serviceUuids: [],
                            manufacturerData: [{
                                manufacturerId: '0x00C7',
                                manufacturerSpecificData: actPayload,
                            }]
                        },
                        powerLevel: 'high'
                    };
                }

                this.server.startAdvertising(advertiseConfig).then(res => {
                    console.log('✅ 设备详情页面广播开始成功:', res);

                    setTimeout(() => {
                        if (this.server) {
                            this.server.stopAdvertising({
                                success: () => {
                                    console.log('🔴 设备详情页面广播停止成功');
                                    this.onAdvertisingComplete(successCallback);
                                },
                                fail: (stopErr) => {
                                    console.error('❌ 设备详情页面广播停止失败:', stopErr);
                                    if (stopErr.errMsg && stopErr.errMsg.includes('no such server')) {
                                        console.log('🔄 服务器已丢失，重新初始化');
                                        this.advertiseReady = false;
                                        this.server = null;
                                        this.page.setData({ advertiseReady: false, server: null });
                                        this.initAdapter();
                                    }
                                    this.onAdvertisingComplete(successCallback);
                                }
                            });
                        } else {
                            console.warn('⚠️ 服务器已不存在，无法停止广播');
                            this.onAdvertisingComplete(successCallback);
                        }
                    }, 500);
                }, res => {
                    console.error('❌ 设备详情页面广播开始失败:', res);

                    if (res.errMsg && res.errMsg.includes('no such server')) {
                        console.log('🔄 服务器丢失导致广播失败，重新初始化');
                        this.advertiseReady = false;
                        this.server = null;
                        this.page.setData({ advertiseReady: false, server: null });
                        this.initAdapter();
                    }

                    this.onAdvertisingComplete(null, errorCallback, '广播失败: ' + (res.errMsg || res.message || '未知错误'));
                });
            },
            fail: (error) => {
                console.error('❌ 获取系统信息失败:', error);
                errorCallback && errorCallback('获取系统信息失败');
            }
        });
    }

    // 广播完成处理
    onAdvertisingComplete(successCallback, errorCallback, errorMessage) {
        console.log('🏁 广播完成，清除状态');

        this.isAdvertising = false;
        this.page.setData({ isAdvertising: false });

        if (errorMessage) {
            errorCallback && errorCallback(errorMessage);
        } else {
            successCallback && successCallback();
        }

        setTimeout(() => {
            this.processCommandQueue();
        }, 100);
    }

    // 清理资源 - 增强版本
    cleanup() {
        console.log('🧹 清理蓝牙管理器');

        // 停止回复监控
        this.stopReplyMonitoring();

        this.commandQueue = [];
        this.isAdvertising = false;

        if (this.server) {
            try {
                this.server.stopAdvertising({
                    success: () => console.log('🧹 广播已停止'),
                    fail: (err) => console.log('🧹 停止广播失败:', err),
                    complete: () => {
                        this.server.close();
                        console.log('🧹 蓝牙服务器已关闭');
                    }
                });
            } catch (e) {
                console.log('🧹 清理蓝牙服务器时出错:', e);
                try {
                    this.server.close();
                } catch (e2) {
                    console.log('🧹 强制关闭服务器失败:', e2);
                }
            }
        }
    }
}

export default BluetoothManager; 