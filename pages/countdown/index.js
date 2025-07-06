// 导入BLE工具
import { sendCountdownCommand } from '../../utils/ble/countdown.js';

Page({
    data: {
        deviceId: '',
        returnTo: '',
        isLoading: false,
        statusTip: '',
        isCountingDown: false,
        // 时间选择器数据
        timePickerRange: [
            // 小时 0-23
            Array.from({ length: 24 }, (_, i) => `${i} 小时`),
            // 分钟 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 分`),
            // 秒 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 秒`)
        ],
        timeValue: [0, 0, 10], // 默认10秒
        formattedTime: '00:00:10',
        displayTime: '00:00:10',
        // 执行操作选项 - 只保留开启和关闭
        actionOptions: ['开启', '关闭'],
        actionIndex: 0,
        // 倒计时相关
        totalSeconds: 10,
        remainingSeconds: 10,
        countdownTimer: null
    },

    onLoad: function (options) {
        const { deviceId, returnTo } = options;

        this.setData({
            deviceId: deviceId || '',
            returnTo: returnTo || ''
        });

        // 恢复之前保存的设置
        if (deviceId) {
            const savedSettings = wx.getStorageSync(`countdown_settings_${deviceId}`) || {};
            if (savedSettings.actionIndex !== undefined) {
                this.setData({
                    actionIndex: savedSettings.actionIndex
                });
            }
            if (savedSettings.timeValue) {
                const totalSeconds = savedSettings.timeValue[0] * 3600 + savedSettings.timeValue[1] * 60 + savedSettings.timeValue[2];
                this.setData({
                    timeValue: savedSettings.timeValue,
                    totalSeconds: totalSeconds,
                    remainingSeconds: totalSeconds
                });
            }
        }

        this.updateFormattedTime();
    },

    onUnload: function () {
        // 页面卸载时清除定时器
        if (this.data.countdownTimer) {
            clearInterval(this.data.countdownTimer);
        }
    },

    // 显示状态提示
    showStatusTip: function (tip) {
        this.setData({
            statusTip: tip
        });

        setTimeout(() => {
            this.setData({
                statusTip: ''
            });
        }, 2000);
    },

    // 时间选择回调
    onTimeChange: function (e) {
        const timeArray = e.detail.value;
        const [hours, minutes, seconds] = timeArray;
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        this.setData({
            timeValue: timeArray,
            totalSeconds: totalSeconds,
            remainingSeconds: totalSeconds
        });

        this.updateFormattedTime();
    },

    // 执行操作选择回调
    onActionChange: function (e) {
        const index = parseInt(e.detail.value);
        this.setData({
            actionIndex: index
        });

        // 保存用户选择到本地存储
        if (this.data.deviceId) {
            const savedSettings = wx.getStorageSync(`countdown_settings_${this.data.deviceId}`) || {};
            savedSettings.actionIndex = index;
            wx.setStorageSync(`countdown_settings_${this.data.deviceId}`, savedSettings);
        }
    },

    // 更新格式化时间显示
    updateFormattedTime: function () {
        const [hours, minutes, seconds] = this.data.timeValue;
        const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        this.setData({
            formattedTime: formatted,
            displayTime: formatted
        });
    },

    // 格式化秒数为 HH:MM:SS
    formatSecondsToTime: function (totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    // 开始倒计时
    startCountdown: function () {
        if (this.data.totalSeconds <= 0) {
            this.showStatusTip('请设置倒计时时间');
            return;
        }

        this.setData({
            isCountingDown: true,
            remainingSeconds: this.data.totalSeconds
        });

        // 开始倒计时
        const timer = setInterval(() => {
            let remaining = this.data.remainingSeconds - 1;

            if (remaining <= 0) {
                // 倒计时结束
                clearInterval(timer);
                this.onCountdownFinished();
                return;
            }

            this.setData({
                remainingSeconds: remaining,
                displayTime: this.formatSecondsToTime(remaining)
            });
        }, 1000);

        this.setData({
            countdownTimer: timer
        });

        this.showStatusTip('倒计时开始');
    },

    // 停止倒计时
    stopCountdown: function () {
        if (this.data.countdownTimer) {
            clearInterval(this.data.countdownTimer);
        }

        this.setData({
            isCountingDown: false,
            countdownTimer: null,
            remainingSeconds: this.data.totalSeconds
        });

        this.updateFormattedTime();
        this.showStatusTip('倒计时已停止');
    },

    // 倒计时结束处理
    onCountdownFinished: function () {
        this.setData({
            isCountingDown: false,
            countdownTimer: null,
            remainingSeconds: this.data.totalSeconds,
            displayTime: '00:00:00'
        });

        // 执行操作
        const action = this.data.actionOptions[this.data.actionIndex];
        this.executeAction(action);

        // 播放提示音
        wx.vibrateShort();

        this.showStatusTip(`倒计时结束，执行操作：${action}`);

        // 重置显示时间
        setTimeout(() => {
            this.updateFormattedTime();
        }, 2000);
    },

    // 执行操作
    executeAction: function (action) {
        console.log('执行操作:', action);

        if (!this.data.deviceId) {
            console.error('设备ID不存在');
            return;
        }

        // 准备倒计时命令数据
        const countdownData = {
            action: action === '开启' ? 'on' : 'off', // 修改为正确的操作类型
            hours: 0,
            minutes: 0,
            seconds: 0 // 倒计时结束后立即执行操作
        };

        // 发送BLE命令
        sendCountdownCommand(
            countdownData,
            (result) => {
                console.log('倒计时操作命令发送成功:', result);
                wx.showToast({
                    title: `设备${action}成功`,
                    icon: 'success'
                });
            },
            (error) => {
                console.error('倒计时操作命令发送失败:', error);
                wx.showToast({
                    title: `设备${action}失败`,
                    icon: 'none'
                });
            }
        );
    },

    // 保存倒计时设置（从timer-switch页面跳转时使用）
    saveCountdownSetting: function () {
        if (this.data.totalSeconds <= 0) {
            this.showStatusTip('请设置倒计时时间');
            return;
        }

        // 计算时分秒
        const hours = Math.floor(this.data.totalSeconds / 3600);
        const minutes = Math.floor((this.data.totalSeconds % 3600) / 60);
        const seconds = this.data.totalSeconds % 60;

        const countdownTime = {
            totalSeconds: this.data.totalSeconds,
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            // 添加执行操作信息
            action: this.data.actionOptions[this.data.actionIndex], // '开启' 或 '关闭'
            actionIndex: this.data.actionIndex
        };

        // 保存设置到本地存储
        if (this.data.deviceId) {
            const savedSettings = {
                timeValue: this.data.timeValue,
                actionIndex: this.data.actionIndex
            };
            wx.setStorageSync(`countdown_settings_${this.data.deviceId}`, savedSettings);
        }

        // 保存到设备数据中
        if (this.data.deviceId) {
            const deviceList = wx.getStorageSync('deviceList') || [];
            const index = deviceList.findIndex(d => d.id === this.data.deviceId);

            if (index !== -1) {
                if (!deviceList[index].controller) {
                    deviceList[index].controller = {};
                }
                if (!deviceList[index].controller.timers) {
                    deviceList[index].controller.timers = {};
                }

                deviceList[index].controller.timers.countdown = countdownTime;
                wx.setStorageSync('deviceList', deviceList);
            }
        }

        // 通过页面间通信，调用时控开关页面的setCountdown函数（仅保存设置）
        const pages = getCurrentPages();
        if (pages.length >= 2) {
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.setCountdown) {
                // 调用上一页的setCountdown函数，只保存设置不发送命令
                prevPage.setCountdown(countdownTime);
            }
        }

        // 格式化显示时间
        const timeDisplay = hours > 0 ?
            `${hours}小时${minutes}分${seconds}秒` :
            minutes > 0 ?
                `${minutes}分${seconds}秒` :
                `${seconds}秒`;

        const actionText = this.data.actionOptions[this.data.actionIndex];
        this.showStatusTip(`倒计时${timeDisplay}（${actionText}）已设置，切换到倒计时模式后生效`);

        // 延迟返回上一页
        setTimeout(() => {
            wx.navigateBack();
        }, 1500);
    }
}) 