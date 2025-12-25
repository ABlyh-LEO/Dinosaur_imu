/**
 * main.js - 主入口文件
 */

// 全局状态
let latestData = null;

// UI 元素
const btnConnect = document.getElementById('btnConnect');
const btnDisconnect = document.getElementById('btnDisconnect');
const btnRestartMCU = document.getElementById('btnRestartMCU');
const btnSendTimestamp = document.getElementById('btnSendTimestamp');
const btnSetTriggerInterval = document.getElementById('btnSetTriggerInterval');
const triggerIntervalInput = document.getElementById('triggerInterval');

// 状态元素
const statusConnect = document.getElementById('statusConnect');
const statusCalibrate = document.getElementById('statusCalibrate');
const statusStatic = document.getElementById('statusStatic');

// 数据显示元素
const valueElements = {
    // 时间戳
    ts1: document.getElementById('valTs1'),
    ts2: document.getElementById('valTs2'),
    ts3: document.getElementById('valTs3'),
    ts4: document.getElementById('valTs4'),
    ts5: document.getElementById('valTs5'),

    // 欧拉角
    roll: document.getElementById('valRoll'),
    pitch: document.getElementById('valPitch'),
    yaw: document.getElementById('valYaw'),

    // 角速度
    gyrX: document.getElementById('valGyrX'),
    gyrY: document.getElementById('valGyrY'),
    gyrZ: document.getElementById('valGyrZ'),

    // 加速度
    accX: document.getElementById('valAccX'),
    accY: document.getElementById('valAccY'),
    accZ: document.getElementById('valAccZ'),

    // 四元数
    quatW: document.getElementById('valQuatW'),
    quatX: document.getElementById('valQuatX'),
    quatY: document.getElementById('valQuatY'),
    quatZ: document.getElementById('valQuatZ'),

    // Offset
    offX: document.getElementById('valOffX'),
    offY: document.getElementById('valOffY'),
    offZ: document.getElementById('valOffZ'),

    // 其他
    temp: document.getElementById('valTemp'),
    tag: document.getElementById('valTag')
};

/**
 * 格式化 BigInt 时间戳显示
 */
function formatTimestamp(ts) {
    if (typeof ts === 'bigint') {
        return ts.toString();
    }
    return String(ts);
}

/**
 * 更新数据显示
 */
function updateValueDisplay(data) {
    // 更新状态
    if (data.is_calibrate_gyro) {
        statusCalibrate.textContent = '校准状态: 正在校准';
        statusCalibrate.className = 'status-label status-red';
    } else {
        statusCalibrate.textContent = '校准状态: 未在校准';
        statusCalibrate.className = 'status-label status-black';
    }

    if (data.is_static) {
        statusStatic.textContent = '静止状态: 静止';
        statusStatic.className = 'status-label status-black';
    } else {
        statusStatic.textContent = '静止状态: 运动';
        statusStatic.className = 'status-label status-red';
    }

    // 时间戳
    valueElements.ts1.textContent = formatTimestamp(data.ts_1);
    valueElements.ts2.textContent = formatTimestamp(data.ts_2);
    valueElements.ts3.textContent = formatTimestamp(data.ts_3);
    valueElements.ts4.textContent = formatTimestamp(data.ts_4);
    valueElements.ts5.textContent = formatTimestamp(data.ts_5);

    // 欧拉角
    valueElements.roll.textContent = data.eul[0].toFixed(2);
    valueElements.pitch.textContent = data.eul[1].toFixed(2);
    valueElements.yaw.textContent = data.eul[2].toFixed(2);

    // 角速度
    valueElements.gyrX.textContent = data.gyr[0].toFixed(3);
    valueElements.gyrY.textContent = data.gyr[1].toFixed(3);
    valueElements.gyrZ.textContent = data.gyr[2].toFixed(3);

    // 加速度
    valueElements.accX.textContent = data.acc[0].toFixed(3);
    valueElements.accY.textContent = data.acc[1].toFixed(3);
    valueElements.accZ.textContent = data.acc[2].toFixed(3);

    // 四元数
    valueElements.quatW.textContent = data.quat[0].toFixed(4);
    valueElements.quatX.textContent = data.quat[1].toFixed(4);
    valueElements.quatY.textContent = data.quat[2].toFixed(4);
    valueElements.quatZ.textContent = data.quat[3].toFixed(4);

    // Offset
    valueElements.offX.textContent = data.offset[0].toFixed(5);
    valueElements.offY.textContent = data.offset[1].toFixed(5);
    valueElements.offZ.textContent = data.offset[2].toFixed(5);

    // 其他
    valueElements.temp.textContent = data.temp.toFixed(0);
    valueElements.tag.textContent = `0x${data.tag.toString(16).toUpperCase().padStart(2, '0')}`;
}

/**
 * 重置 UI 到未连接状态
 */
function resetUiToDisconnected() {
    statusConnect.textContent = '连接状态: 未连接';
    statusConnect.className = 'status-label status-red';

    statusCalibrate.textContent = '校准状态: --';
    statusCalibrate.className = 'status-label';

    statusStatic.textContent = '静止状态: --';
    statusStatic.className = 'status-label';

    // 重置所有数据显示
    Object.values(valueElements).forEach(el => {
        if (el) el.textContent = '--';
    });

    latestData = null;

    btnConnect.disabled = false;
    btnDisconnect.disabled = true;
    btnRestartMCU.disabled = true;
}

/**
 * 设置 UI 到已连接状态
 */
function setUiToConnected() {
    statusConnect.textContent = '连接状态: 已连接';
    statusConnect.className = 'status-label status-black';

    btnConnect.disabled = true;
    btnDisconnect.disabled = false;
    btnRestartMCU.disabled = false;
}

// 渲染循环控制
let lastRender = 0;
const RENDER_INTERVAL_MS = 16;  // ~60Hz
let lastChartUpdate = 0;
const CHART_UPDATE_INTERVAL_MS = 30;  // ~33Hz

/**
 * 主渲染循环
 */
function renderLoop(timestamp) {
    if (!latestData) {
        requestAnimationFrame(renderLoop);
        return;
    }

    // 更新 UI 和 3D 模型
    if (timestamp - lastRender > RENDER_INTERVAL_MS) {
        updateValueDisplay(latestData);
        ThreeModel.updateRotation(latestData.eul[0], latestData.eul[1], latestData.eul[2]);
        lastRender = timestamp;
    }

    // 更新图表
    if (timestamp - lastChartUpdate > CHART_UPDATE_INTERVAL_MS) {
        ChartsManager.update();
        lastChartUpdate = timestamp;
    }

    requestAnimationFrame(renderLoop);
}

/**
 * 发送简单命令 (全局函数，供 HTML 按钮调用)
 */
async function sendCmd(cmd) {
    if (!SerialManager.isConnected()) {
        alert('未连接设备，无法发送命令');
        return;
    }

    try {
        await SerialManager.sendCmd(cmd);
    } catch (e) {
        console.error('发送命令失败:', e);
        alert('发送命令失败: ' + e.message);
    }
}

// ========== 事件监听器 ==========

// 连接按钮
btnConnect.addEventListener('click', async () => {
    try {
        await SerialManager.connect();
        setUiToConnected();
        ChartsManager.resetZoom();
    } catch (e) {
        console.error(e);
        alert('连接失败: ' + e.message);
        resetUiToDisconnected();
    }
});

// 断开按钮
btnDisconnect.addEventListener('click', async () => {
    await SerialManager.disconnect();
    resetUiToDisconnected();
});

// 重启 MCU 按钮
btnRestartMCU.addEventListener('click', async () => {
    if (!SerialManager.isConnected()) {
        alert('未连接设备');
        return;
    }

    try {
        await SerialManager.sendCmd(Protocol.CMD_RESTART);
        await SerialManager.disconnect();
        resetUiToDisconnected();
    } catch (e) {
        console.error('发送重启命令失败:', e);
    }
});

// 发送时间戳按钮
btnSendTimestamp.addEventListener('click', async () => {
    if (!SerialManager.isConnected()) {
        alert('未连接设备');
        return;
    }

    try {
        // 使用当前时间戳 (微秒)
        const timestamp = BigInt(Date.now()) * 1000n;
        await SerialManager.sendTimestamp(timestamp);
        console.log('已发送时间戳:', timestamp.toString());
    } catch (e) {
        console.error('发送时间戳失败:', e);
        alert('发送时间戳失败: ' + e.message);
    }
});

// 设置触发间隔按钮
btnSetTriggerInterval.addEventListener('click', async () => {
    if (!SerialManager.isConnected()) {
        alert('未连接设备');
        return;
    }

    const interval = parseInt(triggerIntervalInput.value, 10);
    if (isNaN(interval) || interval < 1) {
        alert('请输入有效的触发间隔');
        return;
    }

    try {
        await SerialManager.setTriggerInterval(interval);
        console.log('已设置触发间隔:', interval, '(1/8 ms)');
    } catch (e) {
        console.error('设置触发间隔失败:', e);
        alert('设置触发间隔失败: ' + e.message);
    }
});

// ========== 串口数据回调 ==========

SerialManager.onDataReceived = function (data) {
    latestData = data;
    ChartsManager.recordSample(data);
};

SerialManager.onConnectionChange = function (connected) {
    if (!connected) {
        resetUiToDisconnected();
    }
};

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
    ChartsManager.init();
    ThreeModel.init();
    requestAnimationFrame(renderLoop);
});
