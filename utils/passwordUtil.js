/**
 * 密码验证工具函数
 */

// 检查设备是否启用了密码保护
function isPasswordEnabled(deviceId) {
    const deviceList = wx.getStorageSync('deviceList') || [];
    const device = deviceList.find(d => d.id === deviceId);
    return device && device.controller && device.controller.passwordEnabled;
}

// 获取设备密码
function getDevicePassword(deviceId) {
    const passwordData = wx.getStorageSync(`password_${deviceId}`) || {};
    return passwordData.password || '';
}

// 验证密码
function verifyPassword(deviceId, inputPassword) {
    const savedPassword = getDevicePassword(deviceId);
    return inputPassword === savedPassword;
}

// 显示密码输入对话框
function showPasswordDialog(options = {}) {
    const {
        title = '输入密码',
        placeholderText = '请输入设备密码以继续操作',
        onSuccess = () => { },
        onCancel = () => { },
        onError = () => { }
    } = options;

    return new Promise((resolve, reject) => {
        wx.showModal({
            title: title,
            editable: true,
            placeholderText: placeholderText,
            success: (res) => {
                if (res.confirm) {
                    const inputPassword = res.content || '';
                    if (inputPassword.length === 0) {
                        wx.showToast({
                            title: '请输入密码',
                            icon: 'none'
                        });
                        onError('密码不能为空');
                        reject('密码不能为空');
                        return;
                    }

                    onSuccess(inputPassword);
                    resolve(inputPassword);
                } else {
                    onCancel();
                    reject('用户取消');
                }
            },
            fail: (err) => {
                onError(err);
                reject(err);
            }
        });
    });
}

// 验证设备操作权限
function checkDevicePermission(deviceId, options = {}) {
    return new Promise((resolve, reject) => {
        if (!isPasswordEnabled(deviceId)) {
            // 未启用密码保护，直接允许操作
            resolve(true);
            return;
        }

        const {
            title = '设备验证',
            placeholderText = '此操作需要密码验证',
            onSuccess = () => { },
            onCancel = () => { },
            onError = () => { }
        } = options;

        showPasswordDialog({
            title,
            placeholderText,
            onSuccess: (inputPassword) => {
                if (verifyPassword(deviceId, inputPassword)) {
                    wx.showToast({
                        title: '验证成功',
                        icon: 'success',
                        duration: 1000
                    });
                    onSuccess();
                    resolve(true);
                } else {
                    wx.showToast({
                        title: '密码错误',
                        icon: 'none'
                    });
                    onError('密码错误');
                    reject('密码错误');
                }
            },
            onCancel: () => {
                onCancel();
                reject('用户取消');
            },
            onError: (err) => {
                onError(err);
                reject(err);
            }
        });
    });
}

// 批量操作密码验证（用于发送所有定时等操作）
function checkBatchOperationPermission(deviceId, operationName = '批量操作') {
    return checkDevicePermission(deviceId, {
        title: '批量操作验证',
        placeholderText: `执行${operationName}需要密码验证`,
        onSuccess: () => {
            console.log(`${operationName}密码验证成功`);
        },
        onCancel: () => {
            console.log(`用户取消${operationName}`);
        },
        onError: (err) => {
            console.error(`${operationName}密码验证失败:`, err);
        }
    });
}

// 设备控制权限验证（用于开关控制等）
function checkControlPermission(deviceId, controlType = '设备控制') {
    return checkDevicePermission(deviceId, {
        title: '设备控制验证',
        placeholderText: `${controlType}需要密码验证`,
        onSuccess: () => {
            console.log(`${controlType}密码验证成功`);
        },
        onCancel: () => {
            console.log(`用户取消${controlType}`);
        },
        onError: (err) => {
            console.error(`${controlType}密码验证失败:`, err);
        }
    });
}

module.exports = {
    isPasswordEnabled,
    getDevicePassword,
    verifyPassword,
    showPasswordDialog,
    checkDevicePermission,
    checkBatchOperationPermission,
    checkControlPermission
}; 