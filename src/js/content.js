function createTooltip() {
  const tooltip = document.createElement('div');
  tooltip.className = 'katex-tooltip';
  tooltip.innerHTML = `
    <div class="tooltip-arrow"></div>
    <span class="tooltip-content">Copy</span>
  `;
  return tooltip;
}

function setupEquation(equation) {
  const tooltip = createTooltip();
  document.body.appendChild(tooltip);

  // Create a wrapper div if it doesn't exist
  let wrapper = equation.parentElement.querySelector('.katex-wrapper');
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = 'katex-wrapper';
    equation.parentElement.insertBefore(wrapper, equation);
    wrapper.appendChild(equation);
  }

  function updateTooltipPosition() {
    const rect = wrapper.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + 5}px`;
    tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
  }

  wrapper.addEventListener('mouseenter', (event) => {
    wrapper.classList.add('katex-hover');
    tooltip.style.display = 'block';
    updateTooltipPosition();
  });

  wrapper.addEventListener('mouseleave', (event) => {
    wrapper.classList.remove('katex-hover');
    tooltip.style.display = 'none';
  });
    
  // Turn green on mousedown
  wrapper.addEventListener('mousedown', () => {
    wrapper.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
  });

  // Add retry utility function at the top of the file
  async function retryOperation(operation, maxAttempts = 3, delay = 500) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Add new recovery mechanism
  async function reinitializeExtension() {
    
    // Wait a bit to allow context to potentially recover
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if context is available
    if (chrome?.runtime?.id) {
      initialize();
      return true;
    }
    return false;
  }

  // Update the mouseup event handler
  wrapper.addEventListener('mouseup', async () => {
    try {
      // Enhanced context validation with recovery attempt
      if (!chrome?.runtime?.id) {
        tooltip.querySelector('.tooltip-content').textContent = 'Recovering...';
        updateTooltipPosition();
        
        const recovered = await reinitializeExtension();
        if (!recovered) {
          throw new Error('Extension context invalidated - please refresh the page');
        }
      }

      // Try to get format with enhanced retries
      const format = await retryOperation(async () => {
        if (!chrome?.storage?.sync) {
          // Attempt recovery before giving up
          const recovered = await reinitializeExtension();
          if (!recovered) {
            throw new Error('Extension storage not available - try refreshing the page');
          }
        }
        return await chrome.storage.sync.get('format');
      }, 5, 1000); // Increased retries and delay for better recovery chance

      let mathmlContent;
      if (format.format === 'latex') {
        mathmlContent = equation.closest('.katex').querySelector('annotation').innerHTML;
      } else {
        // Get the complete MathML structure
        const mathElement = equation.closest('.katex').querySelector('.katex-mathml math');
        if (!mathElement) {
          console.error('MathML element not found');
          throw new Error('MathML element not found');
        }
        
        
        // Create initial XML template
        const template = `<mml:math xmlns:mml="http://www.w3.org/1998/Math/MathML" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"></mml:math>`;
        
        // Parse the template
        const parser = new DOMParser();
        const doc = parser.parseFromString(template, 'application/xml');
        const mathRoot = doc.documentElement;
        
        // Function to create elements with mml prefix
        function createMmlElement(doc, name) {
          return doc.createElementNS("http://www.w3.org/1998/Math/MathML", `mml:${name}`);
        }
        
        // Function to copy element with proper namespace
        function copyElement(sourceElement, doc) {
          // Get the base name without any prefix
          const name = sourceElement.tagName.toLowerCase().replace(/^(?:mml:|ns\d+:)?/, '');
          
          // Special handling for mrow containing cases
          if (name === 'mrow') {
            const firstChild = sourceElement.firstElementChild;
            if (firstChild && 
                firstChild.tagName.toLowerCase().replace(/^(?:mml:|ns\d+:)?/, '') === 'mo' && 
                firstChild.getAttribute('fence') === 'true' && 
                firstChild.textContent === '{') {
              const mfenced = createMmlElement(doc, 'mfenced');
              mfenced.setAttribute('open', '{');
              mfenced.setAttribute('close', '');
              mfenced.setAttribute('separators', '|');
              
              const mrow = createMmlElement(doc, 'mrow');
              const mtable = createMmlElement(doc, 'mtable');
              
              // Find the mtable
              const mtableElement = sourceElement.querySelector('mtable');
              if (mtableElement) {
                // Process each row
                Array.from(mtableElement.children).forEach(tr => {
                  const newTr = createMmlElement(doc, 'mtr');
                  const newTd = createMmlElement(doc, 'mtd');
                  const newRow = createMmlElement(doc, 'mrow');
                  
                  // Add alignment group
                  const maligngroup = createMmlElement(doc, 'maligngroup');
                  newRow.appendChild(maligngroup);
                  
                  // Copy the expression part
                  const tds = tr.children;
                  if (tds[0]) {
                    Array.from(tds[0].children).forEach(child => {
                      newRow.appendChild(copyElement(child, doc));
                    });
                  }
                  
                  // Add comma and space
                  const comma = createMmlElement(doc, 'mo');
                  comma.textContent = ',';
                  const space = createMmlElement(doc, 'mi');
                  space.textContent = ' ';
                  newRow.appendChild(comma);
                  newRow.appendChild(space);
                  newRow.appendChild(space.cloneNode(true));
                  
                  // Add alignment mark
                  const malignmark = createMmlElement(doc, 'malignmark');
                  newRow.appendChild(malignmark);
                  
                  // Add the condition part
                  if (tds[1]) {
                    Array.from(tds[1].children).forEach(child => {
                      if (child.tagName.toLowerCase().replace(/^(?:mml:|ns\d+:)?/, '') !== 'mtext') {
                        newRow.appendChild(copyElement(child, doc));
                      }
                    });
                  }
                  
                  newTd.appendChild(newRow);
                  newTr.appendChild(newTd);
                  mtable.appendChild(newTr);
                });
              }
              
              mrow.appendChild(mtable);
              mfenced.appendChild(mrow);
              return mfenced;
            }
          }
          
          // Special handling for cases structure (remove this part since it's now handled above)
          if (name === 'mo' && sourceElement.getAttribute('fence') === 'true' && sourceElement.textContent === '{') {
            return null;  // Skip processing as it will be handled by the parent mrow
          }
          
          const newElement = createMmlElement(doc, name);
          
          // Copy only necessary attributes
          Array.from(sourceElement.attributes).forEach(attr => {
            if (!attr.name.startsWith('xmlns') && 
                !(attr.name === 'stretchy' && attr.value === 'false') &&
                !(attr.name === 'scriptlevel' || attr.name === 'displaystyle') &&
                attr.name !== 'display') {
              newElement.setAttribute(attr.name, attr.value);
            }
          });
          
          // Add stretchy="true" for integral
          if (name === 'mo' && sourceElement.textContent === '∫') {
            newElement.setAttribute('stretchy', 'true');
          }
          
          // Copy children
          Array.from(sourceElement.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              newElement.appendChild(copyElement(child, doc));
            } else if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
              newElement.appendChild(doc.createTextNode(child.textContent));
            }
          });
          
          return newElement;
        }
        
        // Clone and clean up the structure
        const mainContent = mathElement.querySelector('semantics > :first-child') || mathElement;
        
        // Process elements
        const elements = Array.from(mainContent.children);
        let foundIntegral = false;
        
        elements.forEach((child, index) => {
          if (child.tagName.toLowerCase() === 'msubsup' && 
              child.querySelector('mo')?.textContent === '∫' && 
              !foundIntegral) {
            foundIntegral = true;
            const outerRow = createMmlElement(doc, 'mrow');
            const innerRow = createMmlElement(doc, 'mrow');
            
            // Copy the integral part
            outerRow.appendChild(copyElement(child, doc));
            
            // Copy the remaining elements into inner row
            const remainingElements = elements.slice(index + 1)
              .filter(el => el.tagName.toLowerCase() !== 'mtext');
            
            remainingElements.forEach(el => {
              innerRow.appendChild(copyElement(el, doc));
            });
            
            outerRow.appendChild(innerRow);
            mathRoot.appendChild(outerRow);
          } else if (!foundIntegral) {
            // Copy elements before integral normally
            if (child.tagName.toLowerCase() !== 'mtext') {
              mathRoot.appendChild(copyElement(child, doc));
            }
          }
        });
        
        // Clean up and simplify the MathML structure
        function cleanElement(element) {
          // Remove empty text elements
          if (element.tagName.toLowerCase() === 'mml:mtext') {
            element.parentNode?.removeChild(element);
            return;
          }
          
          // Process children recursively
          Array.from(element.children).forEach(child => {
            cleanElement(child);
          });
        }
        
        // Clean up the structure
        cleanElement(mathRoot);
        
        // Convert to string
        const serializer = new XMLSerializer();
        mathmlContent = serializer.serializeToString(doc)
          .replace(/xmlns:ns\d+="[^"]*"/g, '')
          .replace(/ns\d+:/g, 'mml:')
          .replace(/\s+/g, ' ')
          .trim();
      }
        
      wrapper.style.backgroundColor = '';
      if (mathmlContent) {
        navigator.clipboard.writeText(mathmlContent).then(() => {
          wrapper.classList.add('copy-success');
          tooltip.querySelector('.tooltip-content').textContent = 'Copied!';
          updateTooltipPosition();
          setTimeout(() => {
            wrapper.classList.remove('copy-success');
            tooltip.querySelector('.tooltip-content').textContent = 'Copy';
            updateTooltipPosition();
            tooltip.style.display = 'none';
          }, 800);
        }).catch(err => {
          console.error('Failed to copy to clipboard:', err);
          wrapper.classList.add('copy-error');
          tooltip.querySelector('.tooltip-content').textContent = 'Failed to copy';
          updateTooltipPosition();
          setTimeout(() => {
            wrapper.classList.remove('copy-error');
            tooltip.querySelector('.tooltip-content').textContent = 'Copy';
            updateTooltipPosition();
          }, 800);
        });
      }
    } catch (error) {
      console.error('Error processing equation:', error);
      wrapper.style.backgroundColor = '';
      wrapper.classList.add('copy-error');
      
      // Show appropriate error message based on error type
      let errorMessage;
      if (error.message.includes('context invalidated')) {
        errorMessage = 'Extension needs refresh - please reload the page';
      } else if (error.message.includes('storage not available')) {
        errorMessage = 'Storage error - try refreshing the page';
      } else if (error.message.includes('Cannot read properties')) {
        errorMessage = 'Extension error - please refresh the page';
      } else {
        errorMessage = 'Failed to copy - try refreshing the page';
      }
      
      tooltip.querySelector('.tooltip-content').textContent = errorMessage;
      updateTooltipPosition();
      tooltip.style.display = 'block';
      
      // For context invalidation, suggest refresh more prominently
      if (error.message.includes('context invalidated')) {
        setTimeout(() => {
          tooltip.querySelector('.tooltip-content').textContent = 'Click anywhere to refresh';
          updateTooltipPosition();
          
          // Add one-time click listener for refresh
          const refreshHandler = () => {
            window.location.reload();
            document.removeEventListener('click', refreshHandler);
          };
          document.addEventListener('click', refreshHandler);
        }, 2000);
      } else {
        // Normal error reset
        setTimeout(() => {
          wrapper.classList.remove('copy-error');
          tooltip.querySelector('.tooltip-content').textContent = 'Copy';
          updateTooltipPosition();
          tooltip.style.display = 'none';
        }, 2000);
      }
    }
  });

}

function initialize() {
    
    // Validate extension context before proceeding
    if (!chrome?.runtime?.id) {
      reinitializeExtension().then(recovered => {
        if (!recovered) {
          return;
        }
      });
      return;
    }
    
    // Select all KaTeX elements
    const equations = document.querySelectorAll('.katex-html:not([data-katex-processed])');
    
    equations.forEach(equation => {
        setupEquation(equation);
        equation.setAttribute('data-katex-processed', 'true');
    });

    // Add mutation observer for new equations
    const observer = new MutationObserver(mutations => {
        const newEquations = document.querySelectorAll('.katex-html:not([data-katex-processed])');
        if (newEquations.length > 0) {
            newEquations.forEach(equation => {
                setupEquation(equation);
                equation.setAttribute('data-katex-processed', 'true');
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Hide all tooltips on scroll
window.addEventListener('wheel', () => {
  const tooltips = document.querySelectorAll('.katex-tooltip');
  tooltips.forEach(tooltip => {
    tooltip.style.display = 'none';
  });
  const equations = document.querySelectorAll('.katex-html');
  equations.forEach(equation => {
    equation.classList.remove('katex-hover');
  });
}, { passive: true });