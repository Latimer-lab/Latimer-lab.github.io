// Dynamic theme system with random color variations

class ThemeManager {
    constructor() {
        // Convert #82B1FD to HSL to maintain lightness/saturation
        this.baseHSL = this.rgbToHsl(130, 177, 253); // #82B1FD in HSL
        this.isDark = false;
        this.lastColorChange = 0;
        this.colorChangeDelay = 500; // 500ms between color changes
        this.currentHoverTarget = null;
        this.init();
    }

    init() {
        // Check for saved theme preference or default to light
        const savedTheme = localStorage.getItem('hackly-theme') || 'light';
        this.setTheme(savedTheme);
        
        // Bind theme toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Add hover listeners for dynamic colors (light theme only)
        this.addHoverListeners();

        // Trigger fade-in effect after theme is set
        setTimeout(() => {
            document.body.classList.add('fade-in');
        }, 100);
    }

    rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    generateRandomVariation() {
        // Generate completely random hue (0-360) while keeping the same saturation and lightness as #82B1FD
        const randomHue = Math.random() * 360;
        const { s, l } = this.baseHSL; // Keep original saturation and lightness
        
        const rgb = this.hslToRgb(randomHue, s, l);
        return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }

    updateSecondaryBgColor(targetElement = null) {
        const now = Date.now();
        
        // Check if enough time has passed since last color change
        if (now - this.lastColorChange < this.colorChangeDelay) {
            return;
        }

        // Check if we're hovering the same target element
        if (targetElement && this.currentHoverTarget === targetElement) {
            return;
        }

        if (!this.isDark && !this.hasActiveElements()) {
            const newColor = this.generateRandomVariation();
            document.documentElement.style.setProperty('--color-bg-secondary', newColor);
            this.lastColorChange = now;
            this.currentHoverTarget = targetElement;
        }
    }

    hasActiveElements() {
        // Check if any elements are actively using the secondary background color
        const activeSelectors = [
            '.branch-row.active',
            '.branch-details[style*="max-height"]:not([style*="max-height: 0px"])',
            '.file-tab.active',
            '.panel.expanded .sidebar'
        ];

        return activeSelectors.some(selector => {
            const elements = document.querySelectorAll(selector);
            return elements.length > 0;
        });
    }

    addHoverListeners() {
        // Elements that should trigger color changes on hover (light theme only)
        const selectors = [
            '.branch-row',
            '.file-tab',
            '.login-btn',
            '.theme-toggle',
            '.codebase-link',
            '.search-input',
            '.sort-btn',
            '.panel-tab'
        ];

        selectors.forEach(selector => {
            document.addEventListener('mouseover', (e) => {
                const targetElement = e.target.matches(selector) ? e.target : e.target.closest(selector);
                if (targetElement) {
                    this.updateSecondaryBgColor(targetElement);
                }
            });
        });

        // Reset current hover target when mouse leaves any element
        document.addEventListener('mouseleave', (e) => {
            // Small delay to reset, allowing for smooth transitions between elements
            setTimeout(() => {
                if (!document.querySelector(':hover')) {
                    this.currentHoverTarget = null;
                }
            }, 100);
        });
    }

    setTheme(theme) {
        this.isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = this.isDark ? '☾' : '☼';
        }

        // Apply random dark colors for dark theme
        if (this.isDark) {
            this.applyRandomDarkTheme();
        } else {
            // Reset all dark theme custom properties for light theme
            document.documentElement.style.removeProperty('--color-bg');
            document.documentElement.style.removeProperty('--color-bg-secondary');
            document.documentElement.style.removeProperty('--color-border');
        }

        // Update Monaco editor themes
        this.updateMonacoThemes();

        localStorage.setItem('hackly-theme', theme);
    }

    // Generate random dark colors like coolorsrandom project
    generateRandomDarkColor() {
        const h = Math.floor(Math.random() * 360);      // Random hue
        const s = Math.random() * 50;             // Saturation 20-60% (softer, less vibrant)
        const l = 4 + Math.random() * 6;              // Lightness 8-20% (darker but with more white, like #111111)
        return { h, s, l };
    }

    // Convert HSL to CSS string
    hslToCss(h, s, l) {
        return `hsl(${h} ${s}% ${l}%)`;
    }

    // Apply random dark theme colors
    applyRandomDarkTheme() {
        const darkColor = this.generateRandomDarkColor();
        const { h, s, l } = darkColor;
        
        // Set main background (less dark)
        document.documentElement.style.setProperty('--color-bg', this.hslToCss(h, s, l));
        
        // Set secondary background (slightly lighter)
        document.documentElement.style.setProperty('--color-bg-secondary', this.hslToCss(h, s, l + 3));
        
        // Set border color (even slightly lighter)
        document.documentElement.style.setProperty('--color-border', this.hslToCss(h, s, l + 6));
    }

    toggleTheme() {
        if (this.isDark) {
            // If switching to light theme, just switch
            this.setTheme('light');
        } else {
            // If switching to dark theme, generate new random colors
            this.setTheme('dark');
        }
    }

    // Generate new random dark colors (can be called manually)
    generateNewDarkColors() {
        if (this.isDark) {
            this.applyRandomDarkTheme();
        }
    }

    // Update Monaco editor themes when theme changes
    updateMonacoThemes() {
        const theme = this.isDark ? 'vs-dark' : 'vs';
        console.log(`🎨 ThemeManager: Updating Monaco themes to: ${theme}`);
        
        // Update all existing editors from EditorManager
        if (window.editorManager && window.editorManager.forceUpdateAllThemes) {
            console.log(`🎨 ThemeManager: Using EditorManager's forceUpdateAllThemes method`);
            window.editorManager.forceUpdateAllThemes();
        } else if (window.editorManager && window.editorManager.editorByBranchId) {
            console.log(`🎨 ThemeManager: Found EditorManager, updating ${window.editorManager.editorByBranchId.size} editors`);
            window.editorManager.editorByBranchId.forEach((editor, branchId) => {
                try {
                    if (editor.isDiffEditor && editor.editor) {
                        // Diff editor
                        console.log(`🎨 ThemeManager: Updating diff editor for branch ${branchId}`);
                        editor.editor.updateOptions({ theme: theme });
                    } else if (editor.updateOptions) {
                        // Regular editor
                        console.log(`🎨 ThemeManager: Updating regular editor for branch ${branchId}`);
                        editor.updateOptions({ theme: theme });
                    }
                } catch (e) {
                    console.warn(`⚠️ ThemeManager: Error updating editor for branch ${branchId}:`, e);
                }
            });
        } else {
            console.log(`⚠️ ThemeManager: EditorManager not found, trying legacy window.editorByBranchId`);
            // Fallback to legacy method
            if (window.editorByBranchId) {
                window.editorByBranchId.forEach((editor, branchId) => {
                    try {
                        if (editor.isDiffEditor && editor.editor) {
                            // Diff editor
                            editor.editor.updateOptions({ theme: theme });
                        } else if (editor.updateOptions) {
                            // Regular editor
                            editor.updateOptions({ theme: theme });
                        }
                    } catch (e) {
                        // Editor might not be fully initialized yet
                    }
                });
            }
        }

        // Update modal editor if it exists
        if (window.modalEditor && window.modalEditor.updateOptions) {
            try {
                console.log(`🎨 ThemeManager: Updating modal editor`);
                window.modalEditor.updateOptions({ theme: theme });
            } catch (e) {
                console.warn(`⚠️ ThemeManager: Error updating modal editor:`, e);
            }
        }
        
        console.log(`✅ ThemeManager: Monaco theme update complete`);
    }
}

// Initialize theme manager when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Timer functionality - commented out for future use
/*
class Timer {
    constructor() {
        this.timerElement = document.querySelector('.timer');
        this.init();
    }

    init() {
        if (this.timerElement) {
            this.updateTimer();
            // Update every second for countdown timer
            setInterval(() => this.updateTimer(), 1000);
        }
    }

    updateTimer() {
        const now = new Date();
        
        // TESTING: Use 1-hour countdown instead of 8-hour
        // Set end time to 1 hour from when the timer was first initialized
        if (!this.roundEndTime) {
            this.roundEndTime = new Date(now.getTime() + (60 * 60 * 1000));
        }
        
        const timeLeft = this.roundEndTime.getTime() - now.getTime();
        
        if (timeLeft <= 0) {
            // Round ended - trigger round transition
            this.timerElement.textContent = 'ROUND END';
            this.onRoundEnd();
            return;
        }
        
        const minutes = Math.floor(timeLeft / (60 * 1000));
        const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

        // Format the timer display
        const mins = minutes.toString().padStart(2, '0');
        const secs = seconds.toString().padStart(2, '0');
        
        this.timerElement.textContent = `${mins}:${secs}`;
    }

    onRoundEnd() {
        console.log('🎯 ROUND ENDED - Time to transition!');
        
        // Show notification
        if (this.timerElement) {
            this.timerElement.style.color = '#ff6b6b';
            this.timerElement.style.fontWeight = 'bold';
        }
        
        // Trigger round transition event for other components
        window.dispatchEvent(new CustomEvent('round-ended', {
            detail: { timestamp: new Date().toISOString() }
        }));
        
        // Reset timer for next round after 5 seconds
        setTimeout(() => {
            if (this.timerElement) {
                this.timerElement.style.color = '';
                this.timerElement.style.fontWeight = '';
            }
            // Reset end time and restart the countdown
            this.roundEndTime = null;
            this.updateTimer();
        }, 5000);
    }
}
*/

// Simple clock functionality - shows current hour
class SimpleClock {
    constructor() {
        this.clockElement = document.querySelector('.clock');
        this.init();
    }

    init() {
        if (this.clockElement) {
            this.updateClock();
            // Update every minute (no need for seconds)
            setInterval(() => this.updateClock(), 60000);
        }
    }

    updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Format: HH:MM (24-hour format)
        const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        
        if (this.clockElement) {
            this.clockElement.textContent = formattedTime;
        }
    }
}

// Initialize simple clock when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // window.timer = new Timer(); // Commented out
    window.simpleClock = new SimpleClock(); // New simple clock
});
