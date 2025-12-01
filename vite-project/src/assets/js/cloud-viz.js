/**
 * Cloud Architecture Visualizer
 * Renders an animated node graph of the AWS services and data flow.
 */

export class CloudVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.nodes = [];
        this.particles = [];
        this.animationFrame = null;
        
        this.services = [
            { id: 'iot', name: 'IoT Core', icon: 'wifi', class: 'node-iot' },
            { id: 'lambda', name: 'Lambda', icon: 'cpu', class: 'node-lambda' },
            { id: 'db', name: 'RDS / Dynamo', icon: 'database', class: 'node-db' },
            { id: 'ml', name: 'SageMaker', icon: 'brain', class: 'node-ml' },
            { id: 'api', name: 'API Gateway', icon: 'globe', class: 'node-api' }
        ];

        this.connections = [
            { from: 'iot', to: 'lambda' },
            { from: 'lambda', to: 'db' },
            { from: 'lambda', to: 'ml' },
            { from: 'ml', to: 'db' },
            { from: 'db', to: 'api' } // Simulating read path
        ];

        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.classList.add('cloud-viz-container');
        this.container.innerHTML = ''; // Clear existing

        // Render nodes
        this.services.forEach(service => {
            const el = document.createElement('div');
            el.className = `cloud-node ${service.class}`;
            el.id = `node-${service.id}`;
            el.innerHTML = `
                ${this.getIcon(service.icon)}
                <span>${service.name}</span>
                <div class="status-pulse"></div>
            `;
            this.container.appendChild(el);
            this.nodes.push({ id: service.id, el });
        });

        // Render lines (SVG)
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';
        this.container.appendChild(svg);
        this.svg = svg;

        // Wait for layout
        setTimeout(() => {
            this.drawConnections();
            this.startAnimation();
        }, 100);

        // Handle resize
        window.addEventListener('resize', () => this.drawConnections());
    }

    getIcon(name) {
        const icons = {
            wifi: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />',
            cpu: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />',
            database: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />',
            brain: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />',
            globe: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />'
        };
        return `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">${icons[name]}</svg>`;
    }

    drawConnections() {
        this.svg.innerHTML = '';
        this.connections.forEach(conn => {
            const fromEl = document.getElementById(`node-${conn.from}`);
            const toEl = document.getElementById(`node-${conn.to}`);
            
            if (fromEl && toEl) {
                this.drawLine(fromEl, toEl);
            }
        });
    }

    drawLine(el1, el2) {
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();
        const containerRect = this.container.getBoundingClientRect();

        const x1 = rect1.left + rect1.width / 2 - containerRect.left;
        const y1 = rect1.top + rect1.height / 2 - containerRect.top;
        const x2 = rect2.left + rect2.width / 2 - containerRect.left;
        const y2 = rect2.top + rect2.height / 2 - containerRect.top;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
        path.setAttribute("x1", x1);
        path.setAttribute("y1", y1);
        path.setAttribute("x2", x2);
        path.setAttribute("y2", y2);
        path.setAttribute("stroke", "rgba(255,255,255,0.1)");
        path.setAttribute("stroke-width", "2");
        this.svg.appendChild(path);

        // Store connection data for particles
        const connId = `conn_${el1.id.replace('node-', '')}_${el2.id.replace('node-', '')}`;
        el1.dataset[connId] = JSON.stringify({ x1, y1, x2, y2 });
    }

    emitParticle(fromId, toId) {
        const fromEl = document.getElementById(`node-${fromId}`);
        const connId = `conn_${fromId}_${toId}`;
        const coords = JSON.parse(fromEl?.dataset[connId] || '{}');
        
        if (!coords.x1) return;

        const particle = document.createElement('div');
        particle.className = 'data-particle';
        this.container.appendChild(particle);

        const duration = 1000 + Math.random() * 500;
        const startTime = performance.now();

        const animate = (time) => {
            const progress = (time - startTime) / duration;
            
            if (progress >= 1) {
                particle.remove();
                return;
            }

            const currentX = coords.x1 + (coords.x2 - coords.x1) * progress;
            const currentY = coords.y1 + (coords.y2 - coords.y1) * progress;

            particle.style.left = `${currentX}px`;
            particle.style.top = `${currentY}px`;

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    startAnimation() {
        // Simulate random data flow
        setInterval(() => {
            const randomConn = this.connections[Math.floor(Math.random() * this.connections.length)];
            this.emitParticle(randomConn.from, randomConn.to);
        }, 500);

        // "Heartbeat" flow from IoT to API
        setInterval(() => {
            this.triggerFlow('iot', 'lambda');
            setTimeout(() => this.triggerFlow('lambda', 'db'), 800);
            setTimeout(() => this.triggerFlow('db', 'api'), 1600);
        }, 3000);
    }

    triggerFlow(from, to) {
        this.emitParticle(from, to);
    }
}

// Matrix Log Streamer
export class MatrixLogStream {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.logs = [
            "INITIALIZING_SYSTEM_CORE...",
            "CONNECTING_TO_AWS_IOT_CORE...",
            "ESTABLISHING_SECURE_HANDSHAKE...",
            "LOADING_ML_MODELS [v3.2.1]...",
            "AUDIT_LOG_SERVICE_ACTIVE",
            "WATCHDOG_TIMER_STARTED",
            "READY_FOR_INGESTION"
        ];
        
        this.init();
    }

    init() {
        if (!this.container) return;
        this.container.classList.add('matrix-logs');
        this.container.innerHTML = '';
        
        // Initial logs
        this.logs.forEach((log, i) => {
            setTimeout(() => this.addLog(log), i * 200);
        });

        // Random logs
        setInterval(() => this.generateRandomLog(), 2000);
    }

    addLog(text) {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.textContent = `> ${new Date().toISOString().split('T')[1].slice(0,8)} ${text}`;
        
        // Prepend to keep newest at top (visually with CSS transforms) or append bottom? 
        // Matrix usually falls down. Let's append and scroll.
        this.container.appendChild(line);
        
        if (this.container.children.length > 10) {
            this.container.firstChild.remove();
        }
    }

    generateRandomLog() {
        const actions = ['INGEST', 'PROCESS', 'ANALYZE', 'STORE', 'ACK'];
        const components = ['IOT_SENSOR', 'LAMBDA_FN', 'DYNAMODB', 'SAGEMAKER'];
        const status = ['SUCCESS', 'PENDING', 'COMPLETED', 'OK'];
        
        const log = `${actions[Math.floor(Math.random()*actions.length)]} :: ${components[Math.floor(Math.random()*components.length)]} -> ${status[Math.floor(Math.random()*status.length)]}`;
        this.addLog(log);
    }
}
