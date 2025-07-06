// 万物互联小程序 - 集中配置文件
// 所有超时时间、延迟时间等配置都在这里统一管理

/**
 * 蓝牙相关时间配置（毫秒）
 */
export const BLUETOOTH_CONFIG = {
    // 蓝牙广播相关
    BROADCAST_DURATION: 500,           // 蓝牙广播持续时间：0.5秒
    BROADCAST_LISTEN_DURATION: 500,   // 广播后监听回复时间：0.5秒

    // 命令发送超时
    DEVICE_REPLY_TIMEOUT: 5000,       // 等待设备回复超时：5秒
    RETRY_TIMEOUT: 3000,              // 重试超时时间：3秒

    // 命令队列相关
    COMMAND_QUEUE_DELAY: 100,         // 命令队列处理延迟：0.1秒
    GROUP_TIMER_INTERVAL: 1000,       // 分组定时发送间隔：1秒

    // 蓝牙适配器相关
    ADAPTER_INIT_RETRY_DELAY: 1000,   // 适配器初始化重试延迟：1秒

    // 防重复点击
    ANTI_DUPLICATE_CLICK: 500,        // 防重复点击间隔：0.5秒
};

/**
 * 用户界面相关时间配置（毫秒）
 */
export const UI_CONFIG = {
    // Toast提示时长
    TOAST_SHORT: 800,                 // 短提示：0.8秒
    TOAST_NORMAL: 1000,               // 普通提示：1秒
    TOAST_LONG: 1500,                 // 长提示：1.5秒
    TOAST_EXTRA_LONG: 2000,           // 超长提示：2秒

    // 状态提示相关
    STATUS_TIP_DURATION: 2000,        // 状态提示默认显示时长：2秒
    SUCCESS_TIP_DURATION: 1000,       // 成功提示显示时长：1秒
    ERROR_TIP_DURATION: 2000,         // 错误提示显示时长：2秒

    // 页面跳转延迟
    NAVIGATE_DELAY: 1500,             // 页面跳转延迟：1.5秒
};

/**
 * 设备检测相关时间配置（毫秒）
 */
export const DEVICE_CONFIG = {
    // 设备状态检测
    STATUS_CHECK_TIMEOUT: 5000,       // 设备状态检测超时：5秒
    DEVICE_DISCOVERY_INTERVAL: 5000,  // 设备发现广播间隔：5秒

    // 设备在线判断
    DEVICE_ONLINE_THRESHOLD: 30000,   // 设备在线判断阈值：30秒
    APP_RESTART_THRESHOLD: 5000,      // 应用重启判断阈值：5秒

    // 时间显示相关
    MINUTE_MS: 60 * 1000,             // 1分钟毫秒数
    HOUR_MS: 60 * 60 * 1000,          // 1小时毫秒数
    DAY_MS: 24 * 60 * 60 * 1000,      // 1天毫秒数
};

/**
 * 命令相关配置
 */
export const COMMAND_CONFIG = {
    // 默认地址
    DEFAULT_ADDRESS: 'cccccccccc',

    // 厂商ID
    MANUFACTURER_ID: '0x00C7',

    // 设备类型标识
    DEVICE_TYPE: {
        TIMER_SWITCH: '01',
        COUNTDOWN: '02',
        LOOP_TIMER: '03',
        SUNSET_TIMER: '04',
        GROUP_TIMER: '05'
    },

    // 功能码
    FUNCTION_CODE: {
        SWITCH: '01',
        COUNTDOWN: '02',
        LOOP_TIMER: '03',
        SUNSET_TIMER: '04',
        GROUP_TIMER: '05',
        MATCH: '08',
        TIME_SYNC: '07'  // 时间同步功能码
    }
};

/**
 * 密码相关配置
 */
export const PASSWORD_CONFIG = {
    TOAST_DURATION: 1000,             // 密码相关提示时长：1秒
};

/**
 * 获取配置值的辅助函数
 */
export const getConfig = {
    // 蓝牙相关
    broadcastDuration: () => BLUETOOTH_CONFIG.BROADCAST_DURATION,
    deviceReplyTimeout: () => BLUETOOTH_CONFIG.DEVICE_REPLY_TIMEOUT,
    retryTimeout: () => BLUETOOTH_CONFIG.RETRY_TIMEOUT,

    // UI相关
    toastNormal: () => UI_CONFIG.TOAST_NORMAL,
    statusTipDuration: () => UI_CONFIG.STATUS_TIP_DURATION,

    // 设备相关
    deviceOnlineThreshold: () => DEVICE_CONFIG.DEVICE_ONLINE_THRESHOLD,

    // 命令相关
    defaultAddress: () => COMMAND_CONFIG.DEFAULT_ADDRESS,
};

/**
 * 时间格式化辅助函数
 */
export const timeUtils = {
    // 将毫秒转换为友好的时间显示
    formatDuration: (ms) => {
        if (ms < DEVICE_CONFIG.MINUTE_MS) {
            return `${Math.floor(ms / 1000)}秒`;
        } else if (ms < DEVICE_CONFIG.HOUR_MS) {
            return `${Math.floor(ms / DEVICE_CONFIG.MINUTE_MS)}分钟`;
        } else if (ms < DEVICE_CONFIG.DAY_MS) {
            return `${Math.floor(ms / DEVICE_CONFIG.HOUR_MS)}小时`;
        } else {
            return `${Math.floor(ms / DEVICE_CONFIG.DAY_MS)}天`;
        }
    },

    // 将秒转换为时分秒格式
    secondsToHMS: (totalSeconds) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return { hours, minutes, seconds };
    }
};

// 默认导出所有配置
export default {
    BLUETOOTH_CONFIG,
    UI_CONFIG,
    DEVICE_CONFIG,
    COMMAND_CONFIG,
    PASSWORD_CONFIG,
    getConfig,
    timeUtils
}; 