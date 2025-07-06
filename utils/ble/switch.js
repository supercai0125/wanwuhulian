import { sendBroadcastOnly, sendIOSBroadcastOnlyForDiscovery, sendAndroidBroadcastOnlyForDiscovery } from './core.js'

// 专门为设备扫描页面提供的广播函数（会初始化新的蓝牙适配器）
function sendBroadcastOnlyForDiscovery(command, successCallback, errorCallback) {
    console.log('📡 设备扫描页面发送广播命令:', command);

    // 设备扫描页面需要初始化新的peripheral适配器
    wx.openBluetoothAdapter({
        mode: 'peripheral',
        success: (res) => {
            console.log('📡 设备扫描广播适配器初始化成功:', res);

            // 获取系统信息
            wx.getSystemInfo({
                success: (systemInfo) => {
                    const platform = systemInfo.platform;
                    const system = systemInfo.system;
                    const isIos = platform === 'ios' || system.indexOf('iOS') >= 0;

                    console.log('📡 设备扫描广播平台:', platform, system, 'iOS:', isIos);

                    if (isIos) {
                        sendIOSBroadcastOnlyForDiscovery(command, successCallback, errorCallback);
                    } else {
                        sendAndroidBroadcastOnlyForDiscovery(command, successCallback, errorCallback);
                    }
                },
                fail: (error) => {
                    console.error('获取系统信息失败:', error);
                    errorCallback && errorCallback('获取系统信息失败');
                }
            });
        },
        fail: (error) => {
            console.error('📡 设备扫描广播适配器初始化失败:', error);
            errorCallback && errorCallback('蓝牙初始化失败');
        }
    });
}

// 生成开关命令
const generateSwitchCommand = (power) => {
    // 根据开关状态选择命令
    return power ? '11223301026677889900112233' : '11223301016677889900112233';
}

// 生成匹配命令（用于小程序设备发现）
const generateMatchCommand = () => {
    // 根据协议表格，小程序配对命令格式：
    // 字节0-2: 滚动码 (00 00 00)
    // 字节3: 设备类型 (01 - 固定值)
    // 字节4: 功能码 (08 - 小程序配对)
    // 字节5-12: 其他数据字段 (用0填充)
    return '00000001080000000000000000';
}

// 发送开关命令（修改为只发送广播，避免蓝牙适配器冲突）
export function sendSwitchCommand(power, successCallback, errorCallback) {
    console.log('开始发送开关命令:', power ? '开启' : '关闭');

    try {
        // 生成开关命令
        const command = generateSwitchCommand(power);
        console.log('生成的开关命令:', command);

        // 使用只发送广播的方式，避免与设备扫描页面的蓝牙适配器冲突
        sendBroadcastOnly(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送开关命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

// 只发送广播命令，不监听回复（用于设备扫描页面）
export function sendSwitchBroadcastOnly(power, successCallback, errorCallback) {
    console.log('📡 发送扫描广播命令:', power ? '开启' : '关闭');

    try {
        // 生成开关命令
        const command = generateSwitchCommand(power);
        console.log('📡 扫描广播命令:', command);

        // 只发送广播，不监听回复
        sendBroadcastOnly(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送扫描广播命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

// 发送匹配命令用于设备发现（只发送广播）
export function sendMatchBroadcastOnly(successCallback, errorCallback) {
    console.log('📡 发送设备匹配广播命令');

    try {
        // 生成匹配命令
        const command = generateMatchCommand();
        console.log('📡 匹配广播命令:', command);

        // 使用专门的设备扫描广播函数，会初始化新的蓝牙适配器
        sendBroadcastOnlyForDiscovery(command, successCallback, errorCallback);

    } catch (error) {
        console.error('发送匹配广播命令失败:', error);
        errorCallback && errorCallback(error);
    }
}

export { generateSwitchCommand, generateMatchCommand } 