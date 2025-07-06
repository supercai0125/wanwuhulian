// 定时列表管理页面 - 不包含发送功能

Page({
    data: {
        deviceId: '',
        statusTip: '',
        timerList: []
    },

    onLoad: function (options) {
        const deviceId = options.deviceId;
        this.setData({
            deviceId: deviceId
        });

        this.loadTimers();
    },

    onShow: function () {
        // 页面显示时刷新定时列表
        this.loadTimers();
    },

    // 加载定时列表
    loadTimers: function () {
        const deviceId = this.data.deviceId;
        const timerList = wx.getStorageSync(`timers_${deviceId}`) || [];

        // 格式化重复时间显示
        const formattedList = timerList.map(timer => {
            return {
                ...timer,
                repeatText: this.formatRepeatText(timer.repeatDays)
            };
        });

        this.setData({
            timerList: formattedList
        });
    },

    // 格式化重复时间文本
    formatRepeatText: function (repeatDays) {
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

        // 分组定时不支持单次，如果没有重复日期，显示错误状态
        if (repeatDays.length === 0) {
            return '配置错误';
        }

        if (repeatDays.length === 7) {
            return '每天';
        }

        if (repeatDays.length === 5 &&
            repeatDays.includes(1) && repeatDays.includes(2) &&
            repeatDays.includes(3) && repeatDays.includes(4) &&
            repeatDays.includes(5)) {
            return '工作日';
        }

        if (repeatDays.length === 2 &&
            repeatDays.includes(0) && repeatDays.includes(6)) {
            return '周末';
        }

        return repeatDays.map(day => `周${dayNames[day]}`).join(' ');
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

    // 添加定时
    addTimer: function () {
        wx.navigateTo({
            url: `/pages/timer-add/index?deviceId=${this.data.deviceId}`
        });
    },

    // 编辑定时
    editTimer: function (e) {
        const index = e.currentTarget.dataset.index;
        const timer = this.data.timerList[index];

        wx.navigateTo({
            url: `/pages/timer-add/index?deviceId=${this.data.deviceId}&timerId=${timer.id}&edit=true`
        });
    },

    // 删除定时
    deleteTimer: function (e) {
        const index = e.currentTarget.dataset.index;
        const timer = this.data.timerList[index];

        wx.showModal({
            title: '删除确认',
            content: '是否要删除此定时？',
            confirmText: '确定',
            cancelText: '取消',
            success: (res) => {
                if (res.confirm) {
                    this.performDeleteTimer(index);
                }
            }
        });
    },

    // 执行删除定时
    performDeleteTimer: function (index) {
        const deviceId = this.data.deviceId;
        let timerList = wx.getStorageSync(`timers_${deviceId}`) || [];

        // 删除指定索引的定时
        timerList.splice(index, 1);

        // 保存到存储
        wx.setStorageSync(`timers_${deviceId}`, timerList);

        // 刷新列表
        this.loadTimers();

        this.showStatusTip('定时已删除');
    },

    // 保存并返回首页
    saveAndReturn: function () {
        wx.showToast({
            title: '分组定时已保存',
            icon: 'success'
        });

        // 延迟返回，让用户看到保存成功的提示
        setTimeout(() => {
            wx.navigateBack();
        }, 1500);
    }
}) 