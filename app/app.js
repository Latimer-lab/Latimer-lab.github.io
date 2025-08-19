// Column panel toggle logic with URL routing
document.addEventListener('DOMContentLoaded', () => {
  const panels = Array.from(document.querySelectorAll('.panel'));
  const burgerToggle = document.getElementById('burger-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  
  // Timer functionality
  function updateTimer() {
    const now = new Date();
    const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
    
    // Calculate time until next 12-hour reset (00:00 or 12:00 UTC)
    const hours = utc.getUTCHours();
    const minutes = utc.getUTCMinutes();
    const seconds = utc.getUTCSeconds();
    
    let targetHour = 0;
    if (hours >= 12) {
      targetHour = 24; // Next day 00:00
    } else {
      targetHour = 12; // Same day 12:00
    }
    
    const totalSecondsUntilReset = (targetHour - hours) * 3600 - minutes * 60 - seconds;
    
    const hoursLeft = Math.floor(totalSecondsUntilReset / 3600);
    const minutesLeft = Math.floor((totalSecondsUntilReset % 3600) / 60);
    const secondsLeft = totalSecondsUntilReset % 60;
    
    const timerElement = document.getElementById('timer');
    if (timerElement) {
      timerElement.textContent = `${hoursLeft.toString().padStart(2, '0')}:${minutesLeft.toString().padStart(2, '0')}:${secondsLeft.toString().padStart(2, '0')}`;
    }
  }
  
  // Update timer every second
  updateTimer();
  setInterval(updateTimer, 1000);

  // Theme functionality
  function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☼ theme' : '☽ theme';
    }
  }

  // Initialize theme
  initTheme();

  // Theme toggle event listener
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  // Mirror theme toggle in mobile menu
  const mobileThemeToggle = document.getElementById('mobile-theme-toggle');
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', () => {
      toggleTheme();
      // Close after toggle for better UX
      if (burgerToggle && mobileMenu) {
        mobileMenu.hidden = true;
        burgerToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function expandPanel(targetPanel) {
    // Remove expanded from all panels
    panels.forEach(panel => panel.classList.remove('expanded'));
    
    // Expand target panel
    targetPanel.classList.add('expanded');
    
    // Update URL - use relative path to avoid protocol issues
    const panelName = targetPanel.getAttribute('data-panel');
    const newUrl = `#${panelName}`;
    history.pushState({ panel: panelName }, '', newUrl);

    // Update mobile menu active state
    const mobileMenuItems = document.querySelectorAll('.mobile-menu .menu-item[data-action="panel"]');
    mobileMenuItems.forEach(item => {
      if (item.getAttribute('data-target') === panelName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Handle panel tab clicks
  panels.forEach(panel => {
    const tab = panel.querySelector('.panel-tab');
    if (!tab) return;
    tab.addEventListener('click', () => expandPanel(panel));
  });

  // Burger toggle behavior
  if (burgerToggle && mobileMenu) {
    burgerToggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('is-open');
      mobileMenu.classList.toggle('is-open');
      burgerToggle.setAttribute('aria-expanded', String(!isOpen));
      if (isOpen) {
        burgerToggle.textContent = '☰';
      } else {
        burgerToggle.textContent = '✕';
      }
    });
  }

  // Mobile menu interactions
  if (mobileMenu) {
    mobileMenu.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      if (action === 'panel') {
        const panelName = target.getAttribute('data-target');
        if (!panelName) return;
        const targetPanel = document.querySelector(`[data-panel="${panelName}"]`);
        if (targetPanel) {
          expandPanel(targetPanel);
          // Close menu after navigation
          mobileMenu.classList.remove('is-open');
          if (burgerToggle) {
            burgerToggle.setAttribute('aria-expanded', 'false');
            burgerToggle.textContent = '☰';
          }
        }
      }
    });
  }

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (event) => {
    const panelName = event.state?.panel || 'projects';
    const targetPanel = document.querySelector(`[data-panel="${panelName}"]`);
    if (targetPanel) {
      expandPanel(targetPanel);
    }
  });

  // Handle direct URL navigation
  function handleInitialRoute() {
    const hash = window.location.hash;
    const panelName = hash.substring(1) || 'projects'; // Default to projects if no hash
    
    const targetPanel = document.querySelector(`[data-panel="${panelName}"]`);
    if (targetPanel) {
      expandPanel(targetPanel);
    } else {
      // Fallback to projects if invalid panel
      const projectsPanel = document.querySelector('[data-panel="projects"]');
      if (projectsPanel) {
        expandPanel(projectsPanel);
      }
    }
  }

  // Initialize with current URL
  handleInitialRoute();

  const sidebar = document.querySelector('.sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const evalSummary = document.getElementById('evalSummary');

  function updateSidebarToggleIcon(isExpanded) {
    if (!sidebarToggle) return;
    sidebarToggle.textContent = isExpanded ? '▼' : '▲';
    sidebarToggle.setAttribute('aria-expanded', String(isExpanded));
  }

  // Copy button removed; no clipboard logic

  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      // Only apply on large screens
      const isDesktop = window.matchMedia('(min-width: 1001px)').matches;
      if (!isDesktop) return;

      const isExpanded = sidebar.classList.toggle('sidebar--expanded');
      updateSidebarToggleIcon(isExpanded);
    });

    // Ensure correct icon on load and when resizing across breakpoints
    const syncSidebarToggle = () => {
      const isDesktop = window.matchMedia('(min-width: 1001px)').matches;
      if (!isDesktop) {
        // Reset on mobile to default (not expanded)
        sidebar.classList.remove('sidebar--expanded');
        updateSidebarToggleIcon(false);
      } else {
        updateSidebarToggleIcon(sidebar.classList.contains('sidebar--expanded'));
      }
    };

    syncSidebarToggle();
    window.addEventListener('resize', syncSidebarToggle);
  }
});


