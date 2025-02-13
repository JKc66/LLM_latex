document.addEventListener('DOMContentLoaded', function() {
    // Get the buttons
    const latexButton = document.getElementById('format1');
    const mathmlButton = document.getElementById('format2');
    
    // Add event listeners to buttons
    latexButton.addEventListener('click', function() {
        chrome.storage.sync.set({ format: 'latex' }, function() {
            updateButtonStyles('latex');
        });
    });
    
    mathmlButton.addEventListener('click', function() {
        chrome.storage.sync.set({ format: 'mathml' }, function() {
            updateButtonStyles('mathml');
        });
    });
    
    // Function to update button styles
    function updateButtonStyles(selectedFormat) {
        // Remove selected class from all buttons
        latexButton.classList.remove('button-selected');
        mathmlButton.classList.remove('button-selected');
        
        // Add selected class to active button
        if (selectedFormat === 'latex') {
            latexButton.classList.add('button-selected');
        } else if (selectedFormat === 'mathml') {
            mathmlButton.classList.add('button-selected');
        }
    }
    
    // Initialize with stored format or default to 'mathml'
    chrome.storage.sync.get('format', function(result) {
        const storedFormat = result.format || 'mathml';
        updateButtonStyles(storedFormat);
    });
});