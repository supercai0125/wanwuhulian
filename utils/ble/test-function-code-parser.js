// 功能码解析器测试文件
// 用于验证功能码解析器的功能

import { parseDeviceReply, parseFunctionCode, extractRollingCode, getModeName } from './function-code-parser.js'

// 测试数据
const testCases = [
    {
        name: '常关模式',
        hexData: '123400010100000000000000',
        expectedRollingCode: '1234',
        expectedFunctionCode: '01',
        expectedMode: 'off',
        expectedModeName: '常关'
    },
    {
        name: '常开模式',
        hexData: '567800010200000000000000',
        expectedRollingCode: '5678',
        expectedFunctionCode: '02',
        expectedMode: 'on',
        expectedModeName: '常开'
    },
    {
        name: '倒计时模式',
        hexData: 'ABCD00010400000000000000',
        expectedRollingCode: 'ABCD',
        expectedFunctionCode: '04',
        expectedMode: 'countdown',
        expectedModeName: '倒计时'
    },
    {
        name: '循环定时模式',
        hexData: 'EF0100010500000000000000',
        expectedRollingCode: 'EF01',
        expectedFunctionCode: '05',
        expectedMode: 'loop',
        expectedModeName: '循环定时'
    },
    {
        name: '日落定时模式',
        hexData: '234500010600000000000000',
        expectedRollingCode: '2345',
        expectedFunctionCode: '06',
        expectedMode: 'sunset',
        expectedModeName: '日落定时'
    },
    {
        name: '分组定时模式',
        hexData: '678900010300000000000000',
        expectedRollingCode: '6789',
        expectedFunctionCode: '03',
        expectedMode: 'group',
        expectedModeName: '分组定时'
    },
    {
        name: '时间同步',
        hexData: 'ABCD00010700000000000000',
        expectedRollingCode: 'ABCD',
        expectedFunctionCode: '07',
        expectedMode: 'timeSync',
        expectedModeName: '时间同步'
    },
    {
        name: '匹配命令',
        hexData: 'EF0100010800000000000000',
        expectedRollingCode: 'EF01',
        expectedFunctionCode: '08',
        expectedMode: 'match',
        expectedModeName: '匹配'
    }
];

// 运行测试
function runTests() {
    console.log('🧪 开始功能码解析器测试...\n');

    let passedTests = 0;
    let totalTests = testCases.length;

    testCases.forEach((testCase, index) => {
        console.log(`📋 测试 ${index + 1}: ${testCase.name}`);
        console.log(`   输入数据: ${testCase.hexData}`);

        // 测试完整解析
        const result = parseDeviceReply(testCase.hexData);

        // 验证结果
        const rollingCodeMatch = result.rollingCode === testCase.expectedRollingCode;
        const functionCodeMatch = result.functionCode === testCase.expectedFunctionCode;
        const modeMatch = result.mode === testCase.expectedMode;
        const modeNameMatch = result.modeName === testCase.expectedModeName;
        const isValid = result.isValid;

        const allPassed = rollingCodeMatch && functionCodeMatch && modeMatch && modeNameMatch && isValid;

        if (allPassed) {
            console.log(`   ✅ 通过`);
            passedTests++;
        } else {
            console.log(`   ❌ 失败`);
            console.log(`      期望滚动码: ${testCase.expectedRollingCode}, 实际: ${result.rollingCode}`);
            console.log(`      期望功能码: ${testCase.expectedFunctionCode}, 实际: ${result.functionCode}`);
            console.log(`      期望模式: ${testCase.expectedMode}, 实际: ${result.mode}`);
            console.log(`      期望模式名: ${testCase.expectedModeName}, 实际: ${result.modeName}`);
            console.log(`      期望有效: true, 实际: ${result.isValid}`);
        }

        console.log(`   解析结果: ${JSON.stringify(result, null, 2)}\n`);
    });

    // 测试边界情况
    console.log('📋 边界情况测试:');

    // 测试空数据
    const emptyResult = parseDeviceReply('');
    console.log(`   空数据测试: ${emptyResult ? '有结果' : '无结果'}`);

    // 测试短数据
    const shortResult = parseDeviceReply('123');
    console.log(`   短数据测试: ${shortResult ? '有结果' : '无结果'}`);

    // 测试无效功能码
    const invalidResult = parseDeviceReply('123400010900000000000000');
    console.log(`   无效功能码测试: ${invalidResult ? '有结果' : '无结果'}, 有效: ${invalidResult?.isValid}`);

    console.log('\n📊 测试总结:');
    console.log(`   总测试数: ${totalTests}`);
    console.log(`   通过测试: ${passedTests}`);
    console.log(`   失败测试: ${totalTests - passedTests}`);
    console.log(`   通过率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (passedTests === totalTests) {
        console.log('🎉 所有测试通过！功能码解析器工作正常。');
    } else {
        console.log('⚠️ 部分测试失败，请检查功能码解析器实现。');
    }
}

// 导出测试函数
export { runTests };

// 如果直接运行此文件，执行测试
if (typeof window !== 'undefined') {
    // 在浏览器环境中
    window.runFunctionCodeParserTests = runTests;
} else {
    // 在 Node.js 环境中
    runTests();
} 