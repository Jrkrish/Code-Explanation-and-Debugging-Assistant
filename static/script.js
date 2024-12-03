document.addEventListener('DOMContentLoaded', function () {
    const codeInput = document.getElementById('codeInput');
    const analyzeButton = document.getElementById('analyzeButton');
    const copyButton = document.getElementById('copyButton');
    const outputDisplay = document.getElementById('outputDisplay');
    const tabButtons = document.querySelectorAll('.tab-button');
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    let currentAnalysisType = 'explain';

    // Check and apply the saved theme from localStorage
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i><span>Light Mode</span>';
    } else {
        body.classList.remove('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i><span>Dark Mode</span>';
    }

    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        const isDark = body.classList.contains('dark-theme');

        // Update localStorage with the current theme
        localStorage.setItem('theme', isDark ? 'dark' : 'light');

        // Update the button icon and text
        themeToggle.innerHTML = isDark
            ? '<i class="fas fa-sun"></i><span>Light Mode</span>'
            : '<i class="fas fa-moon"></i><span>Dark Mode</span>';
    });

    // Language detection
    function detectLanguage(code) {
        const languagePatterns = {
            'python': [/def\s+\w+\s*\(/, /class\s+\w+:/, /import\s+\w+/, /#\s*!/],
            'javascript': [/function\s+\w+\s*\(/, /const\s+\w+\s*=/, /class\s+\w+\s*{/, /let\s+\w+\s*=/, /var\s+\w+\s*=/],
            'java': [/public\s+class\s+\w+/, /import\s+\w+\.\w+;/, /private\s+\w+\s+\w+/],
            'cpp': [/#include\s*<\w+>/, /int\s+main\s*\(/, /class\s+\w+\s*{/, /std::/],
            'html': [/<(!DOCTYPE|html|head|body|div|p|a|script)/i, /<\/\w+>/],
            'css': [/\w+\s*{[^}]*}/, /\.[a-z][\w-]*\s*{/, /#[a-z][\w-]*\s*{/],
            'ruby': [/def\s+\w+/, /class\s+\w+\s*<?\s*\w*/, /require\s+['"][\w\/]+['"]/],
            'php': [/<\?php/, /function\s+\w+\s*\(/, /\$\w+\s*=/],
            'swift': [/func\s+\w+\s*\(/, /class\s+\w+\s*{/, /import\s+\w+/],
            'go': [/func\s+\w+\s*\(/, /package\s+\w+/, /import\s+\(/],
            'rust': [/fn\s+\w+\s*\(/, /use\s+\w+::/, /struct\s+\w+/],
            'typescript': [/function\s+\w+\s*\(/, /interface\s+\w+/, /class\s+\w+<.*>/],
            'kotlin': [/fun\s+\w+\s*\(/, /class\s+\w+/, /val\s+\w+:/],
            'scala': [/def\s+\w+\s*\(/, /class\s+\w+/, /object\s+\w+/],
            'r': [/<-/, /function\s*\(/, /library\(/],
            'perl': [/sub\s+\w+/, /use\s+\w+/, /\$\w+\s*=/],
            'shell': [/#!/, /\$\{.*\}/, /\[\s+.*\s+\]/],
            'sql': [/SELECT/, /FROM/, /WHERE/, /INSERT INTO/, /CREATE TABLE/]
        };

        for (const [lang, patterns] of Object.entries(languagePatterns)) {
            if (patterns.some(pattern => pattern.test(code))) {
                return lang;
            }
        }
        return 'unknown'; // default if no language is detected
    }

    // Utility function to escape HTML
    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Tab switching
    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach((btn) => btn.classList.remove('active'));
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Set current analysis type
            currentAnalysisType = button.getAttribute('data-tab');

            // Automatically re-analyze if code exists
            if (codeInput.value.trim()) {
                analyzeCode();
            }
        });
    });

    // Copy button functionality
    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(codeInput.value);
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check"></i><span>Copied!</span>';
        setTimeout(() => {
            copyButton.innerHTML = originalText;
        }, 2000);
    });

    // Analyze code function
    async function analyzeCode() {
        const code = codeInput.value.trim();
        
        if (!code) {
            outputDisplay.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Error</h3>
                    <p>Please enter some code to analyze</p>
                </div>
            `;
            return;
        }

        // Show loading state
        outputDisplay.innerHTML = `
            <div class="loading-state">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Analyzing code...</p>
            </div>
        `;

        // Disable analyze button during processing
        analyzeButton.disabled = true;

        try {
            const language = detectLanguage(code);
            
            const response = await fetch('/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    type: currentAnalysisType,
                    language: language
                })
            });

            const result = await response.json();

            if (result.success) {
                // Enhanced result display based on analysis type
                let displayContent = '';
                
                switch(currentAnalysisType) {
                    case 'explain':
                        displayContent = `
                            <div class="analysis-result">
                                <h3><i class="fas fa-book-open"></i> Code Explanation</h3>
                                <pre>${escapeHtml(result.result)}</pre>
                            </div>
                        `;
                        break;
                    
                    case 'debug':
                        // Handle step-by-step execution results
                        let debugContent;
                        try {
                            const debugData = JSON.parse(result.result);
                            debugContent = `
                                <div class="debug-result">
                                    <h3><i class="fas fa-bug"></i> Debugging Steps</h3>
                                    <p>Total Execution Steps: ${debugData.total_steps}</p>
                                    <ul>
                                        ${debugData.step_details.map(step => 
                                            `<li>${escapeHtml(step)}</li>`
                                        ).join('')}
                                    </ul>
                                </div>
                            `;
                        } catch {
                            // Fallback if parsing fails
                            debugContent = `
                                <div class="debug-result">
                                    <h3><i class="fas fa-bug"></i> Debugging Analysis</h3>
                                    <pre>${escapeHtml(result.result)}</pre>
                                </div>
                            `;
                        }
                        displayContent = debugContent;
                        break;
                    
                    case 'optimize':
                        displayContent = `
                            <div class="optimization-result">
                                <h3><i class="fas fa-magic"></i> Code Optimization Suggestions</h3>
                                <pre>${escapeHtml(result.result)}</pre>
                            </div>
                        `;
                        break;
                }

                outputDisplay.innerHTML = displayContent;

                // Add event listener for optimization apply button
                const applyOptimizationBtn = outputDisplay.querySelector('.apply-optimization');
                if (applyOptimizationBtn) {
                    applyOptimizationBtn.addEventListener('click', () => {
                        codeInput.value = result.result;
                    });
                }
            } else {
                throw new Error(result.error || 'Unknown error occurred');
            }
        } catch (error) {
            outputDisplay.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Analysis Error</h3>
                    <p>${escapeHtml(error.message)}</p>
                </div>
            `;
        } finally {
            // Re-enable analyze button
            analyzeButton.disabled = false;
        }
    }

    // Analyze button event listener
    analyzeButton.addEventListener('click', analyzeCode);
    
    // Optional: Add support for analyzing on Enter key in textarea
    codeInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            analyzeCode();
        }
    });
});

