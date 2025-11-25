// Mobile Navigation Handler
export function initMobileNav() {
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileNavDrawer = document.getElementById('mobileNavDrawer');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const mobileNavClose = document.getElementById('mobileNavClose');
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');

    if (!mobileMenuButton || !mobileNavDrawer || !mobileNavOverlay) {
        return; // Not on a page with mobile nav
    }

    // Open mobile menu
    function openMobileMenu() {
        mobileNavDrawer.classList.add('open');
        mobileNavOverlay.classList.add('open');
        mobileMenuButton.classList.add('active');
        mobileMenuButton.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    }

    // Close mobile menu
    function closeMobileMenu() {
        mobileNavDrawer.classList.remove('open');
        mobileNavOverlay.classList.remove('open');
        mobileMenuButton.classList.remove('active');
        mobileMenuButton.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    }

    // Toggle mobile menu
    mobileMenuButton.addEventListener('click', () => {
        if (mobileNavDrawer.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });

    // Close menu when clicking overlay
    mobileNavOverlay.addEventListener('click', closeMobileMenu);

    // Close menu when clicking close button
    if (mobileNavClose) {
        mobileNavClose.addEventListener('click', closeMobileMenu);
    }

    // Handle mobile nav item clicks
    mobileNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const section = e.currentTarget.getAttribute('data-section');
            
            // Update active state in mobile nav
            mobileNavItems.forEach(navItem => navItem.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Trigger the desktop nav item click
            const desktopNavItem = document.querySelector(`.nav-bar .nav-item[data-section="${section}"]`);
            if (desktopNavItem) {
                desktopNavItem.click();
            }
            
            // Close mobile menu
            closeMobileMenu();
        });
    });

    // Close menu on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
            closeMobileMenu();
        }
    });

    // Sync mobile nav with desktop nav
    const desktopNavItems = document.querySelectorAll('.nav-bar .nav-item');
    desktopNavItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const section = e.currentTarget.getAttribute('data-section');
            
            // Update mobile nav active state
            mobileNavItems.forEach(mobileItem => {
                if (mobileItem.getAttribute('data-section') === section) {
                    mobileItem.classList.add('active');
                } else {
                    mobileItem.classList.remove('active');
                }
            });
        });
    });
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}
