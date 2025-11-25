/**
 * Skeleton Loading Manager
 * Applies skeleton loading states to dashboard components
 */

export const SkeletonLoader = {
    // Replace content with skeleton structure
    show(containerId, type = 'list') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Save original content height to prevent layout shift if possible
        const height = container.offsetHeight;
        container.style.minHeight = height > 0 ? `${height}px` : '200px';
        
        let skeletonHTML = '';

        if (type === 'list') {
            // Create list items skeleton
            for (let i = 0; i < 5; i++) {
                skeletonHTML += `
                    <div class="skeleton-item" style="padding: 1rem; display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--gray-200);">
                        <div class="skeleton skeleton-circle" style="width: 40px; height: 40px;"></div>
                        <div style="flex: 1;">
                            <div class="skeleton skeleton-text" style="width: 60%; height: 16px; margin-bottom: 8px;"></div>
                            <div class="skeleton skeleton-text" style="width: 40%; height: 12px;"></div>
                        </div>
                        <div class="skeleton skeleton-rect" style="width: 80px; height: 24px; border-radius: 12px;"></div>
                    </div>
                `;
            }
        } else if (type === 'card') {
            // KPI card skeleton
            skeletonHTML = `
                <div class="skeleton skeleton-text" style="width: 40%; margin-bottom: 1rem;"></div>
                <div class="skeleton skeleton-text" style="width: 80%; height: 3rem; margin-bottom: 0.5rem;"></div>
                <div class="skeleton skeleton-text" style="width: 60%;"></div>
            `;
        } else if (type === 'table') {
            // Table skeleton
            skeletonHTML = `
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    ${Array(5).fill(0).map(() => `
                        <div style="display: flex; gap: 1rem;">
                            <div class="skeleton skeleton-text" style="width: 15%;"></div>
                            <div class="skeleton skeleton-text" style="width: 25%;"></div>
                            <div class="skeleton skeleton-text" style="width: 20%;"></div>
                            <div class="skeleton skeleton-text" style="width: 15%;"></div>
                            <div class="skeleton skeleton-text" style="width: 10%;"></div>
                            <div class="skeleton skeleton-text" style="width: 15%;"></div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (type === 'chart') {
            skeletonHTML = `
                <div style="display: flex; align-items: flex-end; height: 100%; gap: 1rem; padding: 1rem;">
                    ${Array(7).fill(0).map(() => {
                        const height = Math.floor(Math.random() * 60) + 20;
                        return `<div class="skeleton skeleton-rect" style="height: ${height}%; width: 100%; border-radius: 4px 4px 0 0;"></div>`;
                    }).join('')}
                </div>
            `;
        }

        container.innerHTML = skeletonHTML;
        container.classList.add('skeleton-active');
    },

    // Remove skeleton and show real content
    hide(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.style.minHeight = '';
        container.classList.remove('skeleton-active');
        // Content will be replaced by the actual render function
    }
};
