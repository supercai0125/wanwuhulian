// index.js
import unifiedBluetoothManager from '../../utils/ble/unified-manager.js'

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

        if (hasRecentDevices) {
            // 有新设备添加，将新设备标记为在线（新扫描到的肯定在线）
            this.markRecentDevicesOnline();
        } else {
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
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];

            // 格式化时间显示和设备名称
            const formattedDevices = discoveredDevices.map(device => Object.assign({}, device, {
                lastSeenText: this.formatLastSeenTime(device.lastSeen),
                shortRollingCode: device.rollingCode || '',
                displayName: device.rollingCode ? `设备 ${device.rollingCode}` : '智能设备'
            }));

            this.setData({
                discoveredDevices: formattedDevices
            });
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
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const updatedDevices = discoveredDevices.filter(device => device.rollingCode !== rollingCode);

            wx.setStorageSync('discovered_devices', updatedDevices);

            // 更新界面
            const currentList = this.data.discoveredDevices.slice();
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

    // 检测设备在线状态（使用统一蓝牙管理器）
    checkDevicesOnlineStatus: function () {
        // 如果正在检测中，跳过本次检测
        if (this.data.isCheckingOnlineStatus) {
            console.log('📡 状态检测正在进行中，跳过重复请求');
            wx.showToast({
                title: '正在检测中，请稍候...',
                icon: 'none',
                duration: 1500
            });
            return;
        }

        const allDiscoveredDevices = wx.getStorageSync('discovered_devices') || [];

        if (allDiscoveredDevices.length === 0) {
            wx.showToast({
                title: '暂无设备',
                icon: 'none',
                duration: 1500
            });
            return;
        }

        console.log('📡 开始新的状态检测，设备数量:', allDiscoveredDevices.length);
        this.setData({ isCheckingOnlineStatus: true });

        // 记录检测开始时的设备状态，用于检测超时后的处理
        this.detectedDevices = new Set();
        console.log('📡 开始状态检测，清空已检测设备列表');

        // 使用统一蓝牙管理器进行状态检测
        this.initUnifiedBluetoothManager();

        // 不再使用10秒定时器，改为在命令超时时立即处理
    },



    // 初始化统一蓝牙管理器进行状态检测
    initUnifiedBluetoothManager: function () {
        const that = this;

        // 初始化统一蓝牙管理器
        unifiedBluetoothManager.init()
            .then(() => {
                console.log('📡 统一蓝牙管理器初始化成功，开始状态检测');

                // 重置设备过滤条件，准备接收所有设备回复
                unifiedBluetoothManager.resetDeviceFilter();

                // 设置设备回复监听
                unifiedBluetoothManager.setReplyCallback((replyData) => {
                    that.handleDeviceReply(replyData);
                });

                // 向每个设备发送状态检测命令
                that.sendStatusCheckToAllDevices();
            })
            .catch((error) => {
                console.error('📡 统一蓝牙管理器初始化失败:', error);
                wx.showToast({
                    title: '蓝牙初始化失败',
                    icon: 'none',
                    duration: 2000
                });
                that.stopStatusCheck();
            });
    },

    // 处理设备回复
    handleDeviceReply: function (replyData) {
        console.log('📡 列表页面收到设备回复:', replyData.data, '来自设备:', replyData.rollingCode);

        // 优先使用传递过来的滚动码（从设备localName获取）
        let rollingCode = replyData.rollingCode;

        // 如果没有传递滚动码，尝试从回复数据中提取
        if (!rollingCode) {
            rollingCode = this.extractRollingCodeFromReplyData(replyData.data);
        }

        if (rollingCode) {
            console.log('📡 提取到滚动码:', rollingCode);
            this.updateDeviceOnlineStatus(rollingCode);
        } else {
            console.log('📡 未能提取到有效的滚动码');
        }
    },

    // 从回复数据中提取滚动码
    extractRollingCodeFromReplyData: function (hexData) {
        try {
            // 滚动码是两字节，即4个十六进制字符
            if (hexData && hexData.length >= 4) {
                return hexData.substring(0, 4);
            }
        } catch (error) {
            console.error('提取滚动码失败:', error);
        }
        return null;
    },

    // 更新设备在线状态
    updateDeviceOnlineStatus: function (rollingCode) {
        // 记录已检测到的设备
        if (this.detectedDevices) {
            this.detectedDevices.add(rollingCode);
        }

        // 更新设备在线状态
        try {
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const updatedDevices = discoveredDevices.map(savedDevice => {
                if (savedDevice.rollingCode === rollingCode) {
                    return Object.assign({}, savedDevice, {
                        isOnline: true,
                        lastSeen: Date.now()
                    });
                }
                return savedDevice;
            });

            wx.setStorageSync('discovered_devices', updatedDevices);

            // 重新加载并过滤设备列表以更新界面
            this.loadDiscoveredDevices();

            console.log('📡 设备状态已更新为在线:', rollingCode);

            // 注意：不再需要检查所有设备是否检测到，因为现在使用命令完成计数
        } catch (error) {
            console.error('更新设备在线状态失败:', error);
        }
    },

    // 向所有设备发送状态检测命令
    sendStatusCheckToAllDevices: function () {
        const that = this;
        const discoveredDevices = wx.getStorageSync('discovered_devices') || [];

        if (discoveredDevices.length === 0) {
            console.log('📡 没有设备需要检测');
            this.finishStatusCheckAndUpdateOfflineDevices();
            return;
        }

        console.log('📡 开始向', discoveredDevices.length, '个设备发送状态检测命令');

        // 记录待检测的设备和已发送的命令数
        this.totalDevicesToCheck = discoveredDevices.length;
        this.commandsSent = 0;
        this.commandsCompleted = 0;

        // 向每个设备发送状态检测命令
        discoveredDevices.forEach((device, index) => {
            // 延迟发送，避免命令冲突，每个命令间隔200ms
            setTimeout(() => {
                this.sendStatusCheckToDevice(device);
            }, index * 200);
        });

        // 设置总超时时间：基础时间 + 设备数量 * 间隔时间 + 额外缓冲时间
        const totalTimeout = 2000 + discoveredDevices.length * 200 + 3000;
        setTimeout(() => {
            if (this.data.isCheckingOnlineStatus) {
                console.log('📡 状态检测总超时，强制结束');
                this.finishStatusCheckAndUpdateOfflineDevices();
            }
        }, totalTimeout);
    },

    // 向单个设备发送状态检测命令
    sendStatusCheckToDevice: function (device) {
        const that = this;

        if (!this.data.isCheckingOnlineStatus) {
            console.log('📡 状态检测已停止，跳过设备:', device.rollingCode);
            return;
        }

        // 生成带有设备滚动码的状态检测命令
        // 命令格式：滚动码(2字节) + 00 + 设备类型01 + 功能码08 + 填充0 (总共13字节=26字符)
        const statusCommand = `${device.rollingCode}0001080000000000000000`;

        console.log('📡 首页状态检测：向设备', device.rollingCode, '发送状态命令:', statusCommand);

        this.commandsSent++;

        unifiedBluetoothManager.sendCommand(statusCommand, {
            expectReply: true,
            timeout: 3000, // 单个设备3秒超时
            successCallback: (result) => {
                console.log('📡 设备', device.rollingCode, '状态检测成功:', result);
                that.commandsCompleted++;
                that.checkIfAllCommandsCompleted();
            },
            errorCallback: (error) => {
                console.log('📡 设备', device.rollingCode, '状态检测失败:', error);
                that.commandsCompleted++;
                that.checkIfAllCommandsCompleted();
            }
        }).catch((error) => {
            console.log('📡 设备', device.rollingCode, '状态检测Promise异常:', error);
            that.commandsCompleted++;
            that.checkIfAllCommandsCompleted();
        });
    },

    // 检查是否所有命令都已完成
    checkIfAllCommandsCompleted: function () {
        if (this.commandsCompleted >= this.totalDevicesToCheck) {
            console.log('📡 所有设备状态检测命令已完成，总计:', this.totalDevicesToCheck);
            // 稍微延迟一下，确保最后的回复都能被处理
            setTimeout(() => {
                if (this.data.isCheckingOnlineStatus) {
                    this.finishStatusCheckAndUpdateOfflineDevices();
                }
            }, 500);
        }
    },







    // 完成状态检测并更新离线设备
    finishStatusCheckAndUpdateOfflineDevices: function () {
        // 防止重复调用
        if (!this.data.isCheckingOnlineStatus) {
            console.log('📡 状态检测已停止，跳过重复调用');
            return;
        }

        console.log('📡 开始更新设备状态，检测结果:', this.detectedDevices);

        try {
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const detectedDevices = this.detectedDevices || new Set();
            const now = Date.now();

            // 更新设备状态：检测到的设备标记为在线，未检测到的标记为离线
            const updatedDevices = discoveredDevices.map(device => {
                if (detectedDevices.has(device.rollingCode)) {
                    // 已检测到的设备，标记为在线
                    console.log('📡 设备在线:', device.rollingCode);
                    return Object.assign({}, device, {
                        isOnline: true,
                        lastSeen: now
                    });
                } else {
                    // 未检测到的设备，标记为离线
                    console.log('📡 设备离线:', device.rollingCode);
                    return Object.assign({}, device, {
                        isOnline: false
                    });
                }
            });

            wx.setStorageSync('discovered_devices', updatedDevices);

            // 统计在线和离线设备数量
            const onlineCount = updatedDevices.filter(d => d.isOnline).length;
            const offlineCount = updatedDevices.length - onlineCount;

            console.log('📡 状态检测完成:', { onlineCount, offlineCount });

            // 显示检测结果
            wx.showToast({
                title: `检测完成: ${onlineCount}在线 ${offlineCount}离线`,
                icon: 'none',
                duration: 2000
            });
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
        if (!this.data.isCheckingOnlineStatus) {
            console.log('📡 状态检测已经停止，跳过重复停止');
            return;
        }

        console.log('📡 正在停止状态检测...');
        this.setData({ isCheckingOnlineStatus: false });

        // 清理统一蓝牙管理器的命令队列和回调
        unifiedBluetoothManager.clearCommandQueue();
        unifiedBluetoothManager.setReplyCallback(null);

        // 清理检测相关的数据
        this.detectedDevices = null;
        this.totalDevicesToCheck = 0;
        this.commandsSent = 0;
        this.commandsCompleted = 0;

        // 重新加载设备列表以确保最终状态正确显示
        this.loadDiscoveredDevices();
        console.log('📡 状态检测已停止，重新加载设备列表');
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
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const now = Date.now();
            const thirtySecondsAgo = now - 30 * 1000; // 30秒前

            const recentDevices = discoveredDevices.filter(device => {
                return device.addedTime && device.addedTime > thirtySecondsAgo;
            });

            return recentDevices.length > 0;
        } catch (error) {
            console.error('检查新设备失败:', error);
            return false;
        }
    },

    // 将最近添加的设备标记为在线
    markRecentDevicesOnline: function () {
        try {
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const now = Date.now();
            const thirtySecondsAgo = now - 30 * 1000;

            const updatedDevices = discoveredDevices.map(device => {
                // 如果是最近30秒内添加的设备，标记为在线
                if (device.addedTime && device.addedTime > thirtySecondsAgo) {
                    return Object.assign({}, device, {
                        isOnline: true,
                        lastSeen: now
                    });
                }
                return device;
            });

            wx.setStorageSync('discovered_devices', updatedDevices);

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
            const discoveredDevices = wx.getStorageSync('discovered_devices') || [];
            const updatedDevices = discoveredDevices.map(device => Object.assign({}, device, {
                isOnline: true,
                lastSeen: Date.now()
            }));

            wx.setStorageSync('discovered_devices', updatedDevices);

            // 重新加载设备列表
            this.loadDiscoveredDevices();
        } catch (error) {
            console.error('标记新设备在线失败:', error);
        }
    }
})
