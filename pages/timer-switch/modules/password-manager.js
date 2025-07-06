// 密码管理模块
class PasswordManager {
    constructor(page) {
        this.page = page;
    }

    // 设置密码
    setPassword() {
        console.log('点击设置密码按钮');

        const device = this.page.data.device;
        if (device.passwordEnabled) {
            this.showPasswordManagementOptions();
        } else {
            this.showPasswordSetupDialog();
        }
    }

    // 显示密码管理选项
    showPasswordManagementOptions() {
        wx.showActionSheet({
            itemList: ['修改密码', '关闭密码保护'],
            success: (res) => {
                if (res.tapIndex === 0) {
                    this.showPasswordChangeDialog();
                } else if (res.tapIndex === 1) {
                    this.showPasswordDisableDialog();
                }
            }
        });
    }

    // 显示密码设置对话框
    showPasswordSetupDialog() {
        wx.showModal({
            title: '设置密码',
            editable: true,
            placeholderText: '请输入6位数字密码',
            success: (res) => {
                if (res.confirm && res.content) {
                    const password = res.content.trim();
                    if (this.validatePassword(password)) {
                        this.confirmNewPassword(password);
                    }
                }
            }
        });
    }

    // 确认新密码
    confirmNewPassword(password) {
        wx.showModal({
            title: '确认密码',
            editable: true,
            placeholderText: '请再次输入密码确认',
            success: (res) => {
                if (res.confirm && res.content) {
                    const confirmPassword = res.content.trim();
                    if (password === confirmPassword) {
                        this.saveNewPassword(password);
                    } else {
                        wx.showToast({
                            title: '两次密码不一致',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    }

    // 显示密码修改对话框
    showPasswordChangeDialog() {
        wx.showModal({
            title: '验证当前密码',
            editable: true,
            placeholderText: '请输入当前密码',
            success: (res) => {
                if (res.confirm && res.content) {
                    const currentPassword = res.content.trim();
                    const savedPassword = this.getSavedPassword();

                    if (currentPassword === savedPassword) {
                        this.showPasswordSetupDialog();
                    } else {
                        wx.showToast({
                            title: '当前密码错误',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    }

    // 显示关闭密码保护对话框
    showPasswordDisableDialog() {
        wx.showModal({
            title: '关闭密码保护',
            editable: true,
            placeholderText: '请输入当前密码以关闭密码保护',
            success: (res) => {
                if (res.confirm && res.content) {
                    const password = res.content.trim();
                    const savedPassword = this.getSavedPassword();

                    if (password === savedPassword) {
                        this.disablePasswordProtection();
                    } else {
                        wx.showToast({
                            title: '密码错误',
                            icon: 'none'
                        });
                    }
                }
            }
        });
    }

    // 验证密码格式
    validatePassword(password) {
        if (!password || password.length !== 6) {
            wx.showToast({
                title: '请输入6位数字密码',
                icon: 'none'
            });
            return false;
        }

        if (!/^\d{6}$/.test(password)) {
            wx.showToast({
                title: '密码只能包含数字',
                icon: 'none'
            });
            return false;
        }

        return true;
    }

    // 保存新密码
    saveNewPassword(password) {
        const passwordData = {
            password: password,
            updateTime: new Date().getTime()
        };
        wx.setStorageSync(`password_${this.page.data.deviceId}`, passwordData);

        this.page.setData({
            'device.passwordEnabled': true
        });
        this.page.updateDeviceSettings('passwordEnabled', true);

        wx.showToast({
            title: '密码设置成功',
            icon: 'success'
        });
    }

    // 获取已保存的密码
    getSavedPassword() {
        const passwordData = wx.getStorageSync(`password_${this.page.data.deviceId}`) || {};
        return passwordData.password || '';
    }

    // 禁用密码保护
    disablePasswordProtection() {
        wx.removeStorageSync(`password_${this.page.data.deviceId}`);

        this.page.setData({
            'device.passwordEnabled': false
        });
        this.page.updateDeviceSettings('passwordEnabled', false);

        wx.showToast({
            title: '密码保护已关闭',
            icon: 'success'
        });
    }

    // 切换密码开关
    togglePassword(e) {
        const enabled = e.detail.value;

        if (enabled) {
            this.showPasswordSetupDialog();
            this.page.setData({
                'device.passwordEnabled': false
            });
        } else {
            const savedPassword = this.getSavedPassword();
            if (savedPassword) {
                this.showPasswordDisableDialog();
                this.page.setData({
                    'device.passwordEnabled': true
                });
            } else {
                this.page.setData({
                    'device.passwordEnabled': false
                });
                this.page.updateDeviceSettings('passwordEnabled', false);
                this.page.showStatusTip('密码保护已关闭');
            }
        }
    }
}

export default PasswordManager; 