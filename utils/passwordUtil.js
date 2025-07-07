// 密码验证工具类
// 用于各种操作的密码验证

/**
 * 检查设备控制权限（带Promise支持）
 * @param {string} deviceId - 设备ID
 * @param {string} operationName - 操作名称
 * @returns {Promise} - 返回Promise，验证成功则resolve，失败则reject
 */
export function checkControlPermission(deviceId, operationName) {
    return new Promise((resolve, reject) => {
        // 获取设备特定的密码
        const passwordData = wx.getStorageSync(`password_${deviceId}`) || {};
        const correctPassword = passwordData.password || '123456'; // 默认密码
        
        wx.showModal({
            title: '权限验证',
            content: `${operationName}需要验证密码`,
            editable: true,
            placeholderText: '请输入密码',
            success: function (res) {
                if (res.confirm) {
                    const inputPassword = res.content;
                    if (inputPassword === correctPassword) {
                        // 密码正确
                        resolve();
                    } else {
                        // 密码错误
                        wx.showToast({
                            title: '密码错误',
                            icon: 'error',
                            duration: 2000
                        });
                        reject('密码错误');
                    }
                } else {
                    // 用户取消
                    reject('用户取消');
                }
            },
            fail: function (err) {
                reject(err);
            }
        });
    });
}

/**
 * 通用密码验证函数
 * @param {string} operationName - 操作名称，用于显示
 * @param {string} correctPassword - 正确的密码
 * @param {Function} successCallback - 验证成功回调
 * @param {Function} errorCallback - 验证失败回调
 */
export function verifyPassword(operationName, correctPassword, successCallback, errorCallback) {
    wx.showModal({
        title: `${operationName}密码验证`,
        content: '请输入密码',
        editable: true,
        placeholderText: '请输入密码',
        success: function (res) {
            if (res.confirm) {
                const inputPassword = res.content;
                if (inputPassword === correctPassword) {
                    // 密码正确
                    if (successCallback) {
                        successCallback();
                    }
                } else {
                    // 密码错误
                    wx.showToast({
                        title: '密码错误',
                        icon: 'error',
                        duration: 2000
                    });
                    if (errorCallback) {
                        errorCallback('密码错误');
                    }
                }
            } else {
                // 用户取消
                if (errorCallback) {
                    errorCallback('用户取消');
                }
            }
        },
        fail: function (err) {
            if (errorCallback) {
                errorCallback(err);
            }
        }
    });
}

/**
 * 验证设备控制密码
 * @param {string} controlType - 控制类型（如"开关控制"、"定时设置"等）
 * @param {Function} successCallback - 验证成功回调
 * @param {Function} errorCallback - 验证失败回调
 */
export function verifyControlPassword(controlType, successCallback, errorCallback) {
    const correctPassword = '123456'; // 默认密码，可以从配置文件获取

    wx.showModal({
        title: `${controlType}密码验证`,
        content: '请输入设备控制密码',
        editable: true,
        placeholderText: '请输入密码',
        success: function (res) {
            if (res.confirm) {
                const inputPassword = res.content;
                if (inputPassword === correctPassword) {
                    // 密码正确
                    if (successCallback) {
                        successCallback();
                    }
                } else {
                    // 密码错误
                    wx.showToast({
                        title: '密码错误',
                        icon: 'error',
                        duration: 2000
                    });
                    if (errorCallback) {
                        errorCallback('密码错误');
                    }
                }
            } else {
                // 用户取消
                if (errorCallback) {
                    errorCallback('用户取消');
                }
            }
        },
        fail: function (err) {
            if (errorCallback) {
                errorCallback(err);
            }
        }
    });
}

// 已经使用了 export 导出，不需要 module.exports 