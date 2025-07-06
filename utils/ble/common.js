import { whitening_init, whitenging_encode } from '../whitening'
import { invert_8, invert_16, check_crc16 } from '../crc16'
import { str2Bytes, byteToString, strToHexCharCode } from '../util'

// 生成1RF载荷数据
const get_1rf_1payload = (address, address_length, rf_payload, rf_payload_width, output_ble_payload) => {
    const base_size = 15
    const channel = wx.getStorageSync('channel') || '37'
    const whitening_reg_ble = new Array(7)
    whitening_reg_ble[0] = 0
    const whitening_reg_297 = new Array(7)
    whitening_reg_297[0] = 0

    whitening_init(channel, whitening_reg_ble);
    whitening_init(0x3F, whitening_reg_297);

    let ble_payload = new Array(base_size + 3 + address_length + rf_payload_width + 2);
    /*** Step1. copy pre, address and rf payload ***/
    ble_payload[base_size + 0] = 0x71;
    ble_payload[base_size + 1] = 0x0F;
    ble_payload[base_size + 2] = 0x55;
    for (let i = 0; i < address_length; i++) {
        ble_payload[base_size + 3 + i] = address[address_length - i - 1];
    }

    for (let i = 0; i < rf_payload_width; i++) {
        ble_payload[base_size + 3 + address_length + i] = rf_payload[i];
    }

    /*** Step2. xn297l bit invert ***/
    for (let i = 0; i < 3 + address_length; i++) {
        ble_payload[base_size + i] = invert_8(ble_payload[base_size + i]);
    }
    /*** Step3. add crc16 ***/
    let crc = check_crc16(address, address_length, rf_payload, rf_payload_width);

    ble_payload[base_size + 3 + address_length + rf_payload_width + 0] = crc & 0xFF;
    ble_payload[base_size + 3 + address_length + rf_payload_width + 1] = (crc >> 8) & 0xFF;

    /*** Step4. xn297l whitening ***/
    const wData = whitenging_encode(ble_payload.slice(base_size + 3),
        address_length + rf_payload_width + 2, whitening_reg_297);
    for (let i = 0; i < wData.length; i++) {
        ble_payload[base_size + 3 + i] = wData[i]
    }
    /*** Step5. BLE whitening ***/
    whitenging_encode(ble_payload, + base_size + 3 + address_length + rf_payload_width + 2, whitening_reg_ble);
    const act_payload = new Array(3 + address_length + rf_payload_width + 2)
    for (let i = 0; i < 3 + address_length + rf_payload_width + 2; ++i) {
        act_payload[i] = ble_payload[i + base_size];
    }
    return act_payload
}

// 获取服务UUID列表
const getServiceUUIDs = (actPayload, isIos13) => {
    let payload = byteToString(actPayload)
    console.log('getServiceUUIDs - payload:', payload, 'isIos13:', isIos13);
    return getServiceUUIDsBySpace(payload)
}

// 根据载荷生成服务UUID
const getServiceUUIDsBySpace = (payload) => {
    const uuids = ['00c7']
    const uuidHexArr = []
    console.log('payload', payload)
    if (payload) {
        let payloadArray = payload.split(' ').filter(item => item && item.length > 0);
        if (payloadArray.length % 2 != 0) {
            payloadArray.push("00")
        }
        for (let i = 0; i < payloadArray.length; i++) {
            if (!payloadArray[i]) {
                continue
            }
            if (i % 2 != 0) {
                uuids.push(payloadArray[i] + payloadArray[i - 1])
            }
        }
    }
    for (let i = uuids.length; i < 17; i++) {
        const pre = i < 10 ? ("0" + i) : ("" + i)
        const suf = (i + 1) < 10 ? ("0" + (i + 1)) : ("" + (i + 1))
        uuids.push(pre + suf)
    }
    console.log('uuids', uuids)
    return uuids
}

// 生成带地址的数据
const generateDataWithAddr = (rawAddress, inputPayload, isIos) => {
    const address = Array(rawAddress.length / 2)
    for (let i = 0; i < address.length; ++i) {
        const add = str2Bytes(rawAddress.substring(i * 2, (i + 1) * 2));
        address[i] = add
    }
    let rawPayload = inputPayload;
    rawPayload = rawPayload.replace(/\s+/g, '')
    rawPayload = rawPayload.toLowerCase();
    if (rawPayload.length < 2) {
        console.error('The payload is at least 1 byte');
        return;
    }
    if (rawPayload.length % 2 != 0) {
        console.error('payload长度必须是偶数');
        return;
    }
    const payload = new Array(rawPayload.length / 2)
    for (let i = 0; i < payload.length; ++i) {
        payload[i] = str2Bytes(rawPayload.substring(i * 2, (i + 1) * 2));
    }
    let calculatedPayload = new Array(address.length + payload.length + 5);
    const actPayload = get_1rf_1payload(address, address.length, payload, payload.length, calculatedPayload, isIos);
    return actPayload
}

export {
    get_1rf_1payload,
    getServiceUUIDs,
    getServiceUUIDsBySpace,
    generateDataWithAddr
} 