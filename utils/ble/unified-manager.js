// 统一的蓝牙广播和监听管理器
// 基于panMini的成熟实现，提供统一的广播发送和回复监听接口

import { generateDataWithAddr, getServiceUUIDs } from './common.js'
import { getConfig } from '../config.js'

class UnifiedBluetoothManager {
    constructor() {
        // 基础状态
        this.isInitialized = false;
        this.system = 'android';
        this.isIos = false;
        this.isIos13 = false;

        // 广播相关
        this.advertiseAdapter = null;
        this.advertiseServer = null;
        this.advertiseReady = false;
        this.isAdvertising = false;

        // 监听相关
        this.discoveryAdapter = null;
        this.discoveryReady = false;
        this.isListening = false;
        this.replyCallback = null;

        // 命令队列管理
        this.commandQueue = [];
        this.pendingCommands = new Map();
        this.commandTimeouts = new Map();
        this.replyTimeout = 12000; // 12秒超时，增加容错时间

        // 设备状态监控
        this.consecutiveFailures = 0;
        this.maxConsecutiveFailures = 5; // 增加到5次连续失败才判定离线
        this.deviceOfflineNotified = false;
        this.isInitialCheck = true;

        // 重试机制
        this.maxRetries = 2; // 最大重试次数
        this.retryDelay = 1000; // 重试延迟1秒

        // 设备过滤和滚动码管理
        this.currentFilterName = '0000'; // 初始监听0000设备
        this.knownRollingCodes = new Set(); // 已知的滚动码
        this.deviceRollingCode = null; // 当前设备的滚动码
    }

    // 初始化管理器
    async init() {
        if (this.isInitialized) {
            console.log('📡 统一蓝牙管理器已初始化，跳过重复初始化');
            return Promise.resolve();
        }

        console.log('📡 开始初始化统一蓝牙管理器');
        try {
            // 获取系统信息
            await this.initSystemInfo();

            // 初始化单一蓝牙适配器（同时支持广播和监听）
            await this.initBluetoothAdapter();

            // 立即启动监听，确保能接收设备回复
            this.startListening();

            this.isInitialized = true;
            console.log('📡 统一蓝牙管理器初始化完成，监听已启动');
            return Promise.resolve();
        } catch (error) {
            console.error('📡 统一蓝牙管理器初始化失败:', error);
            return Promise.reject(error);
        }
    }

    // 获取系统信息
    initSystemInfo() {
        return new Promise((resolve) => {
            try {
                const deviceInfo = wx.getDeviceInfo();
                this.system = deviceInfo.system;
                this.isIos = deviceInfo.platform === 'ios' || deviceInfo.system.indexOf('iOS') >= 0;
                this.isIos13 = this.isIos && deviceInfo.system.indexOf('13.') >= 0;
                resolve();
            } catch (error) {
                // 如果新API不可用，使用默认值
                this.system = 'unknown';
                this.isIos = false;
                this.isIos13 = false;
                resolve();
            }
        });
    }

    // 初始化蓝牙适配器（参考panMini的双适配器模式）
    initBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            // 先初始化广播适配器
            this.initAdvertiseAdapter()
                .then(() => {
                    console.log('📡 广播适配器初始化完成，开始初始化监听适配器');
                    // 再初始化监听适配器
                    return this.initDiscoveryAdapter();
                })
                .then(() => {
                    console.log('📡 蓝牙适配器初始化完成');
                    resolve();
                })
                .catch((error) => {
                    console.error('📡 蓝牙适配器初始化失败:', error);
                    reject(error);
                });
        });
    }

    // 初始化广播适配器（参考panMini的initAdvertiseAdapter）
    initAdvertiseAdapter() {
        return new Promise((resolve, reject) => {
            console.log('📡 正在初始化广播适配器...');
            wx.openBluetoothAdapter({
                mode: 'peripheral',
                success: async (res) => {
                    console.log('📡 广播适配器初始化成功');
                    this.advertiseAdapter = true;
                    try {
                        await this.createAdvertiseServer();
                        resolve();
                    } catch (error) {
                        console.error('📡 创建广播服务器失败:', error);
                        reject(error);
                    }
                },
                fail: (res) => {
                    console.error('📡 广播适配器初始化失败:', res);
                    reject(res);
                }
            });
        });
    }

    // 初始化监听适配器（参考panMini的initDiscoveryAdapter）
    initDiscoveryAdapter() {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                // 不指定mode，使用默认模式进行监听
                success: async (res) => {
                    this.discoveryAdapter = true;
                    try {
                        await this.initBluetoothDevicesDiscovery();
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                fail: (res) => {
                    reject(res);
                }
            });
        });
    }

    // 创建广播服务器（参考panMini的createBLEPeripheralServer）
    createAdvertiseServer() {
        return new Promise((resolve, reject) => {
            console.log('📡 正在创建广播服务器...');
            wx.createBLEPeripheralServer().then(res => {
                this.advertiseServer = res.server;
                this.advertiseReady = true;
                console.log('📡 广播服务器创建成功');
                resolve();
            }).catch(err => {
                this.advertiseReady = false;
                console.error('📡 广播服务器创建失败:', err);
                reject(err);
            });
        });
    }

    // 初始化蓝牙设备扫描（参考panMini的initBluetoothDevicesDiscovery）
    initBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: true,
                powerLevel: 'high',
                success: (res) => {
                    this.discoveryReady = true;
                    resolve();
                },
                fail: (res) => {
                    reject(res);
                }
            });
        });
    }

    // 发送广播命令（统一入口）
    async sendCommand(command, options = {}) {
        const {
            expectReply = true,
            timeout = this.replyTimeout,
            successCallback = null,
            errorCallback = null
        } = options;

        if (!this.isInitialized) {
            try {
                await this.init();
            } catch (error) {
                errorCallback && errorCallback('初始化失败');
                return Promise.reject(error);
            }
        }

        return new Promise((resolve, reject) => {
            const commandItem = {
                command: command,
                expectReply: expectReply,
                timeout: timeout,
                timestamp: Date.now(),
                id: Date.now() + Math.random(),
                retries: 0, // 初始重试次数为0
                successCallback: (result) => {
                    successCallback && successCallback(result);
                    resolve(result);
                },
                errorCallback: (error) => {
                    errorCallback && errorCallback(error);
                    reject(error);
                }
            };

            this.commandQueue.push(commandItem);
            this.processCommandQueue();
        });
    }

    // 处理命令队列
    processCommandQueue() {
        if (this.isAdvertising) {
            console.log('📡 正在广播中，跳过命令队列处理');
            return;
        }

        if (this.commandQueue.length === 0) {
            console.log('📡 命令队列为空，无需处理');
            return;
        }

        const commandItem = this.commandQueue.shift();
        console.log('📡 处理命令队列，剩余命令数:', this.commandQueue.length);

        // 如果期待回复，设置监听
        if (commandItem.expectReply) {
            this.setupReplyListening(commandItem);
        }

        this.sendBroadcast(commandItem);
    }

    // 设置回复监听
    setupReplyListening(commandItem) {
        // 启动监听（如果尚未启动）
        if (!this.isListening) {
            this.startListening();
        }

        // 存储待回复的命令
        this.pendingCommands.set(commandItem.id, commandItem);

        // 直接设置超时定时器
        const timeoutId = setTimeout(() => {
            this.handleCommandTimeout(commandItem.id);
        }, commandItem.timeout);

        this.commandTimeouts.set(commandItem.id, timeoutId);
    }

    // 开始监听设备回复（基于wanwuhulian的逻辑）
    startListening() {
        if (this.isListening) {
            console.log('📡 监听已启动，跳过重复启动');
            return;
        }

        console.log('📡 开始启动蓝牙设备监听');
        this.isListening = true;

        // 先移除之前的监听器，避免重复注册
        wx.offBluetoothDeviceFound();

        // 监听设备发现事件（参考panMini的过滤逻辑）
        wx.onBluetoothDeviceFound((res) => {
            if (!this.isListening) return;

            res.devices.forEach(device => {
                // 对于状态检测，我们需要接收所有设备的回复
                // 检查是否有localName且长度为4（滚动码格式）
                if (!device.localName || device.localName.length !== 4) {
                    return;
                }

                // 检查是否是十六进制格式的滚动码
                if (!/^[0-9A-Fa-f]{4}$/.test(device.localName)) {
                    return;
                }

                this.processDeviceReply(device);
            });
        });

        // 确保设备扫描正在运行（只在初始化时启动，这里不重复启动）
        if (!this.discoveryReady) {
            console.log('📡 蓝牙设备扫描未准备好，跳过重复启动');
        }
    }

    // 处理设备回复数据（参考panMini的逻辑）
    processDeviceReply(device) {
        // 工具函数：ArrayBuffer转十六进制字符串（与panMini保持一致）
        const ab2hex = (buffer) => {
            let hexArr = Array.prototype.map.call(
                new Uint8Array(buffer),
                function (bit) {
                    return ('00' + bit.toString(16)).slice(-2)
                }
            )
            return hexArr.join('').toUpperCase();
        };

        // 检查是否有广播数据
        if (!device.advertisData || device.advertisData.byteLength === 0) {
            return;
        }

        // 显示原始广播数据
        let originalHexData = ab2hex(device.advertisData);

        // 参考panMini：去掉前4个字符
        let processedHexData = originalHexData;
        if (originalHexData.length > 4) {
            processedHexData = originalHexData.substring(4);
        }

        // 只记录接收到的十六进制数据
        console.log('📥 收到回复:', processedHexData, '来自设备:', device.localName);

        const myDate = new Date();
        const time = myDate.toLocaleTimeString() + " " + myDate.getMilliseconds();

        // 处理设备回复，包含设备的localName（滚动码）
        this.handleDeviceReply({ time, data: processedHexData, rollingCode: device.localName });
    }

    // 处理设备回复
    handleDeviceReply(replyData) {
        // 重置失败计数
        this.consecutiveFailures = 0;
        this.deviceOfflineNotified = false;
        this.isInitialCheck = false;

        // 调用外部回调
        if (this.replyCallback) {
            this.replyCallback(replyData);
        }

        // 匹配待回复的命令
        if (this.pendingCommands.size > 0) {
            const now = Date.now();
            let matchedCommandId = null;
            let earliestTime = Infinity;

            // 找到最早的命令
            for (let [commandId, commandItem] of this.pendingCommands) {
                if (now - commandItem.timestamp < commandItem.timeout) {
                    if (commandItem.timestamp < earliestTime) {
                        earliestTime = commandItem.timestamp;
                        matchedCommandId = commandId;
                    }
                }
            }

            if (matchedCommandId) {
                this.handleCommandSuccess(matchedCommandId, replyData);
            }
        }
    }

    // 处理命令成功
    handleCommandSuccess(commandId, replyData) {
        const commandItem = this.pendingCommands.get(commandId);
        if (commandItem) {
            // 命令成功，重置失败计数
            this.consecutiveFailures = 0;
            this.deviceOfflineNotified = false;

            // 记录重试信息（如果有重试）
            if (commandItem.retries && commandItem.retries > 0) {
                console.log(`📡 命令重试成功，重试次数: ${commandItem.retries}`);
            }

            // 清除超时定时器
            if (this.commandTimeouts.has(commandId)) {
                clearTimeout(this.commandTimeouts.get(commandId));
                this.commandTimeouts.delete(commandId);
            }

            // 移除待回复命令
            this.pendingCommands.delete(commandId);

            // 调用成功回调
            if (commandItem.successCallback) {
                commandItem.successCallback(replyData);
            }

            // 只有在队列不为空时才处理下一个命令
            setTimeout(() => {
                if (this.commandQueue.length > 0) {
                    this.processCommandQueue();
                }
            }, 100);
        }
    }

    // 处理命令超时
    handleCommandTimeout(commandId) {
        const commandItem = this.pendingCommands.get(commandId);
        if (commandItem) {
            // 检查是否可以重试
            const currentRetries = commandItem.retries || 0;

            if (currentRetries < this.maxRetries) {
                // 重试命令
                console.log(`📡 命令超时，正在重试 (${currentRetries + 1}/${this.maxRetries}):`, commandItem.command);

                // 清除当前超时定时器
                this.commandTimeouts.delete(commandId);

                // 增加重试计数
                commandItem.retries = currentRetries + 1;
                commandItem.timestamp = Date.now(); // 更新时间戳

                // 延迟后重新发送
                setTimeout(() => {
                    this.sendBroadcast(commandItem);

                    // 重新设置超时定时器
                    const timeoutId = setTimeout(() => {
                        this.handleCommandTimeout(commandId);
                    }, commandItem.timeout);

                    this.commandTimeouts.set(commandId, timeoutId);
                }, this.retryDelay);

                return;
            }

            // 重试次数用完，移除命令和定时器
            this.pendingCommands.delete(commandId);
            this.commandTimeouts.delete(commandId);

            // 增加失败计数
            this.consecutiveFailures++;

            // 调用错误回调
            if (commandItem.errorCallback) {
                commandItem.errorCallback(`设备响应超时，已重试${this.maxRetries}次`);
            }

            // 检查是否需要提醒设备离线
            if (this.consecutiveFailures >= this.maxConsecutiveFailures && !this.deviceOfflineNotified) {
                this.notifyDeviceOffline();
            }

            // 只有在队列不为空时才处理下一个命令
            setTimeout(() => {
                if (this.commandQueue.length > 0) {
                    this.processCommandQueue();
                }
            }, 100);
        }
    }

    // 发送广播（参考panMini的startAdvertising）
    sendBroadcast(commandItem) {
        if (!this.advertiseReady || !this.advertiseServer) {
            const errorMsg = `广播服务器未准备好 - advertiseReady: ${this.advertiseReady}, advertiseServer: ${!!this.advertiseServer}`;
            console.error('📤 发送命令失败:', errorMsg);
            commandItem.errorCallback && commandItem.errorCallback(errorMsg);
            return;
        }

        // 只记录发送的十六进制数据
        console.log('📤 发送命令:', commandItem.command);
        this.isAdvertising = true;

        // 生成广播数据
        const defaultAddress = getConfig.defaultAddress();
        const actPayload = generateDataWithAddr(defaultAddress, commandItem.command, this.isIos);

        if (!actPayload) {
            this.isAdvertising = false;
            commandItem.errorCallback && commandItem.errorCallback('生成广播数据失败');
            return;
        }

        // 准备广播配置
        const advertiseConfig = {
            advertiseRequest: {
                connectable: true,
                deviceName: this.isIos ? '11' : '',
                serviceUuids: this.isIos ? getServiceUUIDs(actPayload, this.isIos13) : [],
                manufacturerData: this.isIos ? [] : [{
                    manufacturerId: '0x00C7',
                    manufacturerSpecificData: actPayload,
                }]
            },
            powerLevel: 'high'
        };

        // 开始广播
        this.advertiseServer.startAdvertising(advertiseConfig).then(res => {
            // 根据是否期望回复来决定广播时间
            const broadcastDuration = commandItem.expectReply ? 500 : 200; // 不期望回复的命令用更短的广播时间

            // 如果不期望回复，广播开始后立即调用成功回调
            if (!commandItem.expectReply) {
                setTimeout(() => {
                    commandItem.successCallback && commandItem.successCallback('广播发送成功');
                }, 50); // 稍微延迟一点确保广播已经开始
            }

            setTimeout(() => {
                this.stopAdvertising();
            }, broadcastDuration);

        }).catch(err => {
            this.isAdvertising = false;
            commandItem.errorCallback && commandItem.errorCallback('广播失败: ' + (err.errMsg || err.message));
        });
    }

    // 停止广播
    stopAdvertising() {
        if (this.advertiseServer && this.isAdvertising) {
            this.advertiseServer.stopAdvertising({
                success: () => { },
                fail: (err) => { }
            });
        }
        this.isAdvertising = false;

        // 只有在队列不为空且有回复回调时才处理下一个命令
        // 如果没有回复回调，说明可能正在清理，不应该继续处理
        setTimeout(() => {
            if (this.commandQueue.length > 0 && this.replyCallback !== null) {
                this.processCommandQueue();
            }
        }, 100);
    }

    // 设置回复回调
    setReplyCallback(callback) {
        this.replyCallback = callback;
    }

    // 重置设备过滤条件（用于发送新的匹配命令时）
    resetDeviceFilter() {
        this.currentFilterName = '0000';
        this.deviceRollingCode = null;
        // 保留已知滚动码，不清空
    }

    // 通知设备离线
    notifyDeviceOffline() {
        this.deviceOfflineNotified = true;

        // 可以在这里添加用户提醒逻辑
        if (typeof wx !== 'undefined' && wx.showToast) {
            wx.showToast({
                title: '设备可能离线',
                icon: 'none',
                duration: 2000
            });
        }
    }

    // 停止监听
    stopListening() {
        if (!this.isListening) {
            return;
        }

        this.isListening = false;

        // 停止设备扫描
        wx.stopBluetoothDevicesDiscovery({
            success: () => { },
            fail: (err) => { }
        });

        // 取消监听
        wx.offBluetoothDeviceFound();
    }

    // 清理命令队列（但保持蓝牙适配器运行）
    clearCommandQueue() {
        console.log('📡 清理命令队列，当前队列长度:', this.commandQueue.length);

        // 清理命令队列
        this.commandQueue = [];

        // 清理待回复命令和定时器
        for (let timeoutId of this.commandTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.pendingCommands.clear();
        this.commandTimeouts.clear();

        // 停止当前广播（但不触发后续处理）
        if (this.isAdvertising) {
            console.log('📡 停止当前广播');
            if (this.advertiseServer) {
                this.advertiseServer.stopAdvertising({
                    success: () => { },
                    fail: (err) => { }
                });
            }
            this.isAdvertising = false;
        }

        // 清理回复回调
        this.replyCallback = null;
        console.log('📡 命令队列清理完成');
    }

    // 清理资源
    cleanup() {
        // 停止监听
        this.stopListening();

        // 清理命令队列
        this.commandQueue = [];

        // 清理待回复命令和定时器
        for (let timeoutId of this.commandTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        this.pendingCommands.clear();
        this.commandTimeouts.clear();

        // 关闭服务器
        if (this.advertiseServer) {
            try {
                this.advertiseServer.close();
            } catch (e) {
                // 忽略关闭错误
            }
            this.advertiseServer = null;
        }

        // 重置状态
        this.isInitialized = false;
        this.advertiseReady = false;
        this.discoveryReady = false;
        this.isAdvertising = false;
        this.isListening = false;
    }
}

// 创建全局单例
const unifiedBluetoothManager = new UnifiedBluetoothManager();

export default unifiedBluetoothManager; 