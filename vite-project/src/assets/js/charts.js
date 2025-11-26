// Professional Chart System using Chart.js
// Provides beautiful, animated charts for dashboards

export class ChartManager {
    constructor() {
        this.charts = new Map();
        this.loadChartJS();
    }

    async loadChartJS() {
        // Load Chart.js from CDN if not already loaded
        if (typeof window.Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
            document.head.appendChild(script);
            
            await new Promise(resolve => {
                script.onload = resolve;
            });
        }
    }

    // Create a line chart for trends
    createLineChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        
        // Destroy existing chart if it exists
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
        
        const Chart = window.Chart;
        if (!Chart) return null;

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            family: 'Inter, sans-serif',
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        font: {
                            family: 'Inter, sans-serif'
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Inter, sans-serif'
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: data,
            options: { ...defaultOptions, ...options }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Create a bar chart
    createBarChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        
        // Destroy existing chart if it exists
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
        
        const Chart = window.Chart;
        if (!Chart) return null;

        const chart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Create a doughnut chart
    createDoughnutChart(canvasId, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        
        // Destroy existing chart if it exists
        if (this.charts.has(canvasId)) {
            this.charts.get(canvasId).destroy();
            this.charts.delete(canvasId);
        }
        
        const Chart = window.Chart;
        if (!Chart) return null;

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                family: 'Inter, sans-serif',
                                size: 12
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000
                },
                ...options
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }

    // Update chart data with animation
    updateChart(canvasId, newData) {
        const chart = this.charts.get(canvasId);
        if (!chart) return;

        chart.data = newData;
        chart.update('active');
    }

    // Destroy a chart
    destroyChart(canvasId) {
        const chart = this.charts.get(canvasId);
        if (chart) {
            chart.destroy();
            this.charts.delete(canvasId);
        }
    }

    // Create sparkline (mini chart for KPI cards)
    createSparkline(canvasId, data, color = '#3b82f6') {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;
        
        const Chart = window.Chart;
        if (!Chart) return null;

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map((_, i) => i),
                datasets: [{
                    data: data,
                    borderColor: color,
                    backgroundColor: `${color}20`,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                animation: {
                    duration: 500
                }
            }
        });

        this.charts.set(canvasId, chart);
        return chart;
    }
}

// Sample data generators for demo
export const sampleData = {
    alertTrends: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
            label: 'Critical',
            data: [12, 19, 8, 15, 10, 14, 9],
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            tension: 0.4
        }, {
            label: 'High',
            data: [15, 23, 18, 25, 20, 22, 18],
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            tension: 0.4
        }, {
            label: 'Medium',
            data: [25, 30, 28, 32, 29, 31, 27],
            borderColor: '#eab308',
            backgroundColor: 'rgba(234, 179, 8, 0.1)',
            tension: 0.4
        }]
    },

    severityDistribution: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [{
            data: [15, 30, 40, 15],
            backgroundColor: [
                '#dc2626',
                '#f97316',
                '#eab308',
                '#22c55e'
            ],
            borderWidth: 0
        }]
    },

    deviceStatus: {
        labels: ['Online', 'Offline', 'Warning'],
        datasets: [{
            data: [85, 10, 5],
            backgroundColor: [
                '#10b981',
                '#ef4444',
                '#f59e0b'
            ],
            borderWidth: 0
        }]
    }
};

// Initialize charts on page load
export function initCharts() {
    const chartManager = new ChartManager();
    
    // Wait for Chart.js to load
    setTimeout(() => {
        // Initialize alert trends chart if canvas exists
        if (document.getElementById('alertChart')) {
            chartManager.createLineChart('alertChart', sampleData.alertTrends);
        }

        // Initialize severity chart if canvas exists
        if (document.getElementById('severityChart')) {
            chartManager.createDoughnutChart('severityChart', sampleData.severityDistribution);
        }

        // Initialize types chart if canvas exists
        if (document.getElementById('typesChart')) {
            chartManager.createBarChart('typesChart', {
                labels: ['Fall', 'Glass Break', 'Smoke', 'No Motion', 'Door Open'],
                datasets: [{
                    label: 'Alert Count',
                    data: [45, 32, 18, 25, 12],
                    backgroundColor: [
                        '#3b82f6',
                        '#8b5cf6',
                        '#ec4899',
                        '#f59e0b',
                        '#10b981'
                    ]
                }]
            });
        }
    }, 500);

    return chartManager;
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCharts);
} else {
    initCharts();
}
