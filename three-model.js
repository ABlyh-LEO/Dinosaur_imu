/**
 * three-model.js - Three.js 3D姿态模型
 */

const ThreeModel = {
    scene: null,
    camera: null,
    renderer: null,
    airplane: null,

    /**
     * 初始化 Three.js 场景
     */
    init() {
        const container = document.getElementById('threeContainer');

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            45,
            container.clientWidth / container.clientHeight,
            0.1,
            100
        );

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setClearColor(0xffffff, 1);
        container.appendChild(this.renderer.domElement);

        this.createAirplane();
        this.setupLighting();
        this.setupCamera();
        this.animate();
    },

    /**
     * 创建飞机模型
     */
    createAirplane() {
        this.airplane = new THREE.Group();

        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            flatShading: true
        });
        const wingMaterial = new THREE.MeshStandardMaterial({
            color: 0x990000,
            flatShading: true
        });

        // 机身
        const fuselageGeometry = new THREE.BoxGeometry(0.8, 1, 4);
        const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
        this.airplane.add(fuselage);

        // 机翼
        const wingGeometry = new THREE.BoxGeometry(5, 0.2, 1.5);
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.set(0, 0, -0.5);
        this.airplane.add(wings);

        // 水平尾翼
        const tailWingGeometry = new THREE.BoxGeometry(2.5, 0.15, 0.8);
        const tailWings = new THREE.Mesh(tailWingGeometry, wingMaterial);
        tailWings.position.set(0, 0.25, 1.8);
        this.airplane.add(tailWings);

        // 垂直尾翼
        const finGeometry = new THREE.BoxGeometry(0.15, 1, 0.8);
        const fin = new THREE.Mesh(finGeometry, bodyMaterial);
        fin.position.set(0, 0.7, 1.8);
        this.airplane.add(fin);

        this.scene.add(this.airplane);

        // 坐标轴辅助
        const axesHelper = new THREE.AxesHelper(2.5);
        this.scene.add(axesHelper);
    },

    /**
     * 设置光照
     */
    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7);
        this.scene.add(directionalLight);
    },

    /**
     * 设置相机
     */
    setupCamera() {
        this.camera.position.set(5, 5, 8);
        this.camera.lookAt(this.airplane.position);
    },

    /**
     * 更新模型旋转
     * @param {number} roll - 横滚角 (度)
     * @param {number} pitch - 俯仰角 (度)
     * @param {number} yaw - 偏航角 (度)
     */
    updateRotation(roll, pitch, yaw) {
        const rollRad = THREE.MathUtils.degToRad(roll);
        const pitchRad = THREE.MathUtils.degToRad(pitch);
        const yawRad = THREE.MathUtils.degToRad(yaw);

        const euler = new THREE.Euler(pitchRad, yawRad, rollRad, 'YXZ');
        this.airplane.setRotationFromEuler(euler);
    },

    /**
     * 动画循环
     */
    animate() {
        const self = this;
        function loop() {
            requestAnimationFrame(loop);
            self.renderer.render(self.scene, self.camera);
        }
        loop();
    }
};
