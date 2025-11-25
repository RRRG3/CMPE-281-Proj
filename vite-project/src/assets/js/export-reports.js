// Export & Reporting System
// Provides PDF, CSV, Excel export and scheduled reports

export class ExportManager {
    constructor() {
        this.loadLibraries();
    }

    async loadLibraries() {
        // Load jsPDF for PDF generation
        if (typeof jspdf === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script);
        }
    }

    // Export to CSV
    exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) {
            console.error('No data to export');
            return;
        }

        // Get headers from first object
        const headers = Object.keys(data[0]);
        
        // Create CSV content
        let csv = headers.join(',') + '\n';
        
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            });
            csv += values.join(',') + '\n';
        });

        // Create download link
        this.downloadFile(csv, filename, 'text/csv');
        
        return csv;
    }

    // Export to JSON
    exportToJSON(data, filename = 'export.json') {
        const json = JSON.stringify(data, null, 2);
        this.downloadFile(json, filename, 'application/json');
        return json;
    }

    // Export to Excel (CSV with .xlsx extension for Excel compatibility)
    exportToExcel(data, filename = 'export.xlsx') {
        // For true Excel format, you'd need a library like SheetJS
        // This creates a CSV that Excel can open
        return this.exportToCSV(data, filename);
    }

    // Export to PDF
    async exportToPDF(data, options = {}) {
        const {
            filename = 'report.pdf',
            title = 'Report',
            orientation = 'portrait',
            includeDate = true
        } = options;

        // Wait for jsPDF to load
        await this.waitForLibrary('jspdf');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(orientation);

        // Add title
        doc.setFontSize(20);
        doc.text(title, 20, 20);

        // Add date
        if (includeDate) {
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);
        }

        // Add data as table
        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);
            const rows = data.map(item => headers.map(h => item[h]));

            doc.autoTable({
                head: [headers],
                body: rows,
                startY: includeDate ? 35 : 25,
                theme: 'grid',
                styles: {
                    fontSize: 9,
                    cellPadding: 3
                },
                headStyles: {
                    fillColor: [59, 130, 246],
                    fontStyle: 'bold'
                }
            });
        }

        // Save PDF
        doc.save(filename);
    }

    // Generate HTML report
    generateHTMLReport(data, options = {}) {
        const {
            title = 'Report',
            includeDate = true,
            includeStats = true
        } = options;

        let html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body {
                        font-family: 'Inter', -apple-system, sans-serif;
                        max-width: 1200px;
                        margin: 0 auto;
                        padding: 40px 20px;
                        color: #1f2937;
                    }
                    h1 {
                        color: #111827;
                        border-bottom: 3px solid #3b82f6;
                        padding-bottom: 10px;
                    }
                    .meta {
                        color: #6b7280;
                        margin-bottom: 30px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th {
                        background: #3b82f6;
                        color: white;
                        padding: 12px;
                        text-align: left;
                        font-weight: 600;
                    }
                    td {
                        padding: 10px 12px;
                        border-bottom: 1px solid #e5e7eb;
                    }
                    tr:hover {
                        background: #f9fafb;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin: 30px 0;
                    }
                    .stat-card {
                        background: #f3f4f6;
                        padding: 20px;
                        border-radius: 8px;
                        border-left: 4px solid #3b82f6;
                    }
                    .stat-value {
                        font-size: 2em;
                        font-weight: bold;
                        color: #3b82f6;
                    }
                    .stat-label {
                        color: #6b7280;
                        font-size: 0.9em;
                        text-transform: uppercase;
                    }
                    @media print {
                        body { padding: 20px; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
        `;

        if (includeDate) {
            html += `<div class="meta">Generated: ${new Date().toLocaleString()}</div>`;
        }

        if (includeStats && Array.isArray(data)) {
            html += `
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">${data.length}</div>
                        <div class="stat-label">Total Records</div>
                    </div>
                </div>
            `;
        }

        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);
            
            html += '<table><thead><tr>';
            headers.forEach(header => {
                html += `<th>${header}</th>`;
            });
            html += '</tr></thead><tbody>';

            data.forEach(row => {
                html += '<tr>';
                headers.forEach(header => {
                    html += `<td>${row[header]}</td>`;
                });
                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        html += '</body></html>';

        return html;
    }

    // Print report
    printReport(data, options = {}) {
        const html = this.generateHTMLReport(data, options);
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.open();
            printWindow.document.write(html);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 250);
        }
    }

    // Download file helper
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Wait for library to load
    waitForLibrary(libName, maxWait = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (window[libName]) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (Date.now() - startTime > maxWait) {
                    clearInterval(checkInterval);
                    reject(new Error(`${libName} failed to load`));
                }
            }, 100);
        });
    }
}

// Report Scheduler
export class ReportScheduler {
    constructor() {
        this.schedules = this.loadSchedules();
    }

    // Schedule a report
    scheduleReport(config) {
        const schedule = {
            id: Date.now().toString(),
            name: config.name,
            frequency: config.frequency, // 'daily', 'weekly', 'monthly'
            format: config.format, // 'pdf', 'csv', 'excel'
            email: config.email,
            filters: config.filters || {},
            createdAt: new Date().toISOString()
        };

        this.schedules.push(schedule);
        this.saveSchedules();
        return schedule;
    }

    // Get all schedules
    getSchedules() {
        return this.schedules;
    }

    // Delete schedule
    deleteSchedule(id) {
        this.schedules = this.schedules.filter(s => s.id !== id);
        this.saveSchedules();
    }

    // Save to localStorage
    saveSchedules() {
        localStorage.setItem('reportSchedules', JSON.stringify(this.schedules));
    }

    // Load from localStorage
    loadSchedules() {
        try {
            const stored = localStorage.getItem('reportSchedules');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }
}

// Initialize export system
export function initExportSystem() {
    const exportManager = new ExportManager();
    const scheduler = new ReportScheduler();

    // Add export buttons to page
    document.addEventListener('click', (e) => {
        if (e.target.matches('[data-export]')) {
            const format = e.target.getAttribute('data-export');
            const dataAttr = e.target.getAttribute('data-export-source');
            
            // Get data from window or custom source
            const data = window[dataAttr] || [];
            
            switch (format) {
                case 'csv':
                    exportManager.exportToCSV(data, `export-${Date.now()}.csv`);
                    break;
                case 'excel':
                    exportManager.exportToExcel(data, `export-${Date.now()}.xlsx`);
                    break;
                case 'pdf':
                    exportManager.exportToPDF(data, { filename: `report-${Date.now()}.pdf` });
                    break;
                case 'print':
                    exportManager.printReport(data);
                    break;
            }
        }
    });

    return { exportManager, scheduler };
}

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExportSystem);
} else {
    initExportSystem();
}
