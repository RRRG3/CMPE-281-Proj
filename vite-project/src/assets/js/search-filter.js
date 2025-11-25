// Advanced Search & Filtering System
// Provides powerful search with filters, saved presets, and autocomplete

export class SearchFilterManager {
    constructor(options = {}) {
        this.data = options.data || [];
        this.searchFields = options.searchFields || [];
        this.filters = new Map();
        this.savedPresets = this.loadPresets();
        this.searchHistory = this.loadSearchHistory();
        this.debounceTimer = null;
    }

    // Debounced search
    search(query, callback, delay = 300) {
        clearTimeout(this.debounceTimer);
        
        this.debounceTimer = setTimeout(() => {
            const results = this.performSearch(query);
            this.addToHistory(query);
            callback(results);
        }, delay);
    }

    // Perform actual search
    performSearch(query) {
        if (!query || query.trim() === '') {
            return this.applyFilters(this.data);
        }

        const lowerQuery = query.toLowerCase();
        const searchResults = this.data.filter(item => {
            return this.searchFields.some(field => {
                const value = this.getNestedValue(item, field);
                return value && value.toString().toLowerCase().includes(lowerQuery);
            });
        });

        return this.applyFilters(searchResults);
    }

    // Get nested object value by path (e.g., 'user.name')
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, prop) => current?.[prop], obj);
    }

    // Add filter
    addFilter(key, value) {
        this.filters.set(key, value);
    }

    // Remove filter
    removeFilter(key) {
        this.filters.delete(key);
    }

    // Clear all filters
    clearFilters() {
        this.filters.clear();
    }

    // Apply all active filters
    applyFilters(data) {
        let filtered = [...data];

        this.filters.forEach((value, key) => {
            if (value === '' || value === null || value === undefined) return;

            filtered = filtered.filter(item => {
                const itemValue = this.getNestedValue(item, key);
                
                if (Array.isArray(value)) {
                    return value.includes(itemValue);
                }
                
                return itemValue === value || itemValue?.toString().toLowerCase().includes(value.toString().toLowerCase());
            });
        });

        return filtered;
    }

    // Get active filters
    getActiveFilters() {
        return Array.from(this.filters.entries()).map(([key, value]) => ({
            key,
            value
        }));
    }

    // Save filter preset
    savePreset(name, filters) {
        this.savedPresets.set(name, filters);
        localStorage.setItem('filterPresets', JSON.stringify(Array.from(this.savedPresets.entries())));
    }

    // Load filter preset
    loadPreset(name) {
        const preset = this.savedPresets.get(name);
        if (preset) {
            this.filters = new Map(preset);
        }
        return preset;
    }

    // Delete preset
    deletePreset(name) {
        this.savedPresets.delete(name);
        localStorage.setItem('filterPresets', JSON.stringify(Array.from(this.savedPresets.entries())));
    }

    // Load presets from localStorage
    loadPresets() {
        try {
            const stored = localStorage.getItem('filterPresets');
            return stored ? new Map(JSON.parse(stored)) : new Map();
        } catch {
            return new Map();
        }
    }

    // Add to search history
    addToHistory(query) {
        if (!query || query.trim() === '') return;
        
        this.searchHistory = this.searchHistory.filter(q => q !== query);
        this.searchHistory.unshift(query);
        this.searchHistory = this.searchHistory.slice(0, 10); // Keep last 10
        
        localStorage.setItem('searchHistory', JSON.stringify(this.searchHistory));
    }

    // Load search history
    loadSearchHistory() {
        try {
            const stored = localStorage.getItem('searchHistory');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }

    // Get search suggestions
    getSuggestions(query, limit = 5) {
        if (!query) return this.searchHistory.slice(0, limit);

        const lowerQuery = query.toLowerCase();
        return this.searchHistory
            .filter(item => item.toLowerCase().includes(lowerQuery))
            .slice(0, limit);
    }

    // Update data source
    updateData(newData) {
        this.data = newData;
    }
}

// UI Helper for Search & Filter
export class SearchFilterUI {
    constructor(searchFilterManager, containerId) {
        this.manager = searchFilterManager;
        this.container = document.getElementById(containerId);
        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
        this.attachEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="search-filter-container">
                <div class="search-box">
                    <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input 
                        type="search" 
                        id="globalSearch" 
                        class="search-input" 
                        placeholder="Search..."
                        autocomplete="off"
                    />
                    <div class="search-suggestions" id="searchSuggestions"></div>
                </div>
                
                <div class="filter-chips" id="filterChips"></div>
                
                <button class="btn btn-secondary" id="advancedFilterBtn">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 16px; height: 16px;">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    Filters
                </button>
            </div>
        `;
    }

    attachEventListeners() {
        const searchInput = document.getElementById('globalSearch');
        const suggestionsDiv = document.getElementById('searchSuggestions');

        if (searchInput) {
            // Search input
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value;
                this.manager.search(query, (results) => {
                    this.onSearchResults(results);
                });

                // Show suggestions
                this.showSuggestions(query);
            });

            // Focus/blur for suggestions
            searchInput.addEventListener('focus', () => {
                this.showSuggestions(searchInput.value);
            });

            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (suggestionsDiv) suggestionsDiv.style.display = 'none';
                }, 200);
            });
        }

        // Advanced filter button
        const filterBtn = document.getElementById('advancedFilterBtn');
        if (filterBtn) {
            filterBtn.addEventListener('click', () => {
                this.showAdvancedFilters();
            });
        }
    }

    showSuggestions(query) {
        const suggestionsDiv = document.getElementById('searchSuggestions');
        if (!suggestionsDiv) return;

        const suggestions = this.manager.getSuggestions(query);
        
        if (suggestions.length === 0) {
            suggestionsDiv.style.display = 'none';
            return;
        }

        suggestionsDiv.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" data-value="${suggestion}">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 16px; height: 16px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ${suggestion}
            </div>
        `).join('');

        suggestionsDiv.style.display = 'block';

        // Click handlers for suggestions
        suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const value = item.getAttribute('data-value');
                document.getElementById('globalSearch').value = value;
                this.manager.search(value, (results) => {
                    this.onSearchResults(results);
                });
                suggestionsDiv.style.display = 'none';
            });
        });
    }

    updateFilterChips() {
        const chipsContainer = document.getElementById('filterChips');
        if (!chipsContainer) return;

        const activeFilters = this.manager.getActiveFilters();
        
        if (activeFilters.length === 0) {
            chipsContainer.innerHTML = '';
            return;
        }

        chipsContainer.innerHTML = activeFilters.map(filter => `
            <div class="filter-chip" data-key="${filter.key}">
                <span>${filter.key}: ${filter.value}</span>
                <button class="chip-remove" data-key="${filter.key}">×</button>
            </div>
        `).join('');

        // Remove filter handlers
        chipsContainer.querySelectorAll('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.getAttribute('data-key');
                this.manager.removeFilter(key);
                this.updateFilterChips();
                this.triggerSearch();
            });
        });
    }

    triggerSearch() {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            this.manager.search(searchInput.value, (results) => {
                this.onSearchResults(results);
            });
        }
    }

    showAdvancedFilters() {
        // Trigger custom event for showing advanced filter modal
        document.dispatchEvent(new CustomEvent('showAdvancedFilters'));
    }

    onSearchResults(results) {
        // Trigger custom event with results
        document.dispatchEvent(new CustomEvent('searchResults', { detail: results }));
    }
}

// Initialize search & filter
export function initSearchFilter(data, searchFields) {
    const manager = new SearchFilterManager({ data, searchFields });
    const ui = new SearchFilterUI(manager, 'searchFilterContainer');
    return { manager, ui };
}
