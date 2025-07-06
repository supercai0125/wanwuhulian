import { generateDataWithAddr, getServiceUUIDs } from './common.js'
import { BLUETOOTH_CONFIG } from '../config.js'

// 全局变量存储监听状态
let isListeningForReply = false;
let discoveryAdapter = null;
let replyCallback = null; // 回复回调函数

// 工具函数：ArrayBuffer转十六进制字符串（参考panMini的ab2hex）
function ab2hex(buffer) {
    let hexArr = Array.prototype.map.call(
        new Uint8Array(buffer),
        function (bit) {
            return ('00' + bit.toString(16)).slice(-2)
        }
    )
    return hexArr.join('').toUpperCase();
}

// 初始化接收适配器（参考panMini双适配器方案）
function initDiscoveryAdapter() {
    return new Promise((resolve, reject) => {
        wx.openBluetoothAdapter({
            // 注意：接收时不使用 mode: 'peripheral'
            success: (res) => {
                console.log('🟢 接收适配器初始化成功:', res);
                discoveryAdapter = true;
                resolve();
            },
            fail: (res) => {
                console.log("🔴 接收适配器初始化失败:", res);
                reject(res);
            }
        });
    });
}

// 启动设备扫描监听回复（完全参考panMini的逻辑）
function startListeningForDeviceReply(callback) {
    if (isListeningForReply) {
        console.log('已在监听设备回复，跳过重复启动');
        return Promise.resolve();
    }

    console.log('🔍 开始监听设备回复...');
    replyCallback = callback;

    return initDiscoveryAdapter().then(() => {
        // 启动蓝牙设备扫描
        return new Promise((resolve, reject) => {
            wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: true,
                powerLevel: 'high',
                success: (res) => {
                    console.log('🟢 设备扫描启动成功，等待设备回复');
                    isListeningForReply = true;

                    // 监听设备发现事件（完全参考panMini的逻辑）
                    wx.onBluetoothDeviceFound((res) => {
                        if (!isListeningForReply) return;

                        res.devices.forEach(device => {
                            // 过滤设备名为F012（参考panMini的filterName逻辑）
                            if (!device.localName || device.localName !== 'F012') {
                                return;
                            }

                            console.log('🔵 发现目标设备:', device.localName, device.deviceId);

                            // 处理广播数据（参考panMini的逻辑）
                            if (device.advertisData && device.advertisData.byteLength > 0) {
                                let hexData = ab2hex(device.advertisData);

                                // 参考panMini，去掉前4个字符
                                if (hexData.length > 4) {
                                    hexData = hexData.substring(4);
                                }

                                console.log('🔵 收到设备回复:', hexData);

                                // 调用回调函数
                                if (replyCallback) {
                                    const myDate = new Date();
                                    const time = myDate.toLocaleTimeString() + " " + myDate.getMilliseconds();
                                    replyCallback({ time, data: hexData });
                                }
                            }
                        });
                    });
                    resolve();
                },
                fail: (err) => {
                    console.error('🔴 启动设备扫描失败:', err);
                    isListeningForReply = false;
                    reject(err);
                }
            });
        });
    }).catch(err => {
        console.error('🔴 初始化接收适配器失败:', err);
        return Promise.reject(err);
    });
}

// 停止监听设备回复
function stopListeningForDeviceReply() {
    if (!isListeningForReply) {
        return;
    }

    console.log('停止监听设备回复');
    isListeningForReply = false;

    // 停止设备扫描
    wx.stopBluetoothDevicesDiscovery({
        success: () => {
            console.log('设备扫描已停止');
        },
        fail: (err) => {
            console.error('停止设备扫描失败:', err);
        }
    });

    // 取消设备发现监听
    wx.offBluetoothDeviceFound();
}

// iOS 外围设备广播
function sendIOSPeripheralBroadcast(command, successCallback, errorCallback) {
    console.log('🍎 iOS 外围设备广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, true);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('🍎 iOS 广播数据:', actPayload);

    // 先初始化蓝牙适配器（参考panMini的方式）
    wx.openBluetoothAdapter({
        mode: 'peripheral',
        success: (res) => {
            console.log('🍎 iOS 蓝牙适配器初始化成功:', res);

            // 使用Promise方式创建外围设备服务器
            wx.createBLEPeripheralServer().then(res => {
                const server = res.server;
                console.log('iOS 外围设备服务器创建成功');

                // 获取系统信息以判断iOS版本
                wx.getSystemInfo({
                    success: (systemInfo) => {
                        const system = systemInfo.system;
                        const isIos13 = system.indexOf('iOS') >= 0 && system.indexOf('13.') >= 0;
                        console.log('系统信息:', system, 'iOS 13:', isIos13);

                        // 开始广播
                        const uuids = getServiceUUIDs(actPayload, isIos13);
                        console.log('iOS 服务UUIDs:', uuids);

                        const advertiseConfig = {
                            advertiseRequest: {
                                connectable: true,
                                deviceName: '11',
                                serviceUuids: uuids,
                                manufacturerData: []
                            },
                            powerLevel: 'high'
                        };

                        server.startAdvertising(advertiseConfig).then(res => {
                            console.log('🟢 iOS 广播开始成功:', res);
                            console.log('iOS 广播 localName:', advertiseConfig.advertiseRequest.deviceName);

                            // 启动设备扫描监听回复，传递回调函数打印回复
                            startListeningForDeviceReply((replyData) => {
                                console.log('🍎 iOS收到回复:', replyData.time, replyData.data);
                            }).then(() => {
                                console.log('🍎 iOS 监听启动成功');
                            }).catch(err => {
                                console.error('🍎 iOS 监听启动失败:', err);
                            });

                            // 广播配置时间后自动停止
                            setTimeout(() => {
                                server.stopAdvertising({
                                    success: () => {
                                        console.log('🔴 iOS 广播停止成功');
                                        console.log('iOS 广播停止后 localName:', advertiseConfig.advertiseRequest.deviceName);
                                        server.close();
                                        console.log('iOS 服务器已关闭');

                                        // 继续监听设备回复0.5秒
                                        setTimeout(() => {
                                            stopListeningForDeviceReply();
                                            successCallback && successCallback();
                                        }, 500);
                                    },
                                    fail: (stopErr) => {
                                        console.error('iOS 广播停止失败:', stopErr);
                                        console.log('iOS 广播停止失败后 localName:', advertiseConfig.advertiseRequest.deviceName);
                                        server.close();

                                        // 继续监听设备回复0.5秒
                                        setTimeout(() => {
                                            stopListeningForDeviceReply();
                                            successCallback && successCallback();
                                        }, 500);
                                    }
                                });
                            }, BLUETOOTH_CONFIG.BROADCAST_DURATION);
                        }, res => {
                            console.error('iOS 广播开始失败:', res);
                            server.close();
                            errorCallback && errorCallback('iOS 广播失败: ' + (res.errMsg || res.message || '未知错误'));
                        });
                    },
                    fail: (error) => {
                        console.error('获取系统信息失败:', error);
                        server.close();
                        errorCallback && errorCallback('获取系统信息失败');
                    }
                });
            }).catch(err => {
                console.error('创建iOS外围设备服务器失败:', err);
                errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
            });
        },
        fail: (error) => {
            console.error('🔴 iOS 蓝牙适配器初始化失败:', error);
            errorCallback && errorCallback('iOS 蓝牙适配器初始化失败: ' + (error.errMsg || error.message || '未知错误'));
        }
    });
}

// Android 蓝牙广播
function sendAndroidBroadcast(command, successCallback, errorCallback) {
    console.log('🤖 Android 蓝牙广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, false);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('🤖 Android 广播数据:', actPayload);

    // 使用Promise方式创建外围设备服务器
    wx.createBLEPeripheralServer().then(res => {
        const server = res.server;
        console.log('Android 外围设备服务器创建成功');

        // 开始广播
        const advertiseConfig = {
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

        server.startAdvertising(advertiseConfig).then(res => {
            console.log('🟢 Android 广播开始成功:', res);
            console.log('Android 广播 localName:', advertiseConfig.advertiseRequest.deviceName || '(空设备名)');

            // 启动设备扫描监听回复，传递回调函数打印回复
            startListeningForDeviceReply((replyData) => {
                console.log('🤖 Android收到回复:', replyData.time, replyData.data);
            }).then(() => {
                console.log('🤖 Android 监听启动成功');
            }).catch(err => {
                console.error('🤖 Android 监听启动失败:', err);
            });

            // 广播0.5秒后自动停止
            setTimeout(() => {
                server.stopAdvertising({
                    success: () => {
                        console.log('🔴 Android 广播停止成功');
                        console.log('Android 广播停止后 localName:', advertiseConfig.advertiseRequest.deviceName || '(空设备名)');
                        server.close();
                        console.log('Android 服务器已关闭');

                        // 继续监听设备回复0.5秒
                        setTimeout(() => {
                            stopListeningForDeviceReply();
                            successCallback && successCallback();
                        }, 500);
                    },
                    fail: (stopErr) => {
                        console.error('Android 广播停止失败:', stopErr);
                        server.close();

                        // 继续监听设备回复0.5秒
                        setTimeout(() => {
                            stopListeningForDeviceReply();
                            successCallback && successCallback();
                        }, 500);
                    }
                });
            }, 500);
        }, res => {
            console.error('Android 广播开始失败:', res);
            server.close();
            errorCallback && errorCallback('Android 广播失败: ' + (res.errMsg || res.message || '未知错误'));
        });
    }).catch(err => {
        console.error('创建Android外围设备服务器失败:', err);
        errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
    });
}

// 发送时控开关命令（通用蓝牙发送函数）
export function sendTimerSwitchCommand(command, successCallback, errorCallback) {
    console.log('🚀 开始发送时控开关命令:', command);

    // 先尝试初始化发送适配器，添加peripheral模式
    wx.openBluetoothAdapter({
        mode: 'peripheral',
        success: (res) => {
            console.log('🟢 发送适配器初始化成功:', res);

            // 初始化成功后检查蓝牙状态
            wx.getBluetoothAdapterState({
                success: (stateRes) => {
                    console.log('蓝牙适配器状态:', stateRes);

                    if (!stateRes.available) {
                        console.error('蓝牙适配器不可用');
                        errorCallback && errorCallback('蓝牙不可用，请检查设备蓝牙是否开启');
                        return;
                    }

                    // 获取系统信息
                    wx.getSystemInfo({
                        success: (systemInfo) => {
                            const platform = systemInfo.platform;
                            const system = systemInfo.system;
                            console.log('当前平台:', platform, '系统版本:', system);

                            // 改进iOS检测逻辑
                            const isIos = platform === 'ios' || system.indexOf('iOS') >= 0;

                            if (isIos) {
                                // iOS 使用外围设备广播
                                sendIOSPeripheralBroadcast(command, successCallback, errorCallback);
                            } else {
                                // Android 使用蓝牙广播
                                sendAndroidBroadcast(command, successCallback, errorCallback);
                            }
                        },
                        fail: (error) => {
                            console.error('获取系统信息失败:', error);
                            errorCallback && errorCallback('获取系统信息失败');
                        }
                    });
                },
                fail: (error) => {
                    console.error('获取蓝牙适配器状态失败:', error);
                    errorCallback && errorCallback('获取蓝牙状态失败，请检查蓝牙权限');
                }
            });
        },
        fail: (error) => {
            console.error('🔴 发送适配器初始化失败:', error);

            // 根据错误码提供更具体的错误信息
            let errorMsg = '蓝牙初始化失败';
            if (error.errCode === 10001) {
                errorMsg = '蓝牙未开启，请先开启蓝牙';
            } else if (error.errCode === 10004) {
                errorMsg = '没有蓝牙权限，请在设置中开启蓝牙权限';
            } else if (error.errCode === 10005) {
                errorMsg = '设备不支持蓝牙功能';
            } else {
                errorMsg = `蓝牙初始化失败 (错误码: ${error.errCode})`;
            }

            errorCallback && errorCallback(errorMsg);
        }
    });
}

// 只发送广播不监听回复的iOS版本（不重新初始化适配器）
function sendIOSBroadcastOnlyDirect(command, successCallback, errorCallback) {
    console.log('📡 iOS 直接发送广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, true);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('📡 iOS 直接广播数据:', actPayload);

    // 直接使用现有蓝牙适配器创建外围设备服务器
    wx.createBLEPeripheralServer().then(res => {
        const server = res.server;
        console.log('iOS 只广播服务器创建成功');

        // 获取系统信息以判断iOS版本
        wx.getSystemInfo({
            success: (systemInfo) => {
                const system = systemInfo.system;
                const isIos13 = system.indexOf('iOS') >= 0 && system.indexOf('13.') >= 0;
                console.log('系统信息:', system, 'iOS 13:', isIos13);

                // 开始广播
                const uuids = getServiceUUIDs(actPayload, isIos13);
                console.log('iOS 只广播服务UUIDs:', uuids);

                const advertiseConfig = {
                    advertiseRequest: {
                        connectable: true,
                        deviceName: '11',
                        serviceUuids: uuids,
                        manufacturerData: []
                    },
                    powerLevel: 'high'
                };

                server.startAdvertising(advertiseConfig).then(res => {
                    console.log('🟢 iOS 只广播开始成功:', res);

                    // 广播0.5秒后自动停止
                    setTimeout(() => {
                        server.stopAdvertising({
                            success: () => {
                                console.log('🔴 iOS 只广播停止成功');
                                server.close();
                                successCallback && successCallback();
                            },
                            fail: (stopErr) => {
                                console.error('iOS 只广播停止失败:', stopErr);
                                server.close();
                                successCallback && successCallback();
                            }
                        });
                    }, 500);
                }, res => {
                    console.error('iOS 只广播开始失败:', res);
                    server.close();
                    errorCallback && errorCallback('iOS 广播失败: ' + (res.errMsg || res.message || '未知错误'));
                });
            },
            fail: (error) => {
                console.error('获取系统信息失败:', error);
                server.close();
                errorCallback && errorCallback('获取系统信息失败');
            }
        });
    }).catch(err => {
        console.error('创建iOS直接广播服务器失败:', err);
        errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
    });
}

// 只发送广播不监听回复的Android版本（不重新初始化适配器）
function sendAndroidBroadcastOnlyDirect(command, successCallback, errorCallback) {
    console.log('📡 Android 直接发送广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, false);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('📡 Android 直接广播数据:', actPayload);

    // 直接使用现有蓝牙适配器创建外围设备服务器
    wx.createBLEPeripheralServer().then(res => {
        const server = res.server;
        console.log('Android 只广播服务器创建成功');

        // 开始广播
        const advertiseConfig = {
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

        server.startAdvertising(advertiseConfig).then(res => {
            console.log('🟢 Android 只广播开始成功:', res);

            // 广播0.5秒后自动停止
            setTimeout(() => {
                server.stopAdvertising({
                    success: () => {
                        console.log('🔴 Android 只广播停止成功');
                        server.close();
                        successCallback && successCallback();
                    },
                    fail: (stopErr) => {
                        console.error('Android 只广播停止失败:', stopErr);
                        server.close();
                        successCallback && successCallback();
                    }
                });
            }, 500);
        }, res => {
            console.error('Android 只广播开始失败:', res);
            server.close();
            errorCallback && errorCallback('Android 广播失败: ' + (res.errMsg || res.message || '未知错误'));
        });
    }).catch(err => {
        console.error('创建Android直接广播服务器失败:', err);
        errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
    });
}

// 只发送广播不监听回复的iOS版本（带适配器初始化，用于设备扫描页面）
export function sendIOSBroadcastOnlyForDiscovery(command, successCallback, errorCallback) {
    console.log('📡 iOS 只发送广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, true);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('📡 iOS 只广播数据:', actPayload);

    // 先初始化蓝牙适配器（用于设备扫描页面）
    wx.openBluetoothAdapter({
        mode: 'peripheral',
        success: (res) => {
            console.log('📡 iOS 只广播蓝牙适配器初始化成功:', res);

            // 使用Promise方式创建外围设备服务器
            wx.createBLEPeripheralServer().then(res => {
                const server = res.server;
                console.log('iOS 只广播服务器创建成功');

                // 获取系统信息以判断iOS版本
                wx.getSystemInfo({
                    success: (systemInfo) => {
                        const system = systemInfo.system;
                        const isIos13 = system.indexOf('iOS') >= 0 && system.indexOf('13.') >= 0;
                        console.log('系统信息:', system, 'iOS 13:', isIos13);

                        // 开始广播
                        const uuids = getServiceUUIDs(actPayload, isIos13);
                        console.log('iOS 只广播服务UUIDs:', uuids);

                        const advertiseConfig = {
                            advertiseRequest: {
                                connectable: true,
                                deviceName: '11',
                                serviceUuids: uuids,
                                manufacturerData: []
                            },
                            powerLevel: 'high'
                        };

                        server.startAdvertising(advertiseConfig).then(res => {
                            console.log('🟢 iOS 只广播开始成功:', res);

                            // 广播0.5秒后自动停止
                            setTimeout(() => {
                                server.stopAdvertising({
                                    success: () => {
                                        console.log('🔴 iOS 只广播停止成功');
                                        server.close();
                                        successCallback && successCallback();
                                    },
                                    fail: (stopErr) => {
                                        console.error('iOS 只广播停止失败:', stopErr);
                                        server.close();
                                        successCallback && successCallback();
                                    }
                                });
                            }, 500);
                        }, res => {
                            console.error('iOS 只广播开始失败:', res);
                            server.close();
                            errorCallback && errorCallback('iOS 广播失败: ' + (res.errMsg || res.message || '未知错误'));
                        });
                    },
                    fail: (error) => {
                        console.error('获取系统信息失败:', error);
                        server.close();
                        errorCallback && errorCallback('获取系统信息失败');
                    }
                });
            }).catch(err => {
                console.error('创建iOS只广播服务器失败:', err);
                errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
            });
        },
        fail: (error) => {
            console.error('🔴 iOS 只广播蓝牙适配器初始化失败:', error);
            errorCallback && errorCallback('iOS 蓝牙适配器初始化失败: ' + (error.errMsg || error.message || '未知错误'));
        }
    });
}

// 只发送广播，不监听回复（用于设备扫描）
export function sendBroadcastOnly(command, successCallback, errorCallback) {
    console.log('📡 只发送广播命令:', command);

    // 先检查是否已有蓝牙适配器，避免重复初始化导致冲突
    wx.getBluetoothAdapterState({
        success: (stateRes) => {
            console.log('📡 检查现有蓝牙适配器状态:', stateRes);

            if (!stateRes.available) {
                console.error('蓝牙适配器不可用');
                errorCallback && errorCallback('蓝牙不可用');
                return;
            }

            // 蓝牙适配器可用，直接获取系统信息并发送广播
            wx.getSystemInfo({
                success: (systemInfo) => {
                    const platform = systemInfo.platform;
                    const system = systemInfo.system;
                    const isIos = platform === 'ios' || system.indexOf('iOS') >= 0;

                    console.log('📡 广播平台:', platform, system, 'iOS:', isIos);

                    if (isIos) {
                        sendIOSBroadcastOnlyDirect(command, successCallback, errorCallback);
                    } else {
                        sendAndroidBroadcastOnlyDirect(command, successCallback, errorCallback);
                    }
                },
                fail: (error) => {
                    console.error('获取系统信息失败:', error);
                    errorCallback && errorCallback('获取系统信息失败');
                }
            });
        },
        fail: (error) => {
            console.log('📡 没有现有蓝牙适配器，尝试初始化新的:', error);

            // 没有现有适配器，初始化新的
            wx.openBluetoothAdapter({
                mode: 'peripheral',
                success: (res) => {
                    console.log('📡 只广播适配器初始化成功:', res);

                    // 获取系统信息
                    wx.getSystemInfo({
                        success: (systemInfo) => {
                            const platform = systemInfo.platform;
                            const system = systemInfo.system;
                            const isIos = platform === 'ios' || system.indexOf('iOS') >= 0;

                            console.log('📡 广播平台:', platform, system, 'iOS:', isIos);

                            if (isIos) {
                                sendIOSBroadcastOnlyDirect(command, successCallback, errorCallback);
                            } else {
                                sendAndroidBroadcastOnlyDirect(command, successCallback, errorCallback);
                            }
                        },
                        fail: (error) => {
                            console.error('获取系统信息失败:', error);
                            errorCallback && errorCallback('获取系统信息失败');
                        }
                    });
                },
                fail: (error) => {
                    console.error('📡 只广播适配器初始化失败:', error);
                    errorCallback && errorCallback('蓝牙初始化失败');
                }
            });
        }
    });
}

// 只发送广播不监听回复的Android版本（带适配器初始化，用于设备扫描页面）
export function sendAndroidBroadcastOnlyForDiscovery(command, successCallback, errorCallback) {
    console.log('📡 Android 只发送广播:', command);

    const defaultAddress = 'cccccccccc';
    const actPayload = generateDataWithAddr(defaultAddress, command, false);

    if (!actPayload) {
        console.error('生成广播数据失败');
        errorCallback && errorCallback('生成广播数据失败');
        return;
    }

    console.log('📡 Android 只广播数据:', actPayload);

    // 使用Promise方式创建外围设备服务器
    wx.createBLEPeripheralServer().then(res => {
        const server = res.server;
        console.log('Android 只广播服务器创建成功');

        // 开始广播
        const advertiseConfig = {
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

        server.startAdvertising(advertiseConfig).then(res => {
            console.log('🟢 Android 只广播开始成功:', res);

            // 广播0.5秒后自动停止
            setTimeout(() => {
                server.stopAdvertising({
                    success: () => {
                        console.log('🔴 Android 只广播停止成功');
                        server.close();
                        successCallback && successCallback();
                    },
                    fail: (stopErr) => {
                        console.error('Android 只广播停止失败:', stopErr);
                        server.close();
                        successCallback && successCallback();
                    }
                });
            }, 500);
        }, res => {
            console.error('Android 只广播开始失败:', res);
            server.close();
            errorCallback && errorCallback('Android 广播失败: ' + (res.errMsg || res.message || '未知错误'));
        });
    }).catch(err => {
        console.error('创建Android只广播服务器失败:', err);
        errorCallback && errorCallback('创建蓝牙服务器失败: ' + (err.errMsg || err.message || '未知错误'));
    });
}

// 导出设备回复监听功能
export { startListeningForDeviceReply, stopListeningForDeviceReply };