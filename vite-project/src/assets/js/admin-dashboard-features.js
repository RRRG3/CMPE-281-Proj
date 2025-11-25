// Admin Dashboard Feature Integration
// Charts, Search & Filter, Export functionality

import { initCharts } from './charts.js';
import { initSearchFilter } from './search-filter.js';
import { initExportSystem } from './export-reports.js';

// Initialize all features
document.addEventListener('DOMContentLoaded', () => {
    console.log('[admin] Initializing advanced features...');
    
    // Initialize chart system
    const chartManager = initCharts();
    
    // Initialize export system
    const { exportManager } = initExportSystem();
    
    // Prepare tenant data for export
    window.tenantsData = [
        {
            'Tenant ID': 'T-001',
            'Name': 'Johnson Residence',
            'Devices': '8 devices',
            'Status': 'Active',
            'Alerts (30d)': '32 alerts'
        },
        {
            'Tenant ID': 'T-002',
            'Name': 'Green Valley Senior',
            'Devices': '12 devices',
            'Status': 'Active',
            'Alerts (30d)': '45 alerts'
        },
        {
            'Tenant ID': 'T-003',
            'Name': 'Sunrise Assisted',
            'Devices': '24 devices',
            'Status': 'Active',
            'Alerts (30d)': '67 alerts'
        },
        {
            'Tenant ID': 'T-004',
            'Name': 'Oak Tree Manor',
            'Devices': '6 devices',
            'Status': 'Trial',
            'Alerts (30d)': '18 alerts'
        }
    ];
    
    // Prepare audit logs data for export
    window.auditLogsData = [
        {
            'Timestamp': '2025-11-12 21:45:32',
            'User': 'admin@example.com',
            'Action': 'LOGIN',
            'Resource': 'Admin Dashboard',
            'Status': 'Success',
            'IP Address': '192.168.1.100'
        },
        {
            'Timestamp': '2025-11-12 21:30:15',
            'User': 'system',
            'Action': 'ALERT_CREATED',
            'Resource': 'Alert ID: abc123',
            'Status': 'Success',
            'IP Address': '10.0.1.50'
        },
        {
            'Timestamp': '2025-11-12 21:15:08',
            'User': 'owner@johnson.com',
            'Action': 'DEVICE_CONFIGURED',
            'Resource': 'Device: DEV-LR-001',
            'Status': 'Success',
            'IP Address': '73.45.123.89'
        },
        {
            'Timestamp': '2025-11-12 21:00:42',
            'User': 'system',
            'Action': 'FIRMWARE_UPDATE',
            'Resource': 'Device: DEV-KIT-003',
            'Status': 'Success',
            'IP Address': '10.0.1.50'
        },
        {
            'Timestamp': '2025-11-12 20:45:19',
            'User': 'admin@example.com',
            'Action': 'TENANT_CREATED',
            'Resource': 'Tenant: T-005',
            'Status': 'Success',
            'IP Address': '192.168.1.100'
        },
        {
            'Timestamp': '2025-11-12 20:30:55',
            'User': 'system',
            'Action': 'BACKUP_COMPLETED',
            'Resource': 'Database: smarthome',
            'Status': 'Success',
            'IP Address': '10.0.1.50'
        }
    ];
    
    // Initialize search & filter for audit logs
    let logsSearchSystem = null;
    
    // Listen for section changes
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Initialize search when logs section is shown
            if (section === 'logs' && !logsSearchSystem) {
                logsSearchSystem = initSearchFilter(
                    window.auditLogsData,
                    ['User', 'Action', 'Resource', 'Status', 'IP Address']
                );
                
                // Listen for search results
                document.addEventListener('searchResults', (e) => {
                    updateLogsTable(e.detail);
                });
            }
        });
    });
    
    // Update logs table with search results
    function updateLogsTable(results) {
        const logsTable = document.querySelector('#logsTable tbody');
        if (!logsTable) return;
        
        logsTable.innerHTML = '';
        
        if (results.length === 0) {
            logsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">No results found</td></tr>';
            return;
        }
        
        results.forEach((log) => {
            const tr = document.createElement('tr');
            
            const statusBadge = log.Status === 'Success' ? 'success' : 'danger';
            
            tr.innerHTML = `
                <td>${log.Timestamp}</td>
                <td>${log.User}</td>
                <td>${log.Action}</td>
                <td>${log.Resource}</td>
                <td><span class="badge ${statusBadge}">${log.Status}</span></td>
                <td>${log['IP Address']}</td>
            `;
            logsTable.appendChild(tr);
        });
    }
    
    console.log('[admin] Advanced features initialized');
});
