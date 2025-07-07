// 设备详情页面蓝牙管理器
// 基于统一蓝牙管理器，提供设备详情页面专用的蓝牙功能

import unifiedBluetoothManager from '../../../utils/ble/unified-manager.js'

class DeviceBluetoothManager {
    constructor(pageInstance) {
        this.pageInstance = pageInstance;
        this.deviceId = null;
        this.deviceRollingCode = null;
        this.isInitialized = false;

        // 离线检测
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 3;
        this.isDeviceOnline = true;
        this.lastSuccessTime = Date.now();

        // 绑定回调函数
        this.handleDeviceReply = this.handleDeviceReply.bind(this);
    }

    // 初始化蓝牙适配器（兼容旧接口）
    async initAdapter() {
        try {
            // 使用统一蓝牙管理器初始化
            await unifiedBluetoothManager.init();

            // 设置设备回复监听
            unifiedBluetoothManager.setReplyCallback(this.handleDeviceReply);

            this.isInitialized = true;
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // 初始化蓝牙适配器
    async init(deviceId, rollingCode) {
        this.deviceId = deviceId;
        this.deviceRollingCode = rollingCode;

        try {
            // 使用统一蓝牙管理器初始化
            await unifiedBluetoothManager.init();

            // 设置设备回复监听
            unifiedBluetoothManager.setReplyCallback(this.handleDeviceReply);

            this.isInitialized = true;
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // 发送命令
    async sendCommand(command, options = {}) {
        const { expectReply = true, timeout = 8000 } = options;

        return new Promise((resolve, reject) => {
            // 使用统一蓝牙管理器发送命令
            unifiedBluetoothManager.sendCommand(command, {
                expectReply,
                timeout,
                successCallback: (result) => {
                    this.consecutiveFailures = 0;
                    this.lastSuccessTime = Date.now();
                    this.updateDeviceOnlineStatus(true);
                    resolve(result);
                },
                errorCallback: (error) => {
                    this.consecutiveFailures++;
                    this.checkDeviceOffline();
                    reject(error);
                }
            });
        });
    }

    // 处理设备回复
    handleDeviceReply(replyData) {
        // 重置失败计数
        this.consecutiveFailures = 0;
        this.lastSuccessTime = Date.now();
        this.updateDeviceOnlineStatus(true);

        // 触发页面更新
        if (typeof this.onDeviceReply === 'function') {
            this.onDeviceReply(replyData);
        }

        // 如果页面实例有设备回复处理方法，也调用它
        if (this.pageInstance && typeof this.pageInstance.onDeviceReply === 'function') {
            this.pageInstance.onDeviceReply(replyData);
        }
    }

    // 设置设备回复回调
    setDeviceReplyCallback(callback) {
        this.onDeviceReply = callback;
    }

    // 检查设备是否离线
    checkDeviceOffline() {
        if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            this.updateDeviceOnlineStatus(false);
        }
    }

    // 更新设备在线状态
    updateDeviceOnlineStatus(isOnline) {
        if (this.isDeviceOnline !== isOnline) {
            this.isDeviceOnline = isOnline;

            // 更新设备存储状态
            this.updateDeviceStorageStatus(isOnline);

            // 触发状态变化回调
            if (typeof this.onDeviceStatusChange === 'function') {
                this.onDeviceStatusChange(isOnline);
            }
        }
    }

    // 更新设备存储状态
    updateDeviceStorageStatus(isOnline) {
        try {
            const storageKey = 'discovered_devices';
            const devices = wx.getStorageSync(storageKey) || [];

            const deviceIndex = devices.findIndex(d => d.rollingCode === this.deviceRollingCode);
            if (deviceIndex !== -1) {
                devices[deviceIndex].isOnline = isOnline;
                devices[deviceIndex].lastSeen = Date.now();
                wx.setStorageSync(storageKey, devices);
            }
        } catch (error) {
            // 静默处理存储错误
        }
    }

    // 设置设备状态变化回调
    setDeviceStatusChangeCallback(callback) {
        this.onDeviceStatusChange = callback;
    }

    // 重置离线检测状态
    resetOfflineDetection() {
        this.consecutiveFailures = 0;
        this.lastSuccessTime = Date.now();
        this.updateDeviceOnlineStatus(true);
    }

    // 启动回复监听（兼容旧接口）
    startReplyMonitoring() {
        // 统一管理器会自动处理监听，这里只需要确保已初始化
        if (!this.isInitialized) {
            this.initAdapter();
        }
    }

    // 停止回复监听（兼容旧接口）
    stopReplyMonitoring() {
        // 统一管理器会自动处理监听，这里不需要做任何操作
        // 因为其他页面可能还在使用监听功能
    }

    // 获取设备在线状态
    getDeviceOnlineStatus() {
        return this.isDeviceOnline;
    }

    // 清理资源
    cleanup() {
        // 清理回调
        this.onDeviceReply = null;
        this.onDeviceStatusChange = null;

        // 重置状态
        this.isInitialized = false;
        this.consecutiveFailures = 0;
        this.isDeviceOnline = true;
    }

    // 直接发送广播（不期待回复）
    sendBroadcastOnly(command) {
        return unifiedBluetoothManager.sendCommand(command, {
            expectReply: false,
            timeout: 1000
        });
    }
}

export default DeviceBluetoothManager; 