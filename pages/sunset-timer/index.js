import { sendSunsetTimerCommand } from '../../utils/ble/sunsetTimer.js'

Page({
    data: {
        latitude: null,
        longitude: null,
        locationName: '',
        sunsetTime: '18:00:00',
        manualSunsetTime: '18:00:00',
        sunriseTime: '06:00:00',
        manualSunriseTime: '06:00:00',
        isManualMode: false,
        isLoading: false,
        locationLoading: false,
        weekDay: 0, // 默认每天执行，不需要用户选择
        statusTip: '', // 状态提示
        displayTime: '18:00', // 显示的日落时间
        displaySunriseTime: '06:00', // 显示的日出时间
        executeMode: 1 // 执行模式: 1=白天开晚上关, 2=白天关晚上开
    },

    onLoad() {
        console.log('页面加载，初始数据:', this.data)

        // 获取当前日落定时设置
        const sunsetTimerData = wx.getStorageSync('sunsetTimerData')
        console.log('存储的日落定时数据:', sunsetTimerData)

        if (sunsetTimerData) {
            this.setData({
                sunsetTime: sunsetTimerData.sunsetTime || '18:00:00',
                manualSunsetTime: sunsetTimerData.manualSunsetTime || '18:00:00',
                sunriseTime: sunsetTimerData.sunriseTime || '06:00:00',
                manualSunriseTime: sunsetTimerData.manualSunriseTime || '06:00:00',
                isManualMode: sunsetTimerData.isManualMode || false,
                weekDay: sunsetTimerData.weekDay || 0,
                latitude: sunsetTimerData.latitude,
                longitude: sunsetTimerData.longitude,
                locationName: sunsetTimerData.locationName || '',
                executeMode: sunsetTimerData.executeMode || 1
            })
            console.log('设置后的数据:', this.data)
        }

        // 更新显示时间
        this.updateDisplayTime()

        // 自动获取位置信息
        this.getCurrentLocation()
    },

    // 更新显示时间
    updateDisplayTime() {
        const currentTime = this.data.isManualMode ? this.data.manualSunsetTime : this.data.sunsetTime
        const displayTime = currentTime ? currentTime.substring(0, 5) : '18:00'

        const currentSunriseTime = this.data.isManualMode ? this.data.manualSunriseTime : this.data.sunriseTime
        const displaySunriseTime = currentSunriseTime ? currentSunriseTime.substring(0, 5) : '06:00'

        this.setData({
            displayTime,
            displaySunriseTime
        })
    },

    // 获取当前位置
    getCurrentLocation() {
        this.setData({ locationLoading: true })

        // 先检查位置权限
        wx.getSetting({
            success: (res) => {
                if (res.authSetting['scope.userLocation'] === false) {
                    // 用户拒绝了位置权限，引导用户开启
                    this.setData({ locationLoading: false })
                    wx.showModal({
                        title: '需要位置权限',
                        content: '为了计算准确的日落时间，需要获取您的位置信息。请在设置中开启位置权限。',
                        confirmText: '去设置',
                        success: (modalRes) => {
                            if (modalRes.confirm) {
                                wx.openSetting({
                                    success: (settingRes) => {
                                        if (settingRes.authSetting['scope.userLocation']) {
                                            // 用户开启了权限，重新获取位置
                                            this.getCurrentLocation()
                                        }
                                    }
                                })
                            }
                        }
                    })
                    return
                }

                // 获取位置
                wx.getLocation({
                    type: 'gcj02',
                    success: (res) => {
                        console.log('获取位置成功:', res)
                        this.setData({
                            latitude: res.latitude,
                            longitude: res.longitude,
                            locationLoading: false
                        })

                        // 获取地址信息
                        this.getLocationName(res.latitude, res.longitude)

                        // 计算日落时间
                        this.calculateSunsetTime(res.latitude, res.longitude)

                        this.showStatusTip('位置获取成功，正在计算日落时间...')
                    },
                    fail: (err) => {
                        console.error('获取位置失败:', err)
                        this.setData({
                            locationLoading: false,
                            sunsetTime: '18:00:00' // 设置默认值
                        })
                        this.updateDisplayTime()

                        let errorMsg = '无法获取当前位置'
                        if (err.errCode === 1) {
                            errorMsg = '位置权限被拒绝，请在设置中开启位置权限'
                        } else if (err.errCode === 2) {
                            errorMsg = '网络异常，请检查网络连接'
                        } else if (err.errCode === 3) {
                            errorMsg = '定位超时，请重试'
                        }

                        wx.showModal({
                            title: '位置获取失败',
                            content: errorMsg + '，将使用默认日落时间18:00',
                            confirmText: '确定',
                            showCancel: false
                        })
                    }
                })
            },
            fail: () => {
                this.setData({
                    locationLoading: false,
                    sunsetTime: '18:00:00' // 设置默认值
                })
                this.updateDisplayTime()
                wx.showToast({
                    title: '获取权限状态失败',
                    icon: 'none'
                })
            }
        })
    },

    // 获取地址名称
    getLocationName(latitude, longitude) {
        // 使用腾讯地图逆地理编码API
        wx.request({
            url: 'https://apis.map.qq.com/ws/geocoder/v1/',
            data: {
                location: `${latitude},${longitude}`,
                key: 'OQRBZ-KBHKX-XLI4F-JBQO6-QKJQT-QKBQP', // 需要替换为您的腾讯地图API密钥
                get_poi: 0
            },
            success: (res) => {
                if (res.data.status === 0 && res.data.result) {
                    const address = res.data.result.address
                    const components = res.data.result.address_component

                    // 构建简洁的地址显示
                    let locationName = ''
                    if (components.city && components.district) {
                        locationName = `${components.city}${components.district}`
                    } else if (components.province && components.city) {
                        locationName = `${components.province}${components.city}`
                    } else {
                        locationName = address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                    }

                    this.setData({ locationName })
                    console.log('地址解析成功:', locationName)
                } else {
                    console.log('地址解析失败，使用坐标显示')
                    this.setData({
                        locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                    })
                }
            },
            fail: (err) => {
                console.error('地址解析请求失败:', err)
                this.setData({
                    locationName: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                })
            }
        })
    },

    // 计算日出日落时间
    calculateSunsetTime(latitude, longitude) {
        try {
            const times = this.getSunTimes(latitude, longitude)
            console.log('计算出的日出日落时间:', times)
            this.setData({
                sunsetTime: times.sunset,
                sunriseTime: times.sunrise
            })
            this.updateDisplayTime()
            console.log('更新后的页面数据:', this.data)
            this.showStatusTip(`日出时间: ${times.sunrise.substring(0, 5)}, 日落时间: ${times.sunset.substring(0, 5)}`)
        } catch (error) {
            console.error('计算日出日落时间失败:', error)
            this.setData({
                sunsetTime: '18:00:00',
                sunriseTime: '06:00:00'
            })
            this.updateDisplayTime()
            this.showStatusTip('时间计算失败，使用默认时间')
        }
    },

    // 计算日出日落时间
    getSunTimes(latitude, longitude) {
        const now = new Date()
        console.log('计算参数:', { latitude, longitude, date: now.toDateString() })

        try {
            // 计算一年中的第几天
            const dayOfYear = this.getDayOfYear(now)

            // 计算太阳赤纬角（弧度）
            const declination = -23.45 * Math.cos(2 * Math.PI * (dayOfYear + 10) / 365) * Math.PI / 180

            // 计算纬度弧度
            const latRad = latitude * Math.PI / 180

            // 计算时角
            const cosHourAngle = -Math.tan(latRad) * Math.tan(declination)

            // 检查极昼极夜情况
            if (cosHourAngle < -1) {
                console.log('极昼情况，使用默认时间')
                return { sunrise: '06:00:00', sunset: '18:00:00' }
            }
            if (cosHourAngle > 1) {
                console.log('极夜情况，使用默认时间')
                return { sunrise: '06:00:00', sunset: '18:00:00' }
            }

            // 计算时角（弧度转小时）
            const hourAngle = Math.acos(cosHourAngle) * 12 / Math.PI

            // 计算经度偏移
            const longitudeOffset = (longitude - 120) / 15

                        // 计算当地日出时间（加1小时时区修正）
            const sunriseLocal = 12 - hourAngle + longitudeOffset + 1
            
            // 计算当地日落时间（加1小时时区修正）
            const sunsetLocal = 12 + hourAngle + longitudeOffset + 1

            // 格式化时间
            const formatTime = (time) => {
                let finalTime = time
                while (finalTime < 0) finalTime += 24
                while (finalTime >= 24) finalTime -= 24

                const hour = Math.floor(finalTime)
                const minute = Math.floor((finalTime - hour) * 60)
                const second = Math.floor(((finalTime - hour) * 60 - minute) * 60)

                return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}`
            }

            const sunrise = formatTime(sunriseLocal)
            const sunset = formatTime(sunsetLocal)

            console.log('计算过程:', {
                dayOfYear,
                declination: declination * 180 / Math.PI,
                hourAngle: hourAngle.toFixed(2),
                longitudeOffset: longitudeOffset.toFixed(2),
                sunriseLocal: sunriseLocal.toFixed(2),
                sunsetLocal: sunsetLocal.toFixed(2),
                sunrise,
                sunset
            })
            
            console.log('时间修正说明: 已添加1小时时区修正')

            return { sunrise, sunset }
        } catch (error) {
            console.error('计算过程出错:', error)
            return { sunrise: '06:00:00', sunset: '18:00:00' }
        }
    },



    // 获取一年中的第几天
    getDayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0)
        const diff = date - start
        return Math.floor(diff / (1000 * 60 * 60 * 24))
    },

    // 设置自动模式
    setAutoMode() {
        if (!this.data.isManualMode) return // 已经是自动模式

        this.setData({ isManualMode: false })
        this.updateDisplayTime()
        this.showStatusTip('已切换到自动计算模式，日出日落时间将自动计算')

        // 如果有位置信息，重新计算日出日落时间
        if (this.data.latitude && this.data.longitude) {
            this.calculateSunsetTime(this.data.latitude, this.data.longitude)
        }
    },

    // 设置手动模式
    setManualMode() {
        if (this.data.isManualMode) return // 已经是手动模式

        this.setData({ isManualMode: true })
        this.updateDisplayTime()
        this.showStatusTip('已切换到手动设置模式，可自定义日出日落时间')
    },

    // 选择手动日落时间
    onManualTimeChange(e) {
        this.setData({
            manualSunsetTime: e.detail.value + ':00'
        })
        this.updateDisplayTime()
    },

    // 重新获取位置
    refreshLocation() {
        this.getCurrentLocation()
    },

    // 显示状态提示
    showStatusTip(message) {
        this.setData({
            statusTip: message
        })
        setTimeout(() => {
            this.setData({
                statusTip: ''
            })
        }, 2000)
    },

    // 设置执行模式
    setExecuteMode(e) {
        const mode = parseInt(e.currentTarget.dataset.mode)
        this.setData({
            executeMode: mode
        })

        const modeText = mode === 1 ? '白天开，晚上关' : '白天关，晚上开'
        this.showStatusTip(`已切换到${modeText}模式`)
    },



    // 手动设置日出时间
    onManualSunriseTimeChange(e) {
        const time = e.detail.value + ':00'
        this.setData({
            manualSunriseTime: time
        })
        this.updateDisplayTime()
        this.showStatusTip(`日出时间已设置为 ${e.detail.value}`)
    },

    // 保存日落定时设置
    saveSunsetTimer() {
        const { latitude, longitude, locationName, sunsetTime, manualSunsetTime, sunriseTime, manualSunriseTime, isManualMode, weekDay, executeMode } = this.data

        const finalSunsetTime = isManualMode ? manualSunsetTime : sunsetTime
        const finalSunriseTime = isManualMode ? manualSunriseTime : sunriseTime

        const sunsetTimerData = {
            latitude,
            longitude,
            locationName,
            sunsetTime,
            manualSunsetTime,
            sunriseTime,
            manualSunriseTime,
            isManualMode,
            weekDay,
            finalSunsetTime,
            finalSunriseTime,
            executeMode
        }

        wx.setStorageSync('sunsetTimerData', sunsetTimerData)

        this.showStatusTip('日落定时设置已保存')

        // 返回上一页
        setTimeout(() => {
            wx.navigateBack()
        }, 1500)
    }
}) 