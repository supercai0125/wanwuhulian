// #include "whitening.h"

const invert_8 = (data) => {
    let temp = 0;
    for (let i = 0; i < 8; i++) {
        if (temp > 127) {
            temp = -temp
        }
        if (data & (1 << i)) {
            temp |= 1 << (7 - i);
        }
    }

    return temp;
}

const invert_16 = (data) => {
    let temp = 0;
    for (let i = 0; i < 16; i++) {
        if (data & (1 << i)) {
            temp |= 1 << (15 - i);
        }
    }

    return temp;
}

const check_crc16 = (addr, addr_length, rf_payload, payload_width) => {
    let crc = 0xFFFF;
    let poly = 0x1021;
    let input_byte = 0;

    for (let i = 0; i < addr_length; i++) {
        // Addr: invert endian
        input_byte = addr[addr_length - 1 - i];

        crc ^= (input_byte << 8);

        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ poly;
            } else {
                crc = (crc << 1);
            }
        }
    }

    for (let i = 0; i < payload_width; i++) {
        // Payload: invert bit order
        input_byte = invert_8(rf_payload[i]);

        crc ^= (input_byte << 8);

        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ poly;
            } else {
                crc = (crc << 1);
            }
        }
    }
    crc = invert_16(crc);

    return (crc ^ 0xFFFF);
}



module.exports = {
    check_crc16: check_crc16,
    invert_8: invert_8,
    invert_16: invert_16,

} 