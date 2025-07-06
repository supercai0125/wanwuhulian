// pages/device-scan/index.js
import { sendMatchBroadcastOnly } from '../../utils/BLEUtil'

Page({
    data: {
        deviceList: [],
        loading: true,
        broadcastInterval: null // 广播定时器
    },

    onLoad: function () {
        // 延迟启动，避免蓝牙适配器冲突
        setTimeout(() => {
            // Initialize bluetooth scan for device list
            this.startBluetoothDevicesDiscovery();
        }, 500);

        // 延迟启动广播，确保扫描适配器先初始化
        setTimeout(() => {
            // Start broadcasting to trigger device responses
            this.startBroadcastingForDiscovery();
        }, 1000);
    },

    onUnload: function () {
        // 页面卸载时停止广播和扫描
        this.stopBroadcastingForDiscovery();
        this.stopBluetoothDevicesDiscovery();
    },

    startBluetoothDevicesDiscovery: function () {
        const that = this;

        // Initialize Bluetooth module for device scanning (不使用peripheral模式)
        wx.openBluetoothAdapter({
            // 注意：扫描时不使用 mode: 'peripheral'
            success: function (res) {
                console.log('🔍🔍🔍 设备扫描蓝牙初始化成功', res);

                // 先注册设备发现监听器（必须在开始扫描之前）
                wx.onBluetoothDeviceFound(function (res) {
                    const devices = res.devices;
                    if (!devices || devices.length === 0) {
                        return;
                    }

                    devices.forEach((device, index) => {
                        // 检查：localName为"0000"的设备（匹配命令回复）
                        if (device.localName === '0000') {
                            console.log('🎯 发现0000设备:', device.deviceId);

                            // 打印设备回复数据并提取滚动码
                            const rollingCode = that.printDeviceReplyDataAndExtractRollingCode(device);

                            that.addDeviceToList(device, '0000设备匹配', rollingCode);
                            return;
                        }

                        // 检查是否有13字节回复数据
                        const hasValidReplyData = that.checkDeviceHasValidReplyData(device);
                        if (hasValidReplyData) {
                            console.log('🎯 发现有效回复数据的设备:', device.deviceId);

                            // 打印设备回复数据并提取滚动码
                            const rollingCode = that.printDeviceReplyDataAndExtractRollingCode(device);

                            that.addDeviceToList(device, '设备有有效13字节回复数据', rollingCode);
                        }
                    });
                });

                // 注册完监听器后，开始扫描
                wx.startBluetoothDevicesDiscovery({
                    allowDuplicatesKey: true, // 允许重复设备，便于实时更新
                    powerLevel: "high", // 高功率扫描
                    success: function (res) {
                        console.log('✅✅✅ 开始扫描蓝牙设备列表成功', res);
                    },
                    fail: function (err) {
                        console.error('❌❌❌ 扫描蓝牙设备失败', err);
                        wx.showToast({
                            title: '扫描蓝牙设备失败',
                            icon: 'none'
                        });
                        that.setData({
                            loading: false
                        });
                    }
                });
            },
            fail: function (err) {
                console.error('初始化蓝牙失败', err);
                wx.showToast({
                    title: '请开启手机蓝牙',
                    icon: 'none'
                });
                that.setData({
                    loading: false
                });
            }
        });
    },

    // 开始广播以触发设备回复
    startBroadcastingForDiscovery: function () {
        console.log('📡 开始定期广播以触发设备回复');

        // 立即发送一次匹配广播
        this.sendDiscoveryBroadcast();

        // 每5秒发送一次广播，避免过于频繁
        this.data.broadcastInterval = setInterval(() => {
            this.sendDiscoveryBroadcast();
        }, 5000);
    },

    // 停止广播
    stopBroadcastingForDiscovery: function () {
        if (this.data.broadcastInterval) {
            console.log('⏹️ 停止广播');
            clearInterval(this.data.broadcastInterval);
            this.setData({
                broadcastInterval: null
            });
        }
    },

    // 发送发现广播（匹配命令）
    sendDiscoveryBroadcast: function () {
        console.log('📡 发送发现广播（匹配命令）');

        // 使用专门的匹配命令进行设备发现
        sendMatchBroadcastOnly(
            () => {
                console.log('✅ 匹配广播发送成功');
            },
            (error) => {
                console.log('❌ 匹配广播发送失败:', error);
            }
        );
    },

    // 更严格的检查函数：验证13字节回复数据的有效性
    checkDeviceHasValidReplyData: function (device) {
        try {
            // 检查广播数据
            if (device.advertisData && device.advertisData.byteLength > 0) {
                const advertisData = new Uint8Array(device.advertisData);
                if (advertisData.length === 13) {
                    return this.validateReplyData(advertisData);
                }
            }

            // 检查制造商数据
            if (device.manufacturerData && device.manufacturerData.length > 0) {
                for (let mfgData of device.manufacturerData) {
                    if (mfgData.manufacturerSpecificData) {
                        const mfgBytes = new Uint8Array(mfgData.manufacturerSpecificData);
                        if (mfgBytes.length === 13) {
                            return this.validateReplyData(mfgBytes);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('检查设备有效回复数据时出错:', error);
        }
        return false;
    },

    // 验证回复数据是否有效
    validateReplyData: function (data) {
        if (data.length !== 13) {
            return false;
        }

        try {
            // 检查前3个字节是否是滚动码 112233
            const expectedRollingCode = [0x11, 0x22, 0x33];
            const actualRollingCode = [data[0], data[1], data[2]];

            const isValidRollingCode = expectedRollingCode.every((byte, index) =>
                byte === actualRollingCode[index]
            );

            if (isValidRollingCode) {
                return true;
            }

            return false;

        } catch (error) {
            console.error('验证回复数据时出错:', error);
            return false;
        }
    },

    // 添加设备到列表的通用函数
    addDeviceToList: function (device, reason = '设备发现', rollingCode = '') {
        // 检查设备是否已存在于当前扫描列表中
        const existingIndex = this.data.deviceList.findIndex(d => d.deviceId === device.deviceId);
        if (existingIndex !== -1) {
            return;
        }

        // 检查设备是否已经添加到主页面的已发现设备列表中（基于滚动码）
        if (rollingCode) {
            try {
                const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
                const alreadyAdded = discoveredDevices.some(d => d.rollingCode === rollingCode);
                if (alreadyAdded) {
                    console.log('🚫 设备已存在，跳过添加:', rollingCode);
                    return;
                }
            } catch (error) {
                console.error('检查已添加设备时出错:', error);
            }
        }

        // 创建设备信息 - 使用滚动码作为设备名
        let deviceName = '未知设备';
        let displayName = '未知设备';

        if (rollingCode) {
            // 使用滚动码作为设备名
            deviceName = rollingCode;
            displayName = rollingCode;
        } else if (device.localName === '0000') {
            // 0000设备但没有滚动码
            deviceName = 'F012设备';
            displayName = 'F012设备';
        } else if (device.localName) {
            // 有其他设备名的设备
            deviceName = device.localName;
            displayName = device.localName;
        } else if (device.name) {
            // 有name但没有localName的设备
            deviceName = device.name;
            displayName = device.name;
        } else {
            // 没有名称的设备，根据原因判断
            if (reason.includes('0000') || reason.includes('F012')) {
                deviceName = 'F012设备';
                displayName = 'F012设备';
            } else {
                deviceName = '智能设备';
                displayName = '智能设备';
            }
        }

        const deviceInfo = {
            deviceId: device.deviceId,
            name: deviceName,
            localName: device.localName,
            displayName: displayName,
            RSSI: device.RSSI || -999,
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
            const savedDevices = wx.getStorageSync('discoveredDevices') || [];

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

            wx.setStorageSync('discoveredDevices', savedDevices);
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
        const { sendTimeSyncCommand } = require('../../utils/BLEUtil');

        // 实际设备连接逻辑
        setTimeout(() => {
            // 连接成功后，发送时间同步命令
            wx.showLoading({
                title: '正在同步时间...',
            });

            // 准备时间同步数据
            const syncData = {
                rollingCode: device.rollingCode || '112233', // 使用设备的滚动码
                currentTime: new Date() // 当前系统时间
            };

            console.log('🕐 设备连接成功，开始时间同步:', device.deviceId);

            // 发送时间同步命令
            sendTimeSyncCommand(syncData,
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

    addTimerSwitch: function () {
        // Generate random ID for the manual device
        const deviceId = 'timer_' + new Date().getTime();

        // Add device to storage
        const deviceList = wx.getStorageSync('deviceList') || [];
        const newDevice = {
            id: deviceId,
            name: '时控开关',
            type: 'timer-switch',
            status: true
        };

        deviceList.push(newDevice);
        wx.setStorageSync('deviceList', deviceList);

        wx.showToast({
            title: '添加成功',
            icon: 'success',
            duration: 1500,
            success: function () {
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            }
        });
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