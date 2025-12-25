/**
 * charts.js - 图表管理模块
 */

const ChartsManager = {
    MAX_POINTS: 2000,
    charts: {},

    /**
     * 时间格式化函数：将毫秒数转换为 mm:ss.SSS 格式
     */
    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = ms % 1000;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    },

    /**
     * 创建图表
     */
    createChart(ctx, labels, colors, yAxisLabel) {
        const self = this;
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: labels.map((label, i) => ({
                    label,
                    data: [],
                    borderColor: colors[i],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    hidden: false,
                    fill: false,
                    tension: 0.15,
                })),
            },
            options: {
                animation: false,
                responsive: false,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: true,
                        ticks: {
                            callback: function (value, index, values) {
                                const label = this.chart.data.labels[index];
                                if (typeof label === 'bigint') {
                                    return self.formatTime(Number(label % BigInt(Number.MAX_SAFE_INTEGER)));
                                }
                                return self.formatTime(label);
                            },
                            autoSkip: true,
                            maxTicksLimit: 10,
                            maxRotation: 0,
                            minRotation: 0
                        },
                        title: {
                            display: true,
                            text: '时间',
                            font: { size: 12 }
                        }
                    },
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: yAxisLabel,
                            font: { size: 12 }
                        }
                    },
                },
                plugins: {
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'x',
                        },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x',
                        }
                    },
                    legend: {
                        display: true,
                        labels: { font: { size: 14 } }
                    }
                },
            },
        });
    },

    /**
     * 初始化所有图表
     */
    init() {
        this.charts.chartEuler = this.createChart(
            document.getElementById('chartEuler').getContext('2d'),
            ['Roll(°)', 'Pitch(°)', 'Yaw(°)'],
            ['#e53935', '#1e88e5', '#fbc02d'],
            '角度 (°)'
        );

        this.charts.chartGyro = this.createChart(
            document.getElementById('chartGyro').getContext('2d'),
            ['WX(rad/s)', 'WY(rad/s)', 'WZ(rad/s)'],
            ['#43a047', '#3949ab', '#fb8c00'],
            '角速度 (rad/s)'
        );

        this.charts.chartAcc = this.createChart(
            document.getElementById('chartAcc').getContext('2d'),
            ['AX(m/s²)', 'AY(m/s²)', 'AZ(m/s²)'],
            ['#ff6384', '#36a2eb', '#cc65fe'],
            '加速度 (m/s²)'
        );

        // 绑定复选框事件
        this.bindCheckboxEvents();
    },

    /**
     * 记录数据样本
     */
    recordSample(data) {
        const allCharts = Object.values(this.charts);
        const newData = [data.eul, data.gyr, data.acc];

        // 使用 ts_5 作为时间戳 (IMU数据更新后的本地时间戳)
        const timestamp = Number(data.ts_5 % BigInt(Number.MAX_SAFE_INTEGER));

        const isBufferFull = allCharts[0].data.labels.length >= this.MAX_POINTS;

        allCharts.forEach((chart, chartIndex) => {
            if (isBufferFull) {
                chart.data.labels.shift();
                chart.data.datasets.forEach(dataset => dataset.data.shift());
            }

            chart.data.labels.push(timestamp);
            chart.data.datasets.forEach((dataset, datasetIndex) => {
                dataset.data.push(newData[chartIndex][datasetIndex]);
            });
        });
    },

    /**
     * 更新图表显示
     */
    update() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.update('none');
        });
    },

    /**
     * 重置所有图表缩放
     */
    resetZoom() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.resetZoom) chart.resetZoom();
        });
    },

    /**
     * 绑定复选框事件
     */
    bindCheckboxEvents() {
        const self = this;
        document.querySelectorAll('.checkbox-group input[type=checkbox]').forEach(checkbox => {
            checkbox.addEventListener('change', e => {
                const chk = e.target;
                const chartName = chk.dataset.chart;
                const dsIndex = Number(chk.dataset.index);

                if (self.charts[chartName]) {
                    self.charts[chartName].data.datasets[dsIndex].hidden = !chk.checked;
                    self.charts[chartName].update('none');
                }
            });
        });
    }
};
