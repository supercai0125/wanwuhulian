// app.js
import unifiedBluetoothManager from './utils/ble/unified-manager.js'

App({
    onLaunch: function () {
        // 应用启动时初始化统一蓝牙管理器
        unifiedBluetoothManager.init().then(() => {
            // 初始化成功
        }).catch(err => {
            // 初始化失败，静默处理
        });
    },

    onHide: function () {
        // 应用进入后台
    },

    onShow: function () {
        // 应用进入前台
        // 不需要重新初始化蓝牙管理器，因为它是全局单例
        // 只在onLaunch时初始化一次即可
    },

    onError: function (error) {
        // 应用错误，静默处理
    },

    // 全局数据
    globalData: {
        userInfo: null,
        bluetoothManager: unifiedBluetoothManager
    }
})
