# 蓝牙功能码解析器

## 概述

功能码解析器用于从设备回复的蓝牙数据中提取功能码，并将其映射到具体的设备模式。这样可以让用户了解设备当前处于什么工作模式。

## 功能特性

- 从设备回复数据中提取滚动码和功能码
- 将功能码映射到具体的设备模式
- 提供模式的中文名称显示
- 支持所有已知的设备模式

## 支持的模式

| 功能码 | 模式 | 中文名称 | 描述 |
|--------|------|----------|------|
| 01 | off | 常关 | 设备处于常关状态 |
| 02 | on | 常开 | 设备处于常开状态 |
| 04 | countdown | 倒计时 | 设备处于倒计时模式 |
| 05 | loop | 循环定时 | 设备处于循环定时模式 |
| 06 | sunset | 日落定时 | 设备处于日落定时模式 |
| 03 | group | 分组定时 | 设备处于分组定时模式 |
| 07 | timeSync | 时间同步 | 设备正在同步时间 |
| 08 | match | 匹配 | 设备匹配命令 |

## 使用方法

### 基本解析

```javascript
import { parseDeviceReply } from './function-code-parser.js'

// 解析设备回复数据
const replyData = '123400010100000000000000'
const result = parseDeviceReply(replyData)

console.log(result)
// 输出:
// {
//   rollingCode: '1234',
//   functionCode: '01',
//   mode: 'off',
//   modeName: '常关',
//   isValid: true
// }
```

### 单独提取功能码

```javascript
import { parseFunctionCode } from './function-code-parser.js'

const hexData = '123400010100000000000000'
const functionCodeInfo = parseFunctionCode(hexData)

console.log(functionCodeInfo)
// 输出:
// {
//   functionCode: '01',
//   mode: 'off',
//   modeName: '常关',
//   isValid: true
// }
```

### 单独提取滚动码

```javascript
import { extractRollingCode } from './function-code-parser.js'

const hexData = '123400010100000000000000'
const rollingCode = extractRollingCode(hexData)

console.log(rollingCode) // '1234'
```

### 获取模式名称

```javascript
import { getModeName } from './function-code-parser.js'

const modeName = getModeName('off') // '常关'
const modeName2 = getModeName('countdown') // '倒计时'
```

## 数据格式

设备回复数据格式（13字节，26个十六进制字符）：

```
字节0-1: 滚动码 (2字节，4个十六进制字符)
字节2: 第三字节 (00 - 固定值)
字节3: 设备类型 (01 - 固定值)
字节4: 功能码 (1字节，2个十六进制字符)
字节5-12: 其他数据 (填充0)
```

## 集成到页面

### 首页设备列表

在首页的设备状态检测中，解析器会自动解析设备回复并更新设备模式信息：

```javascript
// 在 handleDeviceReply 方法中
const parsedReply = parseDeviceReply(replyData.data)
if (parsedReply && parsedReply.isValid) {
    this.updateDeviceOnlineStatus(rollingCode, parsedReply)
}
```

### 控制详情页面

在进入控制详情页面时，会自动发送状态检测命令并解析当前模式：

```javascript
// 在 sendDeviceStatusCheck 方法中
unifiedBluetoothManager.setReplyCallback((replyData) => {
    const parsedReply = parseDeviceReply(replyData.data)
    if (parsedReply && parsedReply.isValid) {
        this.updateDeviceMode(parsedReply)
    }
})
```

## 测试

运行测试文件来验证解析器功能：

```javascript
import { runTests } from './test-function-code-parser.js'
runTests()
```

## 注意事项

1. 确保设备回复数据格式正确（13字节）
2. 功能码解析依赖于设备协议的一致性
3. 未知功能码会被标记为无效
4. 解析失败时会返回 null 或默认值

## 更新日志

- v1.0.0: 初始版本，支持基本功能码解析
- 支持所有已知设备模式
- 提供完整的测试用例 