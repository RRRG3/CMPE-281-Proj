/**
 * Command Palette Module
 * Implements a global command menu for quick navigation and actions.
 */

export class CommandPalette {
    constructor(commands = []) {
        this.isOpen = false;
        this.commands = commands;
        this.filteredCommands = commands;
        this.selectedIndex = 0;
        this.elements = {};
        
        this.init();
    }
    
    init() {
        this.injectHTML();
        this.bindEvents();
        this.registerGlobalShortcut();
    }
    
    injectHTML() {
        const backdrop = document.createElement('div');
        backdrop.className = 'cmd-palette-backdrop';
        backdrop.id = 'cmdBackdrop';
        
        backdrop.innerHTML = `
            <div class="cmd-palette" onclick="event.stopPropagation()">
                <div class="cmd-header">
                    <svg class="cmd-search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" class="cmd-input" placeholder="Type a command or search..." id="cmdInput" autocomplete="off">
                    <span class="cmd-shortcut-hint">ESC</span>
                </div>
                <div class="cmd-body" id="cmdResults">
                    <!-- Results will be injected here -->
                </div>
                <div class="cmd-footer">
                    <div>
                        <span class="key">↑</span> <span class="key">↓</span> to navigate
                        <span class="key" style="margin-left: 8px;">↵</span> to select
                    </div>
                    <div>
                        <span class="key">Cmd</span> + <span class="key">K</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(backdrop);
        
        this.elements = {
            backdrop: document.getElementById('cmdBackdrop'),
            input: document.getElementById('cmdInput'),
            results: document.getElementById('cmdResults')
        };
    }
    
    bindEvents() {
        // Close on backdrop click
        this.elements.backdrop.addEventListener('click', () => this.close());
        
        // Input handling
        this.elements.input.addEventListener('input', (e) => {
            this.filter(e.target.value);
        });
        
        // Keyboard navigation
        this.elements.input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigate(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigate(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.execute();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
    }
    
    registerGlobalShortcut() {
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.isOpen = true;
        this.elements.backdrop.classList.add('open');
        this.elements.input.value = '';
        this.filter('');
        this.elements.input.focus();
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    close() {
        this.isOpen = false;
        this.elements.backdrop.classList.remove('open');
        document.body.style.overflow = '';
    }
    
    filter(query) {
        const normalizedQuery = query.toLowerCase().trim();
        
        if (!normalizedQuery) {
            this.filteredCommands = this.commands;
        } else {
            this.filteredCommands = this.commands.filter(cmd => 
                cmd.title.toLowerCase().includes(normalizedQuery) || 
                (cmd.description && cmd.description.toLowerCase().includes(normalizedQuery)) ||
                (cmd.keywords && cmd.keywords.some(k => k.toLowerCase().includes(normalizedQuery)))
            );
        }
        
        this.selectedIndex = 0;
        this.render();
    }
    
    render() {
        const container = this.elements.results;
        container.innerHTML = '';
        
        if (this.filteredCommands.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--gray-500, #6b7280);">
                    No results found
                </div>
            `;
            return;
        }
        
        // Group by category
        const groups = {};
        this.filteredCommands.forEach(cmd => {
            const group = cmd.category || 'General';
            if (!groups[group]) groups[group] = [];
            groups[group].push(cmd);
        });
        
        let globalIndex = 0;
        
        Object.entries(groups).forEach(([groupName, items]) => {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'cmd-group-title';
            groupTitle.textContent = groupName;
            container.appendChild(groupTitle);
            
            items.forEach(cmd => {
                const el = document.createElement('div');
                el.className = `cmd-item ${globalIndex === this.selectedIndex ? 'selected' : ''}`;
                el.dataset.index = globalIndex;
                
                el.innerHTML = `
                    ${this.getIcon(cmd.icon)}
                    <div class="cmd-item-content">
                        <div class="cmd-item-title">${cmd.title}</div>
                        ${cmd.description ? `<div class="cmd-item-desc">${cmd.description}</div>` : ''}
                    </div>
                `;
                
                el.addEventListener('click', () => {
                    this.selectedIndex = parseInt(el.dataset.index);
                    this.execute();
                });
                
                el.addEventListener('mouseenter', () => {
                    this.updateSelection(parseInt(el.dataset.index));
                });
                
                container.appendChild(el);
                globalIndex++;
            });
        });
    }
    
    getIcon(iconName) {
        // Simple icon mapper - in production use a proper icon system
        const icons = {
            'dashboard': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />',
            'user': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />',
            'settings': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />',
            'alert': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />',
            'logout': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />',
            'moon': '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />'
        };
        
        const path = icons[iconName] || icons['dashboard'];
        
        return `
            <svg class="cmd-item-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                ${path}
            </svg>
        `;
    }
    
    navigate(direction) {
        const newIndex = this.selectedIndex + direction;
        if (newIndex >= 0 && newIndex < this.filteredCommands.length) {
            this.updateSelection(newIndex);
            
            // Scroll into view
            const selectedEl = this.elements.results.querySelector('.selected');
            if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }
    
    updateSelection(index) {
        const items = this.elements.results.querySelectorAll('.cmd-item');
        items.forEach(el => el.classList.remove('selected'));
        
        this.selectedIndex = index;
        const selectedEl = this.elements.results.querySelector(`[data-index="${index}"]`);
        if (selectedEl) {
            selectedEl.classList.add('selected');
        }
    }
    
    execute() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredCommands.length) {
            const cmd = this.filteredCommands[this.selectedIndex];
            this.close();
            if (cmd.action) cmd.action();
        }
    }
}

// Initialize with default commands
export function initCommandPalette() {
    const commands = [
        {
            title: 'Go to Dashboard',
            category: 'Navigation',
            icon: 'dashboard',
            action: () => document.querySelector('[data-section="dashboard"]')?.click()
        },
        {
            title: 'Tenant Management',
            description: 'Manage users and houses',
            category: 'Navigation',
            icon: 'user',
            action: () => document.querySelector('[data-section="tenants"]')?.click()
        },
        {
            title: 'ML Models',
            description: 'Monitor performance and deployments',
            category: 'Navigation',
            icon: 'settings',
            action: () => document.querySelector('[data-section="ml-models"]')?.click()
        },
        {
            title: 'System Health',
            category: 'Navigation',
            icon: 'dashboard',
            action: () => document.querySelector('[data-section="system-health"]')?.click()
        },
        {
            title: 'Audit Logs',
            category: 'Navigation',
            icon: 'dashboard',
            action: () => document.querySelector('[data-section="logs"]')?.click()
        },
        {
            title: 'Toggle Dark Mode',
            category: 'Preferences',
            icon: 'moon',
            action: () => document.getElementById('themeToggle')?.click() || toggleTheme() // Using existing toggle function if available
        },
        {
            title: 'Trigger System Alert',
            description: 'Send emergency broadcast',
            category: 'Actions',
            icon: 'alert',
            action: () => document.getElementById('systemAlertModal').showModal()
        },
        {
            title: 'Log Out',
            category: 'Account',
            icon: 'logout',
            action: () => window.location.href = 'index.html'
        }
    ];
    
    // Add dark mode toggle helper if not global
    const toggleTheme = () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    };
    
    return new CommandPalette(commands);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCommandPalette);
} else {
    initCommandPalette();
}
