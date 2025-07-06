const { sendLoopTimerCommand } = require('../../utils/BLEUtil.js')

Page({
    data: {
        startDuration: '00:00:00',
        endDuration: '00:00:00',
        isLoading: false,
        // 时间选择器数据
        timePickerRange: [
            // 小时 0-23
            Array.from({ length: 24 }, (_, i) => `${i} 小时`),
            // 分钟 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 分`),
            // 秒 0-59
            Array.from({ length: 60 }, (_, i) => `${i} 秒`)
        ],
        startTimeValue: [0, 0, 0], // 默认00:00:00
        endTimeValue: [0, 0, 0]    // 默认00:00:00
    },

    onLoad() {
        // 获取当前循环定时设置
        const loopTimerData = wx.getStorageSync('loopTimerData')
        if (loopTimerData) {
            const startDuration = loopTimerData.startDuration || '00:00:00'
            const endDuration = loopTimerData.endDuration || '00:00:00'

            // 解析时间字符串为选择器值
            const startTimeArray = this.parseTimeString(startDuration)
            const endTimeArray = this.parseTimeString(endDuration)

            this.setData({
                startDuration,
                endDuration,
                startTimeValue: startTimeArray,
                endTimeValue: endTimeArray
            })
        }
    },

    // 解析时间字符串 "08:00:00" 为数组 [8, 0, 0]
    parseTimeString(timeString) {
        const parts = timeString.split(':')
        return [
            parseInt(parts[0]) || 0,
            parseInt(parts[1]) || 0,
            parseInt(parts[2]) || 0
        ]
    },

    // 将选择器值转换为时间字符串
    formatTimeFromArray(timeArray) {
        const [hour, minute, second] = timeArray
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
    },

    // 开启时长选择回调
    onStartTimeChange(e) {
        const timeArray = e.detail.value
        const timeString = this.formatTimeFromArray(timeArray)

        console.log('开启时长选择:', {
            timeArray: timeArray,
            timeString: timeString
        });

        this.setData({
            startTimeValue: timeArray,
            startDuration: timeString
        })
    },

    // 关闭时长选择回调
    onEndTimeChange(e) {
        const timeArray = e.detail.value
        const timeString = this.formatTimeFromArray(timeArray)

        console.log('关闭时长选择:', {
            timeArray: timeArray,
            timeString: timeString
        });

        this.setData({
            endTimeValue: timeArray,
            endDuration: timeString
        })
    },

    // 保存循环定时设置（仅保存，不发送）
    saveLoopTimer() {
        const { startDuration, endDuration } = this.data

        console.log('保存循环定时设置:', {
            startDuration: startDuration,
            endDuration: endDuration,
            startTimeValue: this.data.startTimeValue,
            endTimeValue: this.data.endTimeValue
        });

        // 验证时间设置
        if (startDuration === '00:00:00' && endDuration === '00:00:00') {
            wx.showToast({
                title: '请至少设置开启时长或关闭时长',
                icon: 'none'
            })
            return
        }

        const loopTimerData = {
            startDuration,
            endDuration,
            // 添加更多调试信息
            startTimeValue: this.data.startTimeValue,
            endTimeValue: this.data.endTimeValue,
            updateTime: new Date().getTime()
        }

        wx.setStorageSync('loopTimerData', loopTimerData)
        console.log('循环定时数据已保存到存储:', loopTimerData);

        wx.showToast({
            title: '循环定时设置已保存',
            icon: 'success'
        })

        // 返回上一页
        setTimeout(() => {
            wx.navigateBack()
        }, 1500)
    }
}) 