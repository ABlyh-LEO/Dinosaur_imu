/**
 * serial.js - 串口通信模块
 */

const SerialManager = {
    port: null,
    reader: null,
    writer: null,
    reading: false,
    readBuffer: [],

    // 回调函数
    onDataReceived: null,
    onConnectionChange: null,

    /**
     * 连接串口
     */
    async connect() {
        if (!("serial" in navigator)) {
            throw new Error('浏览器不支持 Web Serial API');
        }

        this.port = await navigator.serial.requestPort();
        await this.port.open({ baudRate: 115200 });

        this.reader = this.port.readable.getReader();
        this.writer = this.port.writable.getWriter();
        this.reading = true;
        this.readBuffer = [];

        this.readLoop();

        if (this.onConnectionChange) {
            this.onConnectionChange(true);
        }
    },

    /**
     * 断开连接
     */
    async disconnect() {
        this.reading = false;

        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader.releaseLock();
                this.reader = null;
            }
            if (this.writer) {
                this.writer.releaseLock();
                this.writer = null;
            }
            if (this.port) {
                await this.port.close();
                this.port = null;
            }
        } catch (e) {
            console.error('断开连接时出错:', e);
        }

        if (this.onConnectionChange) {
            this.onConnectionChange(false);
        }
    },

    /**
     * 读取循环
     */
    async readLoop() {
        const MAX_BUFFER = 2000 * Protocol.PACKET_SIZE;

        try {
            while (this.reading && this.reader) {
                const { value, done } = await this.reader.read();
                if (done) break;

                if (value) {
                    this.readBuffer.push(...value);

                    // 限制缓冲区大小
                    if (this.readBuffer.length > MAX_BUFFER) {
                        this.readBuffer.splice(0, this.readBuffer.length - MAX_BUFFER);
                    }

                    // 解析数据包
                    let pkt;
                    while ((pkt = Protocol.parsePacket(this.readBuffer)) !== null) {
                        if (this.onDataReceived) {
                            this.onDataReceived(pkt);
                        }
                        this.readBuffer.splice(0, pkt.length);
                    }
                }
            }
        } catch (e) {
            console.error('读取错误:', e);
            await this.disconnect();
        }
    },

    /**
     * 发送简单命令
     */
    async sendCmd(cmd) {
        if (!this.writer) {
            throw new Error('未连接设备');
        }

        const buf = Protocol.createCmdPacket(cmd);
        await this.writer.write(buf);
    },

    /**
     * 发送时间戳命令 (0x05)
     * @param {BigInt|number} timestamp - 时间戳
     */
    async sendTimestamp(timestamp) {
        if (!this.writer) {
            throw new Error('未连接设备');
        }

        const buf = Protocol.createTimestampPacket(timestamp);
        await this.writer.write(buf);
    },

    /**
     * 设置触发间隔命令 (0x06)
     * @param {number} interval - 触发间隔 (单位: 1/8 ms)
     */
    async setTriggerInterval(interval) {
        if (!this.writer) {
            throw new Error('未连接设备');
        }

        const buf = Protocol.createTriggerIntervalPacket(interval);
        await this.writer.write(buf);
    },

    /**
     * 检查是否已连接
     */
    isConnected() {
        return this.writer !== null && this.reading;
    }
};
