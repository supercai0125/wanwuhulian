// pages/device-scan/index.js
import unifiedBluetoothManager from '../../utils/ble/unified-manager.js'
import { sendTimeSyncCommand } from '../../utils/ble/timeSync.js'

Page({
    data: {
        deviceList: [],
        loading: true,
        broadcastInterval: null, // 广播定时器
        isPageActive: false // 页面是否处于活动状态
    },

    onLoad: function () {
        console.log('🔍 设备发现页面加载');
        this.setData({ isPageActive: true });

        // 使用统一蓝牙管理器初始化
        this.initBluetoothManager();

        // 延迟启动广播，确保初始化完成
        setTimeout(() => {
            if (this.data.isPageActive) {
                this.startBroadcastingForDiscovery();
            }
        }, 1000);
    },

    onHide: function () {
        console.log('🔍 设备发现页面隐藏，停止扫描和广播');
        this.setData({ isPageActive: false });

        // 页面隐藏时停止所有活动
        this.stopAllActivities();
    },

    onShow: function () {
        console.log('🔍 设备发现页面显示');

        // 只有在页面真正需要重新激活时才重启（比如从其他页面返回）
        if (!this.data.isPageActive) {
            this.setData({ isPageActive: true });

            // 重新初始化蓝牙管理器
            this.initBluetoothManager();

            // 延迟启动广播
            setTimeout(() => {
                if (this.data.isPageActive) {
                    this.startBroadcastingForDiscovery();
                }
            }, 500);
        }
    },

    onUnload: function () {
        console.log('🔍 设备发现页面卸载，彻底清理所有资源');
        this.setData({ isPageActive: false });

        // 彻底清理所有资源
        this.stopAllActivities();

        // 清理统一蓝牙管理器的状态
        unifiedBluetoothManager.clearCommandQueue();
        unifiedBluetoothManager.setReplyCallback(null);

        console.log('🔍 已彻底清理设备发现页面的所有资源');
    },

    // 停止所有活动的统一方法
    stopAllActivities: function () {
        // 停止广播
        this.stopBroadcastingForDiscovery();

        // 停止蓝牙设备扫描
        this.stopBluetoothScanning();

        // 清理命令队列
        unifiedBluetoothManager.clearCommandQueue();
    },

    // 停止蓝牙设备扫描
    stopBluetoothScanning: function () {
        try {
            // 停止设备扫描
            wx.stopBluetoothDevicesDiscovery({
                success: () => {
                    console.log('✅ 设备扫描已停止');
                },
                fail: (err) => {
                    console.log('⚠️ 停止设备扫描失败:', err);
                }
            });
        } catch (error) {
            console.log('⚠️ 停止设备扫描异常:', error);
        }
    },

    // 初始化蓝牙管理器
    initBluetoothManager: function () {
        const that = this;

        // 初始化统一蓝牙管理器
        unifiedBluetoothManager.init()
            .then(() => {
                console.log('🔍 统一蓝牙管理器初始化成功');

                // 确保使用正确的过滤条件：监听 localName="0000" 的设备回复
                unifiedBluetoothManager.resetDeviceFilter();
                console.log('🔍 设备发现页面：设置过滤条件为 localName="0000"');

                // 设置设备回复监听
                unifiedBluetoothManager.setReplyCallback((replyData) => {
                    that.handleDeviceReply(replyData);
                });

                that.setData({ loading: false });
            })
            .catch((error) => {
                console.error('🔍 统一蓝牙管理器初始化失败:', error);
                wx.showToast({
                    title: '蓝牙初始化失败',
                    icon: 'none'
                });
                that.setData({ loading: false });
            });
    },

    // 处理设备回复
    handleDeviceReply: function (replyData) {
        console.log('📡 设备扫描页面收到回复:', replyData.data);

        // 从回复数据中提取设备信息
        const deviceInfo = this.parseDeviceReply(replyData.data);
        if (deviceInfo) {
            this.addDeviceToList(deviceInfo, '设备回复', deviceInfo.rollingCode);
        }
    },

    // 解析设备回复数据
    parseDeviceReply: function (hexData) {
        try {
            // 滚动码是两字节，即4个十六进制字符
            if (hexData.length >= 4) {
                const rollingCode = hexData.substring(0, 4);
                return {
                    deviceId: `device_${rollingCode}`,
                    rollingCode: rollingCode,
                    lastSeen: Date.now()
                };
            }
        } catch (error) {
            console.error('解析设备回复数据失败:', error);
        }
        return null;
    },

    // 开始广播以触发设备回复
    startBroadcastingForDiscovery: function () {
        // 先停止之前的广播，避免重复
        this.stopBroadcastingForDiscovery();

        // 检查页面是否还处于活动状态
        if (!this.data.isPageActive) {
            console.log('📡 页面已不活跃，跳过启动广播');
            return;
        }

        console.log('📡 开始启动设备发现广播');

        // 立即发送一次匹配广播
        this.sendDiscoveryBroadcast();

        // 每5秒发送一次广播，避免过于频繁
        const intervalId = setInterval(() => {
            // 在每次发送前检查页面状态
            if (!this.data.isPageActive) {
                console.log('📡 页面已不活跃，停止广播循环');
                clearInterval(intervalId);
                return;
            }
            this.sendDiscoveryBroadcast();
        }, 5000);

        this.setData({
            broadcastInterval: intervalId
        });
    },

    // 停止广播
    stopBroadcastingForDiscovery: function () {
        console.log('⏹️ 正在停止广播...');

        // 清理data中的定时器
        if (this.data.broadcastInterval) {
            console.log('⏹️ 清理广播定时器');
            clearInterval(this.data.broadcastInterval);
            this.setData({
                broadcastInterval: null
            });
        }

        // 额外清理：确保没有遗留的定时器（兼容旧代码）
        if (this.broadcastTimer) {
            clearInterval(this.broadcastTimer);
            this.broadcastTimer = null;
        }

        console.log('⏹️ 广播已完全停止');
    },

    // 发送发现广播（匹配命令）
    sendDiscoveryBroadcast: function () {
        // 检查页面是否还处于活动状态
        if (!this.data.isPageActive) {
            console.log('📡 页面已不活跃，跳过发送广播');
            return;
        }

        // 使用统一蓝牙管理器发送匹配命令
        const matchCommand = '00000001080000000000000000'; // 正确的匹配命令格式
        console.log('📡 设备扫描页面：发送匹配命令', matchCommand);

        unifiedBluetoothManager.sendCommand(matchCommand, {
            expectReply: true,
            timeout: 3000
        }).then(() => {
            console.log('📡 设备扫描页面：匹配命令发送成功');
        }).catch((error) => {
            console.log('📡 设备扫描页面：匹配命令发送失败:', error);
        });
    },

    // 添加设备到列表的通用函数
    addDeviceToList: function (device, reason = '设备发现', rollingCode = '') {
        // 检查设备是否已存在于当前扫描列表中
        const existingIndex = this.data.deviceList.findIndex(d =>
            d.deviceId === device.deviceId || d.rollingCode === rollingCode
        );
        if (existingIndex !== -1) {
            return;
        }

        // 检查设备是否已经添加到主页面的已发现设备列表中（基于滚动码）
        if (rollingCode) {
            try {
                const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
                const alreadyAdded = discoveredDevices.some(d => d.rollingCode === rollingCode);
                if (alreadyAdded) {
                    console.log('🚫 设备已存在，跳过添加:', rollingCode);
                    return;
                }
            } catch (error) {
                console.error('检查已添加设备时出错:', error);
            }
        }

        // 创建设备信息 - 使用滚动码前4位作为设备名
        let deviceName = '智能设备';
        let displayName = '智能设备';

        if (rollingCode) {
            // 滚动码本身就是4位（两字节），直接使用
            deviceName = rollingCode;
            displayName = `设备 ${rollingCode}`;
        }

        const deviceInfo = {
            deviceId: device.deviceId || `device_${rollingCode}`,
            name: deviceName,
            displayName: displayName,
            RSSI: device.RSSI || -60,
            rollingCode: rollingCode,
            isOnline: true, // 新发现的设备默认在线
            lastSeen: Date.now() // 最后发现时间
        };

        // 添加到设备列表
        const newDeviceList = [...this.data.deviceList, deviceInfo];

        this.setData({
            deviceList: newDeviceList,
            loading: false
        });

        // 保存设备到本地存储
        this.saveDeviceToStorage(deviceInfo);

        console.log('📱 添加设备:', deviceInfo.displayName, '滚动码:', rollingCode, '当前设备数量:', newDeviceList.length);
    },

    // 保存设备到本地存储
    saveDeviceToStorage: function (deviceInfo) {
        try {
            const savedDevices = wx.getStorageSync('discovered_devices') || [];

            // 检查设备是否已存在
            const existingIndex = savedDevices.findIndex(d => d.rollingCode === deviceInfo.rollingCode);

            if (existingIndex !== -1) {
                // 更新现有设备信息
                savedDevices[existingIndex] = {
                    ...savedDevices[existingIndex],
                    ...deviceInfo,
                    isOnline: true,
                    lastSeen: Date.now()
                };
            } else {
                // 添加新设备
                savedDevices.push({
                    rollingCode: deviceInfo.rollingCode,
                    displayName: deviceInfo.displayName,
                    deviceId: deviceInfo.deviceId,
                    isOnline: true,
                    lastSeen: Date.now(),
                    addedTime: Date.now()
                });
            }

            wx.setStorageSync('discovered_devices', savedDevices);
            console.log('📱 设备已保存到本地存储');
        } catch (error) {
            console.error('保存设备到本地存储失败:', error);
        }
    },

    // 打印设备回复数据并提取滚动码
    printDeviceReplyDataAndExtractRollingCode: function (device) {
        console.log('📡 开始打印设备回复数据:', device.localName);

        // 检查广播数据
        if (device.advertisData && device.advertisData.byteLength > 0) {
            const advertisData = new Uint8Array(device.advertisData);
            console.log('📡 广播数据长度:', advertisData.length);

            // 打印完整的广播数据以便调试
            const fullHexString = Array.from(advertisData).map(byte =>
                byte.toString(16).padStart(2, '0').toUpperCase()
            ).join('-');
            console.log('📡 完整广播数据:', fullHexString);

            // 查找F012开头的数据
            const f012Pattern = [0xF0, 0x12]; // F012的字节模式
            for (let i = 0; i <= advertisData.length - 13; i++) {
                if (advertisData[i] === f012Pattern[0] && advertisData[i + 1] === f012Pattern[1]) {
                    // 找到F012开头，提取13字节数据
                    const deviceReply = advertisData.slice(i, i + 13);
                    if (deviceReply.length === 13) {
                        const hexString = Array.from(deviceReply).map(byte =>
                            byte.toString(16).padStart(2, '0').toUpperCase()
                        ).join('-');
                        console.log(device.localName + '：' + hexString);

                        // 提取前两个字节作为滚动码
                        const rollingCode = hexString.split('-').slice(0, 2).join('');
                        console.log('📡 提取滚动码:', rollingCode);
                        return rollingCode;
                    }
                }
            }
        }

        // 检查制造商数据
        if (device.manufacturerData && device.manufacturerData.length > 0) {
            console.log('📡 制造商数据数量:', device.manufacturerData.length);
            device.manufacturerData.forEach((mfgData, index) => {
                if (mfgData.manufacturerSpecificData) {
                    const mfgBytes = new Uint8Array(mfgData.manufacturerSpecificData);
                    console.log('📡 制造商数据[' + index + ']长度:', mfgBytes.length);

                    // 打印完整的制造商数据以便调试
                    const fullHexString = Array.from(mfgBytes).map(byte =>
                        byte.toString(16).padStart(2, '0').toUpperCase()
                    ).join('-');
                    console.log('📡 完整制造商数据[' + index + ']:', fullHexString);

                    // 查找F012开头的数据
                    const f012Pattern = [0xF0, 0x12]; // F012的字节模式
                    for (let i = 0; i <= mfgBytes.length - 13; i++) {
                        if (mfgBytes[i] === f012Pattern[0] && mfgBytes[i + 1] === f012Pattern[1]) {
                            // 找到F012开头，提取13字节数据
                            const deviceReply = mfgBytes.slice(i, i + 13);
                            if (deviceReply.length === 13) {
                                const hexString = Array.from(deviceReply).map(byte =>
                                    byte.toString(16).padStart(2, '0').toUpperCase()
                                ).join('-');
                                console.log(device.localName + '：' + hexString);

                                // 提取前两个字节作为滚动码
                                const rollingCode = hexString.split('-').slice(0, 2).join('');
                                console.log('📡 提取滚动码:', rollingCode);
                                return rollingCode;
                            }
                        }
                    }
                } else {
                    console.log('📡 制造商数据[' + index + ']无数据');
                }
            });
        } else {
            console.log('📡 无制造商数据');
        }

        console.log('📡 打印设备回复数据完成');
        return '';
    },

    // 检查并打印13字节回复报文（保留原函数用于兼容）
    checkAndPrint13ByteReply: function (device) {
        try {
            // 检查广播数据
            if (device.advertisData && device.advertisData.byteLength > 0) {
                const advertisData = new Uint8Array(device.advertisData);

                // 只打印13字节的报文
                if (advertisData.length === 13) {
                    // 用-分割每个字节的十六进制格式
                    const hexString = Array.from(advertisData).map(byte =>
                        byte.toString(16).padStart(2, '0').toUpperCase()
                    ).join('-');

                    console.log('发现13字节回复:', hexString);
                }
            }

            // 检查制造商数据
            if (device.manufacturerData && device.manufacturerData.length > 0) {
                device.manufacturerData.forEach((mfgData, index) => {
                    if (mfgData.manufacturerSpecificData) {
                        const mfgBytes = new Uint8Array(mfgData.manufacturerSpecificData);

                        // 只打印13字节的制造商数据
                        if (mfgBytes.length === 13) {
                            // 用-分割每个字节的十六进制格式
                            const hexString = Array.from(mfgBytes).map(byte =>
                                byte.toString(16).padStart(2, '0').toUpperCase()
                            ).join('-');

                            console.log('发现13字节制造商回复:', hexString);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('检查12字节回复报文时出错:', error);
        }
    },

    stopBluetoothDevicesDiscovery: function () {
        wx.stopBluetoothDevicesDiscovery({
            success: function (res) {
                console.log('停止扫描蓝牙设备', res);
            }
        });
    },

    connectDevice: function (e) {
        const index = e.currentTarget.dataset.index;
        const device = this.data.deviceList[index];

        wx.showLoading({
            title: '正在连接...',
        });

        // 导入时间同步功能
        // 时间同步功能已在页面顶部导入

        // 实际设备连接逻辑
        setTimeout(() => {
            // 连接成功后，发送时间同步命令
            wx.showLoading({
                title: '正在同步时间...',
            });

            // 准备时间同步数据
            const rollingCode = device.rollingCode || '0000'; // 使用设备的滚动码
            const syncData = {
                currentTime: new Date() // 当前系统时间
            };

            console.log('🕐 设备连接成功，开始时间同步:', device.deviceId, '滚动码:', rollingCode);

            // 发送时间同步命令
            sendTimeSyncCommand(rollingCode, syncData,
                () => {
                    console.log('🕐 时间同步成功');
                    wx.hideLoading();

                    // Add device to storage
                    const deviceList = wx.getStorageSync('deviceList') || [];
                    const newDevice = {
                        id: device.deviceId,
                        name: device.name || '未知设备',
                        type: 'timer-switch', // All discovered devices are timer switches
                        status: true,
                        lastTimeSync: Date.now() // 记录最后同步时间
                    };

                    // Check if device already exists
                    const exists = deviceList.findIndex(d => d.id === newDevice.id);
                    if (exists === -1) {
                        deviceList.push(newDevice);
                        wx.setStorageSync('deviceList', deviceList);
                    } else {
                        // 更新现有设备的同步时间
                        deviceList[exists].lastTimeSync = Date.now();
                        wx.setStorageSync('deviceList', deviceList);
                    }

                    wx.showToast({
                        title: '连接成功',
                        icon: 'success',
                        duration: 1500,
                        success: function () {
                            setTimeout(() => {
                                wx.navigateBack();
                            }, 1500);
                        }
                    });
                },
                (error) => {
                    console.error('🕐 时间同步失败:', error);
                    wx.hideLoading();

                    // 即使时间同步失败，也继续添加设备
                    wx.showModal({
                        title: '时间同步失败',
                        content: '设备连接成功，但时间同步失败。是否仍要添加设备？',
                        confirmText: '仍要添加',
                        cancelText: '重试连接',
                        success: (res) => {
                            if (res.confirm) {
                                // 用户选择仍要添加设备
                                const deviceList = wx.getStorageSync('deviceList') || [];
                                const newDevice = {
                                    id: device.deviceId,
                                    name: device.name || '未知设备',
                                    type: 'timer-switch',
                                    status: true,
                                    timeSyncFailed: true // 标记时间同步失败
                                };

                                const exists = deviceList.findIndex(d => d.id === newDevice.id);
                                if (exists === -1) {
                                    deviceList.push(newDevice);
                                    wx.setStorageSync('deviceList', deviceList);
                                }

                                wx.showToast({
                                    title: '设备已添加',
                                    icon: 'success',
                                    duration: 1500,
                                    success: function () {
                                        setTimeout(() => {
                                            wx.navigateBack();
                                        }, 1500);
                                    }
                                });
                            } else {
                                // 用户选择重试连接
                                console.log('用户选择重试连接');
                            }
                        }
                    });
                }
            );
        }, 2000);
    },

    // 转发分享功能
    onShareAppMessage: function (res) {
        return {
            title: '明治物联 - 添加智能设备',
            desc: '快速添加和管理你的智能设备',
            path: '/pages/device-scan/index',
            imageUrl: '/images/share-bg.png'
        }
    },

    // 分享到朋友圈功能
    onShareTimeline: function (res) {
        return {
            title: '明治物联 - 智能设备管理',
            query: '',
            imageUrl: '/images/share-bg.png'
        }
    }
})