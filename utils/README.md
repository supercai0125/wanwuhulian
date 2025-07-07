# Utils 工具目录说明

## 📁 目录结构

```
utils/
├── README.md                 # 本说明文档
├── BLEUtil.js               # 蓝牙功能统一入口（向后兼容）
├── config.js                # 全局配置文件
├── passwordUtil.js          # 密码验证工具
├── util.js                  # 通用工具函数
├── crc16.js                 # CRC16校验算法
├── whitening.js             # 数据白化算法
└── ble/                     # 蓝牙功能模块化实现
    ├── index.js             # 蓝牙功能统一导出
    ├── common.js            # 蓝牙通用方法
    ├── core.js              # 蓝牙核心发送功能
    ├── switch.js            # 开关控制命令
    ├── countdown.js         # 倒计时命令
    ├── groupTimer.js        # 分组定时命令
    ├── loopTimer.js         # 循环定时命令
    ├── sunsetTimer.js       # 日落定时命令
    └── timeSync.js          # 时间同步命令
```

## 🔧 主要模块功能

### 1. BLEUtil.js - 蓝牙功能入口
**功能：** 蓝牙功能统一入口，重新导出模块化结构以保持向后兼容
**使用场景：** 所有需要蓝牙功能的页面
**主要方法：**
- `sendTimerSwitchCommand()` - 发送时控开关命令
- `sendSwitchCommand()` - 发送开关命令
- `sendCountdownCommand()` - 发送倒计时命令
- `sendGroupTimerCommand()` - 发送分组定时命令
- `sendLoopTimerCommand()` - 发送循环定时命令
- `sendSunsetTimerCommand()` - 发送日落定时命令
- `sendTimeSyncCommand()` - 发送时间同步命令

### 2. config.js - 全局配置
**功能：** 集中管理所有超时时间、延迟时间等配置
**使用场景：** 需要使用配置常量的地方
**主要配置：**
- `BLUETOOTH_CONFIG` - 蓝牙相关时间配置
- `UI_CONFIG` - 用户界面相关时间配置
- `DEVICE_CONFIG` - 设备检测相关时间配置
- `COMMAND_CONFIG` - 命令相关配置
- `PASSWORD_CONFIG` - 密码相关配置

### 3. passwordUtil.js - 密码验证工具
**功能：** 设备密码保护和权限验证
**使用场景：** 需要密码验证的设备操作
**主要方法：**
- `checkControlPermission()` - 检查设备控制权限
- `checkBatchOperationPermission()` - 检查批量操作权限
- `showPasswordDialog()` - 显示密码输入对话框

### 4. ble/ 目录 - 蓝牙功能模块化实现
**功能：** 按功能模块化组织的蓝牙命令实现
**设计原则：** 每个文件负责一类特定的蓝牙命令

#### 4.1 core.js - 蓝牙核心功能
- 蓝牙适配器管理
- iOS/Android 平台适配
- 设备回复监听
- 广播发送核心逻辑

#### 4.2 switch.js - 开关控制
- 设备开关命令生成
- 设备匹配命令
- 广播发送（用于设备扫描）

#### 4.3 countdown.js - 倒计时功能
- 倒计时命令生成
- 支持设置倒计时时间和结束动作

#### 4.4 groupTimer.js - 分组定时
- 分组定时命令生成
- 支持星期设置和时间段控制

#### 4.5 loopTimer.js - 循环定时
- 循环定时命令生成
- 支持开启/关闭时长设置

#### 4.6 sunsetTimer.js - 日落定时
- 日落定时命令生成
- 支持特定星期和时间设置

#### 4.7 timeSync.js - 时间同步
- 时间同步命令生成
- 自动获取系统时间进行同步

### 5. 底层算法模块

#### 5.1 crc16.js - CRC16校验
**功能：** CRC16校验算法实现
**使用场景：** 蓝牙数据包校验

#### 5.2 whitening.js - 数据白化
**功能：** 数据白化算法实现
**使用场景：** 蓝牙数据编码

#### 5.3 util.js - 通用工具
**功能：** 通用工具函数集合
**主要方法：**
- `formatTime()` - 时间格式化
- `ab2hex()` - ArrayBuffer转十六进制
- `str2Bytes()` - 字符串转字节
- `hex2int()` - 十六进制转十进制

## 📖 使用示例

### 发送开关命令
```javascript
import { sendSwitchCommand } from '../../utils/BLEUtil'

// 开启设备
sendSwitchCommand(true, 
  () => console.log('开启成功'), 
  (err) => console.error('开启失败', err)
)
```

### 发送倒计时命令
```javascript
import { sendCountdownCommand } from '../../utils/ble/countdown.js'

const countdownData = {
  action: 'off',  // 倒计时结束后关闭
  hours: 1,
  minutes: 30,
  seconds: 0
}

sendCountdownCommand(countdownData, 
  () => console.log('倒计时设置成功'), 
  (err) => console.error('倒计时设置失败', err)
)
```

### 密码验证
```javascript
import { checkControlPermission } from '../../utils/passwordUtil'

checkControlPermission(deviceId, '设备开关')
  .then(() => {
    // 验证成功，执行设备控制
  })
  .catch(err => {
    // 验证失败或用户取消
  })
```

## 🔄 导入路径规范

### 推荐使用方式
```javascript
// 主入口（推荐，向后兼容）
import { sendSwitchCommand } from '../../utils/BLEUtil'

// 直接使用特定模块（更清晰）
import { sendCountdownCommand } from '../../utils/ble/countdown.js'

// 配置使用
import { BLUETOOTH_CONFIG, UI_CONFIG } from '../../utils/config'

// 密码验证
import { checkControlPermission } from '../../utils/passwordUtil'
```

## 📝 维护说明

1. **添加新的蓝牙功能**：在 `ble/` 目录下创建新文件，并在 `ble/index.js` 中导出
2. **修改配置**：统一在 `config.js` 中修改，避免硬编码
3. **向后兼容**：`BLEUtil.js` 作为主入口，保持向后兼容性
4. **文档更新**：添加新功能时同步更新本文档

## 🗑️ 待清理文件

- `.DS_Store` - 系统文件，应删除
- 检查 `util.js` 是否还在使用，如未使用可考虑删除或整合 