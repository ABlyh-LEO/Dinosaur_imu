/**
 * protocol.js - 数据包解析与命令发送协议
 * 
 * 新数据包结构 (packed):
 * - uint16_t header      (2 bytes) - 0xA55A
 * - uint16_t len         (2 bytes)
 * - uint16_t crc         (2 bytes)
 * - uint8_t  tag         (1 byte)
 * - uint8_t  is_calibrate_gyro (1 byte)
 * - uint8_t  is_static   (1 byte)
 * - int8_t   temp        (1 byte)
 * - uint64_t ts_1        (8 bytes) - 上位机传下来的时间戳
 * - uint64_t ts_2        (8 bytes) - 收到上位机时间戳的本地时间戳
 * - uint64_t ts_3        (8 bytes) - 发送数据包前的本地时间戳
 * - uint64_t ts_4        (8 bytes) - 上次拉下相机触发线前的本地时间戳
 * - uint64_t ts_5        (8 bytes) - 当前包中imu数据更新后的本地时间戳
 * - float    acc[3]      (12 bytes)
 * - float    gyr[3]      (12 bytes)
 * - float    offset[3]   (12 bytes)
 * - float    eul[3]      (12 bytes)
 * - float    quat[4]     (16 bytes)
 * 
 * 总计: 2+2+2+1+1+1+1+8+8+8+8+8+12+12+12+12+16 = 114 bytes
 */

const Protocol = {
    // 数据包常量
    HEADER: 0xA55A,
    PACKET_SIZE: 114,

    // 命令码
    CMD_RESTART: 0x00,
    CMD_READ_OFFSET: 0x01,
    CMD_START_ESTIMATE: 0x02,
    CMD_STOP_ESTIMATE: 0x03,
    CMD_SAVE_OFFSET: 0x04,
    CMD_SEND_TIMESTAMP: 0x05,
    CMD_SET_TRIGGER_INTERVAL: 0x06,

    /**
     * 读取 uint64_t (little-endian)
     * JavaScript 的 DataView 不直接支持 BigInt，需要手动处理
     */
    getUint64LE(dataView, offset) {
        const low = dataView.getUint32(offset, true);
        const high = dataView.getUint32(offset + 4, true);
        return BigInt(low) + (BigInt(high) << 32n);
    },

    /**
     * 写入 uint64_t (little-endian) 到 Uint8Array
     */
    setUint64LE(buffer, offset, value) {
        const bigValue = BigInt(value);
        const low = Number(bigValue & 0xFFFFFFFFn);
        const high = Number((bigValue >> 32n) & 0xFFFFFFFFn);

        buffer[offset] = low & 0xFF;
        buffer[offset + 1] = (low >> 8) & 0xFF;
        buffer[offset + 2] = (low >> 16) & 0xFF;
        buffer[offset + 3] = (low >> 24) & 0xFF;
        buffer[offset + 4] = high & 0xFF;
        buffer[offset + 5] = (high >> 8) & 0xFF;
        buffer[offset + 6] = (high >> 16) & 0xFF;
        buffer[offset + 7] = (high >> 24) & 0xFF;
    },

    /**
     * 解析数据包
     * @param {Array} buffer - 接收缓冲区
     * @returns {Object|null} - 解析后的数据对象，或 null
     */
    parsePacket(buffer) {
        const PACKET_SIZE = this.PACKET_SIZE;
        const LEN_FIELD_VALUE = 0x6C;

        for (let i = 0; i <= buffer.length - PACKET_SIZE; i++) {
            // 检查 header (little-endian: 0x5A, 0xA5)
            if (buffer[i] === 0x5A && buffer[i + 1] === 0xA5) {
                // 检查 len 字段 (恒为 0x6C)
                const len = buffer[i + 2] | (buffer[i + 3] << 8);
                if (len !== LEN_FIELD_VALUE) continue;

                const pkt = buffer.slice(i, i + PACKET_SIZE);
                const dv = new DataView(new Uint8Array(pkt).buffer);

                // 偏移量计算
                let offset = 0;

                // header (2) + len (2) + crc (2) = 6
                offset = 6;

                const data = {
                    tag: dv.getUint8(offset),               // offset 6
                    is_calibrate_gyro: dv.getUint8(offset + 1), // offset 7
                    is_static: dv.getUint8(offset + 2),     // offset 8
                    temp: dv.getInt8(offset + 3),           // offset 9

                    // 时间戳 (从 offset 10 开始)
                    ts_1: this.getUint64LE(dv, 10),         // 上位机传下来的时间戳
                    ts_2: this.getUint64LE(dv, 18),         // 收到上位机时间戳的本地时间戳
                    ts_3: this.getUint64LE(dv, 26),         // 发送数据包前的本地时间戳
                    ts_4: this.getUint64LE(dv, 34),         // 上次拉下相机触发线前的本地时间戳
                    ts_5: this.getUint64LE(dv, 42),         // 当前包中imu数据更新后的本地时间戳

                    // 传感器数据 (从 offset 50 开始)
                    acc: [
                        dv.getFloat32(50, true),
                        dv.getFloat32(54, true),
                        dv.getFloat32(58, true)
                    ],
                    gyr: [
                        dv.getFloat32(62, true),
                        dv.getFloat32(66, true),
                        dv.getFloat32(70, true)
                    ],
                    offset: [
                        dv.getFloat32(74, true),
                        dv.getFloat32(78, true),
                        dv.getFloat32(82, true)
                    ],
                    eul: [
                        dv.getFloat32(86, true) * 180 / Math.PI,  // Roll (转换为度)
                        dv.getFloat32(90, true) * 180 / Math.PI,  // Pitch
                        dv.getFloat32(94, true) * 180 / Math.PI   // Yaw
                    ],
                    quat: [
                        dv.getFloat32(98, true),   // W
                        dv.getFloat32(102, true),  // X
                        dv.getFloat32(106, true),  // Y
                        dv.getFloat32(110, true)   // Z
                    ],

                    length: PACKET_SIZE
                };

                return data;
            }
        }
        return null;
    },

    /**
     * 创建简单命令包 (16 bytes)
     * @param {number} cmd - 命令码
     * @returns {Uint8Array}
     */
    createCmdPacket(cmd) {
        const buf = new Uint8Array(16);
        buf[0] = 0xAB;
        buf[1] = cmd;
        return buf;
    },

    /**
     * 创建发送时间戳命令包 (0x05)
     * 格式: 0xAB, 0x05, uint64_t timestamp (little-endian), 填充
     * @param {BigInt|number} timestamp - 时间戳
     * @returns {Uint8Array}
     */
    createTimestampPacket(timestamp) {
        const buf = new Uint8Array(16);
        buf[0] = 0xAB;
        buf[1] = this.CMD_SEND_TIMESTAMP;
        this.setUint64LE(buf, 2, timestamp);
        return buf;
    },

    /**
     * 创建设置触发间隔命令包 (0x06)
     * 格式: 0xAB, 0x06, uint64_t interval (little-endian), 填充
     * 单位: 1/8 ms
     * @param {BigInt|number} interval - 触发间隔 (单位: 1/8 ms)
     * @returns {Uint8Array}
     */
    createTriggerIntervalPacket(interval) {
        const buf = new Uint8Array(16);
        buf[0] = 0xAB;
        buf[1] = this.CMD_SET_TRIGGER_INTERVAL;
        this.setUint64LE(buf, 2, interval);
        return buf;
    }
};


