const HEX = "0123456789abcdef";

const formatTime = date => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()

    return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : '0' + n
}

const ab2hex = (buffer) => {
    let hexArr = Array.prototype.map.call(
        new Uint8Array(buffer),
        function (bit) {
            return ('00' + bit.toString(16)).slice(-2)
        }
    )
    return hexArr.join('');
}

const strToHexCharCode = (str) => {
    if (str === "")
        return "";
    var hexCharCode = [];
    hexCharCode.push("0x");
    for (var i = 0; i < str.length; i++) {
        hexCharCode.push((str.charCodeAt(i)).toString(16));
    }
    return hexCharCode.join("");
}


/**
 * 16进制转10进制
 * @param {*} value 
 */
function hex2int(hex) {
    var len = hex.length, a = new Array(len), code;
    for (var i = 0; i < len; i++) {
        code = hex.charCodeAt(i);
        if (48 <= code && code < 58) {
            code -= 48;
        } else {
            code = (code & 0xdf) - 65 + 10;
        }
        a[i] = code;
    }

    return a.reduce(function (acc, c) {
        acc = 16 * acc + c;
        return acc;
    }, 0);
}

// 字符串转为ArrayBuffer对象，参数为字符串
const str2ab = (str) => {
    var buf = new ArrayBuffer(str.length * 2); // 每个字符占用2个字节
    var bufView = new Uint16Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

const inArray = (arr, key, val) => {
    if (arr && arr.length > 0) {
        for (let i = 0; i < arr.length; i++) {
            if (arr[i][key] === val) {
                return i;
            }
        }
    }

    return -1;
}

const str2Bytes = (str) => {
    var pos = 0;
    var len = str.length;
    if (len % 2 != 0) {
        return null;
    }
    len /= 2;
    var hexA = '';
    for (var i = 0; i < len; i++) {
        var s = str.substr(pos, 2);
        var v = parseInt(s, 16);
        if (!v) {
            v = ((charToByte(s.charAt(0)) << 4) | charToByte(str.charAt(1)));
        }
        if (v >= 127) v = v - 255 - 1
        hexA = v;
        pos += 2;
    }
    return hexA;

}
const charToByte = (c) => {
    return "0123456789abcdef".indexOf(c)
}

const byteToString = (bytes) => {
    let str = ''
    for (let i = 0; i != bytes.length; ++i) {
        if ((bytes[i] & 0xf0) == 0) {
            str += "0"
            str += HEX.charAt(bytes[i] & 0x0f)
        } else {
            str += HEX.charAt((bytes[i] >> 4) & 0x0f)
            str += HEX.charAt(bytes[i] & 0x0f)
        }
        str += " ";
    }
    return str;
}


module.exports = {
    formatTime: formatTime,
    inArray: inArray,
    ab2hex: ab2hex,
    str2ab: str2ab,
    str2Bytes: str2Bytes,
    byteToString: byteToString,
    hex2int: hex2int,
    strToHexCharCode: strToHexCharCode
} 