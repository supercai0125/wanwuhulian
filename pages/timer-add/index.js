Page({
    data: {
        deviceId: '',
        timerId: '',
        isEdit: false,
        isLoading: false,
        statusTip: '',
        formData: {
            name: '定时1',
            startTime: '08:00:00', // 新增时自动设置为当前时间+1分钟
            endTime: '09:00:00',   // 新增时自动设置为开始时间+5分钟
            repeatDays: [0, 1, 2, 3, 4, 5, 6] // 默认每天，确保始终是数组
        },
        // 时间选择器数据
        timePickerRange: [
            // 小时 0-23
            Array.from({ length: 24 }, (_, i) => `${i} 小时`),
            // 分钟 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 分`),
            // 秒 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 秒`)
        ],
        startTimeValue: [8, 0, 0], // 新增时自动设置为当前时间+1分钟
        endTimeValue: [9, 0, 0],    // 新增时自动设置为开始时间+5分钟
        // 重复模式
        repeatMode: 'daily', // once, daily, workdays, weekends, custom
        repeatModeDescription: '每天重复执行'
    },

    onLoad: function (options) {
        const { deviceId, timerId, edit } = options;

        this.setData({
            deviceId: deviceId,
            timerId: timerId || '',
            isEdit: edit === 'true'
        });

        // 确保数据完整性
        this.ensureDataIntegrity();

        // 如果不是编辑模式，设置默认时间为当前时间
        if (!this.data.isEdit) {
            this.setDefaultCurrentTime();
        }

        // 如果是编辑模式，加载定时数据
        if (this.data.isEdit && timerId) {
            this.loadTimerData(timerId);
        }

        // 设置导航栏标题
        wx.setNavigationBarTitle({
            title: this.data.isEdit ? '编辑定时' : '添加定时'
        });
    },

    // 确保数据完整性
    ensureDataIntegrity: function () {
        const formData = this.data.formData || {};

        // 确保formData的所有字段都存在
        const safeFormData = {
            name: formData.name || '定时1',
            startTime: formData.startTime || '08:00:00',
            endTime: formData.endTime || '09:00:00',
            repeatDays: Array.isArray(formData.repeatDays) ? formData.repeatDays : [1, 2, 3, 4, 5]
        };

        this.setData({
            formData: safeFormData
        });
    },

    // 设置默认时间为当前时间
    setDefaultCurrentTime: function () {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        // 开启时间设置为当前时间+1分钟，秒数设为0
        let startHour = currentHour;
        let startMinute = currentMinute + 1;
        const startSecond = 0;

        // 处理开始时间的分钟溢出
        if (startMinute >= 60) {
            startMinute = startMinute - 60;
            startHour = startHour + 1;

            // 处理小时溢出
            if (startHour >= 24) {
                startHour = startHour - 24;
            }
        }

        // 结束时间设置为开始时间+5分钟
        let endHour = startHour;
        let endMinute = startMinute + 5;
        const endSecond = 0;

        // 处理结束时间的分钟溢出
        if (endMinute >= 60) {
            endMinute = endMinute - 60;
            endHour = endHour + 1;

            // 处理小时溢出
            if (endHour >= 24) {
                endHour = endHour - 24;
            }
        }

        // 格式化时间字符串
        const startTime = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}:${startSecond.toString().padStart(2, '0')}`;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:${endSecond.toString().padStart(2, '0')}`;

        console.log('设置默认时间:', {
            current: `${currentHour}:${currentMinute}`,
            startTime: startTime,
            endTime: endTime
        });

        this.setData({
            'formData.startTime': startTime,
            'formData.endTime': endTime,
            startTimeValue: [startHour, startMinute, startSecond],
            endTimeValue: [endHour, endMinute, endSecond]
        });
    },

    // 加载定时数据
    loadTimerData: function (timerId) {
        const deviceId = this.data.deviceId;
        const timerList = wx.getStorageSync(`timers_${deviceId}`) || [];
        const timer = timerList.find(t => t.id === timerId);

        if (timer) {
            // 解析时间字符串为选择器值
            const startTimeArray = this.parseTimeString(timer.startTime);
            const endTimeArray = this.parseTimeString(timer.endTime);

            // 识别重复模式
            const repeatMode = this.identifyRepeatMode(timer.repeatDays);
            const description = this.getRepeatModeDescription(repeatMode, timer.repeatDays);

            this.setData({
                formData: {
                    name: timer.name,
                    startTime: timer.startTime,
                    endTime: timer.endTime,
                    repeatDays: timer.repeatDays
                },
                startTimeValue: startTimeArray,
                endTimeValue: endTimeArray,
                repeatMode: repeatMode,
                repeatModeDescription: description
            });
        }
    },

    // 解析时间字符串 "08:00:00" 为数组 [8, 0, 0]
    parseTimeString: function (timeString) {
        if (!timeString || typeof timeString !== 'string') {
            return [0, 0, 0];
        }
        const parts = timeString.split(':');
        return [
            parseInt(parts[0]) || 0,
            parseInt(parts[1]) || 0,
            parseInt(parts[2]) || 0
        ];
    },

    // 将选择器值转换为时间字符串
    formatTimeFromArray: function (timeArray) {
        if (!timeArray || !Array.isArray(timeArray) || timeArray.length < 3) {
            return '00:00:00';
        }
        const [hour, minute, second] = timeArray;
        return `${(hour || 0).toString().padStart(2, '0')}:${(minute || 0).toString().padStart(2, '0')}:${(second || 0).toString().padStart(2, '0')}`;
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

    // 开始时间选择回调
    onStartTimeChange: function (e) {
        if (!e || !e.detail || !e.detail.value) {
            return;
        }
        const timeArray = e.detail.value;
        const timeString = this.formatTimeFromArray(timeArray);

        this.setData({
            startTimeValue: timeArray,
            'formData.startTime': timeString
        });
    },

    // 结束时间选择回调
    onEndTimeChange: function (e) {
        if (!e || !e.detail || !e.detail.value) {
            return;
        }
        const timeArray = e.detail.value;
        const timeString = this.formatTimeFromArray(timeArray);

        this.setData({
            endTimeValue: timeArray,
            'formData.endTime': timeString
        });
    },

    // 切换星期选择
    toggleDay: function (e) {
        if (!e || !e.currentTarget || !e.currentTarget.dataset) {
            return;
        }
        const day = parseInt(e.currentTarget.dataset.day);
        if (isNaN(day)) {
            return;
        }
        // 确保repeatDays是一个数组，防止undefined错误
        let repeatDays = [...(this.data.formData.repeatDays || [])];

        const index = repeatDays.indexOf(day);
        if (index > -1) {
            // 已选中，移除
            repeatDays.splice(index, 1);
        } else {
            // 未选中，添加
            repeatDays.push(day);
        }

        // 排序
        repeatDays.sort((a, b) => a - b);

        this.setData({
            'formData.repeatDays': repeatDays
        });

        // 更新重复模式描述
        this.updateRepeatDescription();
    },

    // 设置重复模式
    setRepeatMode: function (e) {
        if (!e || !e.currentTarget || !e.currentTarget.dataset) {
            return;
        }
        const mode = e.currentTarget.dataset.mode;
        if (!mode) {
            return;
        }
        let repeatDays = [];
        let description = '';

        switch (mode) {
            case 'daily':
                repeatDays = [0, 1, 2, 3, 4, 5, 6];
                description = '每天重复执行';
                break;
            case 'workdays':
                repeatDays = [1, 2, 3, 4, 5];
                description = '周一至周五重复执行';
                break;
            case 'weekends':
                repeatDays = [0, 6];
                description = '周六、周日重复执行';
                break;
            case 'custom':
                // 保持当前选择，但确保至少选择一天
                repeatDays = [...(this.data.formData.repeatDays || [])];
                if (repeatDays.length === 0) {
                    // 如果没有选择任何天，默认选择每天
                    repeatDays = [0, 1, 2, 3, 4, 5, 6];
                }
                description = this.getCustomDescription(repeatDays);
                break;
        }

        this.setData({
            repeatMode: mode,
            'formData.repeatDays': repeatDays,
            repeatModeDescription: description
        });
    },

    // 更新重复模式描述
    updateRepeatDescription: function () {
        if (this.data.repeatMode === 'custom') {
            const description = this.getCustomDescription(this.data.formData.repeatDays || []);
            this.setData({
                repeatModeDescription: description
            });
        }
    },

    // 获取自定义模式描述
    getCustomDescription: function (repeatDays) {
        // 确保repeatDays是一个数组
        if (!repeatDays || !Array.isArray(repeatDays) || repeatDays.length === 0) {
            return '请选择重复日期';
        }

        const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const selectedDays = repeatDays.map(day => dayNames[day]);

        // 检查是否为工作日
        if (repeatDays.length === 5 && repeatDays.every(day => [1, 2, 3, 4, 5].includes(day))) {
            return '工作日重复执行';
        }

        // 检查是否为周末
        if (repeatDays.length === 2 && repeatDays.every(day => [0, 6].includes(day))) {
            return '周末重复执行';
        }

        // 检查是否为每天
        if (repeatDays.length === 7) {
            return '每天重复执行';
        }

        return selectedDays.join('、') + ' 重复执行';
    },

    // 验证表单
    validateForm: function () {
        const { startTime, endTime, repeatDays } = this.data.formData;

        if (!startTime || !endTime) {
            this.showStatusTip('请设置开启和关闭时间');
            return false;
        }

        // 检查时间逻辑
        if (startTime >= endTime) {
            this.showStatusTip('开启时间应早于关闭时间');
            return false;
        }

        // 分组定时必须选择重复日期
        if (!repeatDays || repeatDays.length === 0) {
            this.showStatusTip('分组定时必须选择重复日期');
            return false;
        }

        return true;
    },

    // 保存定时
    saveTimer: function () {
        if (!this.validateForm()) {
            return;
        }

        const deviceId = this.data.deviceId;
        const timerId = this.data.timerId;
        const isEdit = this.data.isEdit;

        // 创建定时对象，确保数据格式正确
        const timer = {
            id: timerId || this.generateTimerId(),
            name: this.generateTimerName(),
            startTime: this.data.formData.startTime || '08:00:00',
            endTime: this.data.formData.endTime || '09:00:00',
            repeatDays: Array.isArray(this.data.formData.repeatDays) ? this.data.formData.repeatDays : [0, 1, 2, 3, 4, 5, 6],
            createdAt: new Date().getTime(),
            updatedAt: new Date().getTime()
        };

        // 获取现有定时列表
        let timerList = wx.getStorageSync(`timers_${deviceId}`) || [];

        if (isEdit) {
            // 编辑模式：更新现有定时
            const index = timerList.findIndex(t => t.id === timerId);
            if (index > -1) {
                timerList[index] = { ...timerList[index], ...timer };
            }
        } else {
            // 添加模式：新增定时
            timerList.push(timer);
        }

        // 保存到存储
        wx.setStorageSync(`timers_${deviceId}`, timerList);

        this.showStatusTip(isEdit ? '定时已更新' : '定时已添加');

        // 延迟返回上一页
        setTimeout(() => {
            wx.navigateBack();
        }, 1500);
    },

    // 生成定时ID
    generateTimerId: function () {
        return 'timer_' + new Date().getTime() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // 生成定时名称
    generateTimerName: function () {
        const deviceId = this.data.deviceId;
        const timerList = wx.getStorageSync(`timers_${deviceId}`) || [];
        const count = timerList.length + 1;
        return `定时${count}`;
    },

    // 识别重复模式
    identifyRepeatMode: function (repeatDays) {
        // 分组定时不支持单次模式，如果没有重复日期，默认为每天
        if (!repeatDays || !Array.isArray(repeatDays) || repeatDays.length === 0) {
            return 'daily';
        }

        // 检查是否为每天
        if (repeatDays.length === 7) {
            return 'daily';
        }

        // 检查是否为工作日
        if (repeatDays.length === 5 && repeatDays.every(day => [1, 2, 3, 4, 5].includes(day))) {
            return 'workdays';
        }

        // 检查是否为周末
        if (repeatDays.length === 2 && repeatDays.every(day => [0, 6].includes(day))) {
            return 'weekends';
        }

        return 'custom';
    },

    // 获取重复模式描述
    getRepeatModeDescription: function (mode, repeatDays) {
        switch (mode) {
            case 'daily':
                return '每天重复执行';
            case 'workdays':
                return '周一至周五重复执行';
            case 'weekends':
                return '周六、周日重复执行';
            case 'custom':
                return this.getCustomDescription(repeatDays);
            default:
                return '每天重复执行'; // 默认每天
        }
    },
}) 