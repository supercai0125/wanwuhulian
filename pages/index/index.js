// index.js
import { sendMatchBroadcastOnly } from '../../utils/BLEUtil'

Page({
    data: {
        discoveredDevices: [], // 已发现的设备列表
        isCheckingOnlineStatus: false,
        appStartTime: null // 记录应用启动时间
    },

    onLoad: function () {
        // 记录应用启动时间
        this.setData({
            appStartTime: Date.now()
        });

        // 加载已发现的设备列表
        this.loadDiscoveredDevices();
    },

    onShow: function () {
        // 重新加载已发现的设备列表（确保获取最新状态）
        this.loadDiscoveredDevices();

        // 检查是否有新设备添加（最近30秒内添加的设备）
        const hasRecentDevices = this.checkForRecentDevices();

        // 检查是否是小程序重新启动（通过启动时间判断）
        const now = Date.now();
        const appStartTime = this.data.appStartTime || now;
        const isAppRestart = (now - appStartTime) < 5000; // 如果距离启动时间小于5秒，认为是重新启动

        if (hasRecentDevices && !isAppRestart) {
            // 有新设备添加且不是重新启动，将新设备标记为在线（新扫描到的肯定在线）
            console.log('📱 检测到新设备，跳过检测并标记为在线');
            this.markRecentDevicesOnline();
        } else if (isAppRestart) {
            // 小程序重新启动时才执行完整的在线状态检测
            console.log('📱 检测到小程序重新启动，执行完整的在线状态检测');
            this.checkDevicesOnlineStatus();
        } else {
            // 其他情况（如从其他页面返回）不自动检测，避免频繁检测导致设备被误判为离线
            console.log('📱 从其他页面返回，重新加载设备状态但不执行检测');

            // 延迟一小段时间重新加载，确保从详情页面同步的状态已经保存
            setTimeout(() => {
                this.loadDiscoveredDevices();
            }, 100);
        }
    },

    onHide: function () {
        // 页面隐藏时停止正在进行的检测
        this.stopStatusCheck();
    },

    onUnload: function () {
        // 页面卸载时停止正在进行的检测
        this.stopStatusCheck();
    },

    // 加载已发现的设备列表
    loadDiscoveredDevices: function () {
        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];

            console.log('📱 已发现设备列表:', discoveredDevices);

            // 格式化时间显示
            const formattedDevices = discoveredDevices.map(device => ({
                ...device,
                lastSeenText: this.formatLastSeenTime(device.lastSeen)
            }));

            this.setData({
                discoveredDevices: formattedDevices
            });
            console.log('📱 最终显示的设备:', formattedDevices.length, '个');
        } catch (error) {
            console.error('加载已发现设备失败:', error);
        }
    },

    // 格式化最后发现时间
    formatLastSeenTime: function (timestamp) {
        if (!timestamp) return '未知';

        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60 * 1000) {
            return '刚刚';
        } else if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `${minutes}分钟前`;
        } else if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `${hours}小时前`;
        } else {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `${days}天前`;
        }
    },

    goToScan: function () {
        wx.navigateTo({
            url: '/pages/device-scan/index'
        });
    },

    // 跳转到设备控制页面
    goToDiscoveredDeviceControl: function (e) {
        const { rollingcode } = e.currentTarget.dataset;

        if (rollingcode) {
            // 查找对应的设备信息
            const device = this.data.discoveredDevices.find(d => d.rollingCode === rollingcode);

            if (device && !device.isOnline) {
                // 设备离线时给出提示，但仍然允许进入
                wx.showModal({
                    title: '设备离线',
                    content: '设备当前处于离线状态，可能无法响应控制命令。是否仍要进入控制界面？',
                    confirmText: '仍要进入',
                    cancelText: '取消',
                    success: (res) => {
                        if (res.confirm) {
                            this.navigateToDeviceControl(rollingcode);
                        }
                    }
                });
            } else {
                // 设备在线或状态未知，直接进入
                this.navigateToDeviceControl(rollingcode);
            }
        } else {
            wx.showToast({
                title: '设备信息错误',
                icon: 'none'
            });
        }
    },

    // 导航到设备控制页面
    navigateToDeviceControl: function (rollingcode) {
        wx.navigateTo({
            url: `/pages/timer-switch/index?id=${rollingcode}&deviceName=设备${rollingcode}&isDiscovered=true`
        });
    },

    // 删除设备
    deleteDevice: function (e) {
        const index = e.currentTarget.dataset.index;
        const rollingCode = e.currentTarget.dataset.rollingcode;
        const device = this.data.discoveredDevices[index];

        if (!device) {
            wx.showToast({
                title: '设备信息错误',
                icon: 'none'
            });
            return;
        }

        wx.showModal({
            title: '删除设备',
            content: `确定要删除设备"${device.rollingCode}"吗？删除后需要重新扫描添加。`,
            confirmText: '删除',
            confirmColor: '#ff4444',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    this.performDeleteDevice(rollingCode, index);
                }
            }
        });
    },

    // 执行删除设备操作
    performDeleteDevice: function (rollingCode, index) {
        try {
            // 从本地存储中删除设备
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.filter(device => device.rollingCode !== rollingCode);

            wx.setStorageSync('discoveredDevices', updatedDevices);

            // 更新界面
            const currentList = [...this.data.discoveredDevices];
            currentList.splice(index, 1);

            this.setData({
                discoveredDevices: currentList
            });

            wx.showToast({
                title: '设备已删除',
                icon: 'success',
                duration: 1500
            });

            console.log('📱 设备已删除:', rollingCode);
        } catch (error) {
            console.error('删除设备失败:', error);
            wx.showToast({
                title: '删除失败',
                icon: 'none'
            });
        }
    },

    // 检测设备在线状态
    checkDevicesOnlineStatus: function () {
        // 如果正在检测中，跳过本次检测
        if (this.data.isCheckingOnlineStatus) {
            console.log('📡 检测已在进行中，跳过本次检测');
            wx.showToast({
                title: '正在检测中...',
                icon: 'none',
                duration: 1500
            });
            return;
        }

        const allDiscoveredDevices = wx.getStorageSync('discoveredDevices') || [];
        console.log('📡 检查在线状态 - 存储中的设备数量:', allDiscoveredDevices.length);

        if (allDiscoveredDevices.length === 0) {
            console.log('📡 没有已发现的设备，跳过在线状态检测');
            wx.showToast({
                title: '暂无设备',
                icon: 'none',
                duration: 1500
            });
            return;
        }

        console.log('📡 开始检测设备在线状态...');
        console.log('📡 待检测设备:', allDiscoveredDevices.map(d => d.rollingCode));

        this.setData({ isCheckingOnlineStatus: true });

        // 记录检测开始时的设备状态，用于检测超时后的处理
        this.detectedDevices = new Set();

        // 初始化蓝牙并开始扫描
        this.initBluetoothForStatusCheck();

        // 8秒后停止检测并更新未检测到的设备为离线状态（延长检测时间）
        setTimeout(() => {
            this.finishStatusCheckAndUpdateOfflineDevices();
        }, 8000);
    },



    // 初始化蓝牙进行状态检测
    initBluetoothForStatusCheck: function () {
        const that = this;

        wx.openBluetoothAdapter({
            success: function (res) {
                console.log('📡 蓝牙初始化成功，开始状态检测');

                // 注册设备发现监听器
                wx.onBluetoothDeviceFound(function (res) {
                    const devices = res.devices;
                    if (!devices || devices.length === 0) return;

                    devices.forEach((device) => {
                        if (device.localName === '0000') {
                            that.checkDeviceOnlineByReply(device);
                        }
                    });
                });

                // 开始扫描
                wx.startBluetoothDevicesDiscovery({
                    allowDuplicatesKey: true,
                    powerLevel: "high",
                    success: function (res) {
                        console.log('📡 开始扫描设备状态');
                        // 发送匹配广播
                        that.sendStatusCheckBroadcast();
                    },
                    fail: function (err) {
                        console.error('📡 扫描设备失败:', err);
                        that.stopStatusCheck();
                    }
                });
            },
            fail: function (err) {
                console.error('📡 蓝牙初始化失败:', err);
                that.stopStatusCheck();
            }
        });
    },

    // 发送状态检测广播
    sendStatusCheckBroadcast: function () {
        sendMatchBroadcastOnly(
            () => {
                console.log('📡 状态检测广播发送成功');
            },
            (error) => {
                console.log('📡 状态检测广播发送失败:', error);
            }
        );
    },

    // 根据设备回复检查在线状态
    checkDeviceOnlineByReply: function (device) {
        // 提取设备回复中的滚动码
        const rollingCode = this.extractRollingCodeFromDevice(device);
        if (!rollingCode) return;

        console.log('📡 检测到在线设备，滚动码:', rollingCode);

        // 记录已检测到的设备
        if (this.detectedDevices) {
            this.detectedDevices.add(rollingCode);
        }

        // 更新设备在线状态
        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.map(savedDevice => {
                if (savedDevice.rollingCode === rollingCode) {
                    return {
                        ...savedDevice,
                        isOnline: true,
                        lastSeen: Date.now()
                    };
                }
                return savedDevice;
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);

            // 重新加载并过滤设备列表以更新界面
            this.loadDiscoveredDevices();
            console.log('📡 设备', rollingCode, '已标记为在线');

            // 检查是否所有设备都已检测到，如果是则提前结束检测
            this.checkIfAllDevicesDetected();
        } catch (error) {
            console.error('更新设备在线状态失败:', error);
        }
    },

    // 检查是否所有设备都已检测到
    checkIfAllDevicesDetected: function () {
        if (!this.detectedDevices || !this.data.isCheckingOnlineStatus) {
            return;
        }

        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const totalDevices = discoveredDevices.length;
            const detectedCount = this.detectedDevices.size;

            console.log('📡 检测进度:', detectedCount, '/', totalDevices);

            // 如果所有设备都已检测到，提前结束检测
            if (detectedCount >= totalDevices && totalDevices > 0) {
                console.log('📡 所有设备都已检测到，提前结束检测');
                this.finishStatusCheckAndUpdateOfflineDevices();
            }
        } catch (error) {
            console.error('检查检测进度失败:', error);
        }
    },

    // 从设备回复中提取滚动码
    extractRollingCodeFromDevice: function (device) {
        // 检查广播数据
        if (device.advertisData && device.advertisData.byteLength > 0) {
            const advertisData = new Uint8Array(device.advertisData);

            // 查找F012开头的数据
            const f012Pattern = [0xF0, 0x12];
            for (let i = 0; i <= advertisData.length - 13; i++) {
                if (advertisData[i] === f012Pattern[0] && advertisData[i + 1] === f012Pattern[1]) {
                    const deviceReply = advertisData.slice(i, i + 13);
                    if (deviceReply.length === 13) {
                        const hexString = Array.from(deviceReply).map(byte =>
                            byte.toString(16).padStart(2, '0').toUpperCase()
                        ).join('-');

                        // 提取前两个字节作为滚动码
                        const rollingCode = hexString.split('-').slice(0, 2).join('');
                        return rollingCode;
                    }
                }
            }
        }

        // 检查制造商数据
        if (device.manufacturerData && device.manufacturerData.length > 0) {
            for (let mfgData of device.manufacturerData) {
                if (mfgData.manufacturerSpecificData) {
                    const mfgBytes = new Uint8Array(mfgData.manufacturerSpecificData);

                    // 查找F012开头的数据
                    const f012Pattern = [0xF0, 0x12];
                    for (let i = 0; i <= mfgBytes.length - 13; i++) {
                        if (mfgBytes[i] === f012Pattern[0] && mfgBytes[i + 1] === f012Pattern[1]) {
                            const deviceReply = mfgBytes.slice(i, i + 13);
                            if (deviceReply.length === 13) {
                                const hexString = Array.from(deviceReply).map(byte =>
                                    byte.toString(16).padStart(2, '0').toUpperCase()
                                ).join('-');

                                // 提取前两个字节作为滚动码
                                const rollingCode = hexString.split('-').slice(0, 2).join('');
                                return rollingCode;
                            }
                        }
                    }
                }
            }
        }

        return '';
    },

    // 完成状态检测并更新离线设备
    finishStatusCheckAndUpdateOfflineDevices: function () {
        console.log('📡 完成设备状态检测，更新离线设备');

        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const detectedDevices = this.detectedDevices || new Set();
            const now = Date.now();
            const offlineThreshold = 5 * 60 * 1000; // 5分钟无响应才认为离线

            console.log('📡 检测到的在线设备:', Array.from(detectedDevices));
            console.log('📡 所有设备:', discoveredDevices.map(d => d.rollingCode));

            // 更新设备状态：检测到的设备保持在线，未检测到的根据最后在线时间判断
            const updatedDevices = discoveredDevices.map(device => {
                if (detectedDevices.has(device.rollingCode)) {
                    // 已检测到的设备，保持在线状态（已在checkDeviceOnlineByReply中更新）
                    return device;
                } else {
                    // 未检测到的设备，根据最后在线时间判断是否离线
                    const lastSeen = device.lastSeen || device.addedTime || 0;
                    const timeSinceLastSeen = now - lastSeen;

                    if (timeSinceLastSeen > offlineThreshold) {
                        // 超过5分钟未响应，标记为离线
                        console.log('📡 设备', device.rollingCode, '超过5分钟未响应，标记为离线');
                        return {
                            ...device,
                            isOnline: false
                        };
                    } else {
                        // 最近有过响应，保持原状态或标记为在线
                        console.log('📡 设备', device.rollingCode, '最近有响应，保持在线状态');
                        return {
                            ...device,
                            isOnline: true
                        };
                    }
                }
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);
            console.log('📡 设备状态已更新');

            // 统计在线和离线设备数量（仅用于日志记录）
            const onlineCount = updatedDevices.filter(d => d.isOnline).length;
            const offlineCount = updatedDevices.length - onlineCount;
            console.log('📡 检测完成：', onlineCount, '个在线，', offlineCount, '个离线');
        } catch (error) {
            console.error('更新设备状态失败:', error);
            wx.showToast({
                title: '检测失败',
                icon: 'none',
                duration: 1500
            });
        }

        // 清理检测状态
        this.stopStatusCheck();
    },

    // 停止状态检测
    stopStatusCheck: function () {
        console.log('📡 停止设备状态检测');
        this.setData({ isCheckingOnlineStatus: false });

        try {
            wx.stopBluetoothDevicesDiscovery();
            wx.closeBluetoothAdapter();
        } catch (error) {
            console.error('停止蓝牙失败:', error);
        }

        // 清理检测相关的数据
        this.detectedDevices = null;

        // 重新加载设备列表以确保最终状态正确显示
        this.loadDiscoveredDevices();
    },

    // 转发分享功能
    onShareAppMessage: function (res) {
        return {
            title: '明治物联 - 智能家居控制',
            desc: '轻松控制你的智能设备，体验智慧生活',
            path: '/pages/index/index',
            imageUrl: '/images/share-bg.png' // 可选：分享图片
        }
    },

    // 分享到朋友圈功能
    onShareTimeline: function (res) {
        return {
            title: '明治物联 - 智能家居控制',
            query: '',
            imageUrl: '/images/share-bg.png' // 可选：分享图片
        }
    },

    // 检查是否有最近添加的设备
    checkForRecentDevices: function () {
        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const now = Date.now();
            const thirtySecondsAgo = now - 30 * 1000; // 30秒前

            const recentDevices = discoveredDevices.filter(device => {
                return device.addedTime && device.addedTime > thirtySecondsAgo;
            });

            console.log('📱 最近30秒内添加的设备:', recentDevices.length, '个');
            return recentDevices.length > 0;
        } catch (error) {
            console.error('检查新设备失败:', error);
            return false;
        }
    },

    // 将最近添加的设备标记为在线
    markRecentDevicesOnline: function () {
        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const now = Date.now();
            const thirtySecondsAgo = now - 30 * 1000;

            const updatedDevices = discoveredDevices.map(device => {
                // 如果是最近30秒内添加的设备，标记为在线
                if (device.addedTime && device.addedTime > thirtySecondsAgo) {
                    return {
                        ...device,
                        isOnline: true,
                        lastSeen: now
                    };
                }
                return device;
            });

            wx.setStorageSync('discoveredDevices', updatedDevices);

            // 重新加载设备列表
            this.loadDiscoveredDevices();
            console.log('📱 新设备已标记为在线');
        } catch (error) {
            console.error('标记新设备在线失败:', error);
        }
    },

    // 将新添加的设备标记为在线（保留旧方法作为备用）
    markNewDevicesOnline: function () {
        try {
            const discoveredDevices = wx.getStorageSync('discoveredDevices') || [];
            const updatedDevices = discoveredDevices.map(device => ({
                ...device,
                isOnline: true,
                lastSeen: Date.now()
            }));

            wx.setStorageSync('discoveredDevices', updatedDevices);

            // 重新加载设备列表
            this.loadDiscoveredDevices();
            console.log('📱 新设备已标记为在线');
        } catch (error) {
            console.error('标记新设备在线失败:', error);
        }
    }
})
