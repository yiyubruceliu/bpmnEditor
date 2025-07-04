// Make modeler available globally for other modules
window.modeler = new BpmnJS({
    container: '#canvas',
    canvas: {
        deferUpdate: false
    },
    grid: {
        visible: true
    }
});

// Initialize these variables at the top of your file
let lastFileHandle = null; // Store the file handle for saving back to the same location

// Add this check at the start of your file
const hasFileSystemAccess = 'showOpenFilePicker' in window;

// You can use this to modify the UI or show different tooltips
if (!hasFileSystemAccess) {
    console.log('File System Access API not supported - using download fallback');
}

// Add these at the top of your file, after the modeler initialization
class DiagramState {
    constructor(xml, position) {
        this.xml = xml;
        this.position = position;
    }
}

class DiagramHistory {
    constructor() {
        this.states = [];
        this.currentIndex = -1;
        this.maxStates = 50; // Maximum number of states to keep
    }

    async saveState() {
        try {
            const { xml } = await window.modeler.saveXML({ format: true });
            
            // Remove any future states if we're in the middle of the history
            this.states = this.states.slice(0, this.currentIndex + 1);
            
            // Add new state
            this.states.push(new DiagramState(xml, this.currentIndex + 1));
            
            // Remove oldest state if we exceed maxStates
            if (this.states.length > this.maxStates) {
                this.states.shift();
            }
            
            this.currentIndex = this.states.length - 1;
            
            // Update button states
            this.updateUndoRedoButtons();
        } catch (err) {
            console.error('Error saving diagram state:', err);
        }
    }

    async undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            await this.restoreState();
        }
    }

    async redo() {
        if (this.currentIndex < this.states.length - 1) {
            this.currentIndex++;
            await this.restoreState();
        }
    }

    async restoreState() {
        try {
            const state = this.states[this.currentIndex];
            await window.modeler.importXML(state.xml);
            await updateXMLSource();
            this.updateUndoRedoButtons();
        } catch (err) {
            console.error('Error restoring diagram state:', err);
        }
    }

    updateUndoRedoButtons() {
        const undoButton = document.getElementById('undo-btn');
        const redoButton = document.getElementById('redo-btn');
        
        undoButton.disabled = this.currentIndex <= 0;
        redoButton.disabled = this.currentIndex >= this.states.length - 1;
    }
}

// Initialize the diagram history
const diagramHistory = new DiagramHistory();

// Initialize the BPMN diagram
async function initializeBpmn() {
    // Load an empty BPMN diagram to start with
    const emptyBpmn = `<?xml version="1.0" encoding="UTF-8"?>
    <bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
      <bpmn:process id="Process_1" isExecutable="false">
        <bpmn:startEvent id="StartEvent_1"/>
      </bpmn:process>
      <bpmndi:BPMNDiagram id="BPMNDiagram_1">
        <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
          <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
            <dc:Bounds x="152" y="102" width="36" height="36"/>
          </bpmndi:BPMNShape>
        </bpmndi:BPMNPlane>
      </bpmndi:BPMNDiagram>
    </bpmn:definitions>`;

    try {
        await window.modeler.importXML(emptyBpmn);
        // Adjust the view to fit the diagram
        window.modeler.get('canvas').zoom('fit-viewport');
        await updateXMLSource();
        await diagramHistory.saveState(); // Save initial state
    } catch (err) {
        console.error('Error loading BPMN diagram', err);
    }
}

// Call the initialization function
initializeBpmn();
// Replace the load button event listener with this version that handles both modern and legacy approaches
document.getElementById('load-btn').addEventListener('click', async () => {
    if (hasFileSystemAccess) {
        try {
            const [fileHandle] = await window.showOpenFilePicker({
                types: [{
                    description: 'BPMN files',
                    accept: {
                        'application/xml': ['.bpmn']
                    }
                }],
                multiple: false
            });
            
            lastFileHandle = fileHandle;
            const file = await fileHandle.getFile();
            document.getElementById('diagram-title').textContent = file.name;
            document.title = file.name + ' - BPMN.io Editor';

            const text = await file.text();
            await window.modeler.importXML(text);
            await updateXMLSource();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Error selecting file:', err);
            }
        }
    } else {
        // Fallback to traditional file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bpmn';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                document.getElementById('diagram-title').textContent = file.name;
                document.title = file.name + ' - BPMN.io Editor';

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        await window.modeler.importXML(e.target.result);
                        await updateXMLSource();
                    } catch (err) {
                        console.error('Error loading diagram:', err);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
});

// Replace the save button event listener with this version
document.getElementById('save-btn').addEventListener('click', async () => {
    try {
        const { xml } = await window.modeler.saveXML({ format: true });
        
        if (hasFileSystemAccess && lastFileHandle) {
            try {
                const writable = await lastFileHandle.createWritable();
                await writable.write(xml);
                await writable.close();
                document.getElementById('diagram-title').textContent = lastFileHandle.name;
                document.title = lastFileHandle.name + ' - BPMN.io Editor';
                return;
            } catch (err) {
                console.error('Error saving to last location:', err);
                // Fall through to fallback save
            }
        }
        
        // Fallback save method
        const blob = new Blob([xml], { type: 'text/xml' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        
        let fileName = document.getElementById('diagram-title').textContent.trim();
        if (!fileName.toLowerCase().endsWith('.bpmn')) {
            fileName += '.bpmn';
        }
        link.download = fileName;
        document.getElementById('diagram-title').textContent = fileName;
        document.title = fileName + ' - BPMN.io Editor';
        link.click();
        
    } catch (err) {
        console.error('Error saving diagram:', err);
    }
});

// Add a fallback save function for unsupported browsers
async function fallbackSave(xml) {
    const blob = new Blob([xml], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    
    let fileName = document.getElementById('diagram-title').textContent.trim();
    if (!fileName.toLowerCase().endsWith('.bpmn')) {
        fileName += '.bpmn';
    }
    link.download = fileName;
    link.click();
}

// Handle title editing
const titleElement = document.getElementById('diagram-title');

titleElement.addEventListener('keydown', (e) => {
    // Prevent newlines in title
    if (e.key === 'Enter') {
        e.preventDefault();
        titleElement.blur();
    }
});

titleElement.addEventListener('blur', () => {
    let title = titleElement.textContent.trim();
    if (!title) {
        title = 'Untitled Diagram';
    }
    titleElement.textContent = title;
});

// Add SVG export functionality
document.getElementById('save-svg-btn').addEventListener('click', async () => {
    try {
        const { svg } = await window.modeler.saveSVG({ format: true });
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        
        // Use the current diagram name but with .svg extension
        let fileName = document.getElementById('diagram-title').textContent.trim();
        fileName = fileName.replace(/\.bpmn$/, ''); // Remove .bpmn if present
        fileName += '.svg';
        
        link.download = fileName;
        link.click();
    } catch (err) {
        console.error('Error exporting SVG:', err);
    }
});

// Add PNG export functionality
document.getElementById('save-png-btn').addEventListener('click', async () => {
    try {
        const { svg } = await window.modeler.saveSVG({ format: true });
        
        // Create SVG blob
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        // Create Image from SVG
        const img = new Image();
        img.onload = () => {
            // Create canvas with proper dimensions
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size to match the SVG
            canvas.width = img.width;
            canvas.height = img.height;
            
            // Draw white background (SVG default is transparent)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw the image
            ctx.drawImage(img, 0, 0);
            
            // Convert to PNG and download
            canvas.toBlob((blob) => {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                
                // Use the current diagram name but with .png extension
                let fileName = document.getElementById('diagram-title').textContent.trim();
                fileName = fileName.replace(/\.(bpmn|svg)$/, ''); // Remove .bpmn or .svg if present
                fileName += '.png';
                
                link.download = fileName;
                link.click();
                
                // Cleanup
                URL.revokeObjectURL(link.href);
            }, 'image/png');
            
            // Cleanup
            URL.revokeObjectURL(url);
        };
        
        img.onerror = (error) => {
            console.error('Error loading SVG for PNG conversion:', error);
        };
        
        img.src = url;
    } catch (err) {
        console.error('Error exporting PNG:', err);
    }
});

// Panel toggle functionality
document.querySelector('.panel-toggle').addEventListener('click', () => {
    const panel = document.querySelector('.right-panel');
    const canvas = document.querySelector('#canvas');
    
    panel.classList.toggle('collapsed');
    canvas.classList.toggle('full-width');
    
    // Trigger a resize event for the BPMN viewer
    window.modeler.get('canvas').zoom('fit-viewport');
});

// Add this function to handle XML updates from the source editor
async function updateCanvasFromXML() {
    const xmlSource = document.getElementById('xml-source').value;
    try {
        await window.modeler.importXML(xmlSource);
        // Don't call updateXMLSource here to avoid infinite loop
    } catch (err) {
        console.error('Error updating diagram from XML:', err);
        // Revert to previous valid XML
        await updateXMLSource();
    }
}

// Add this function to handle syntax highlighting
async function updateHighlighting(code) {
    const highlightedCode = document.querySelector('.xml-highlighted code');
    if (highlightedCode) {
        // First, remove the data-highlighted attribute
        delete highlightedCode.dataset.highlighted;
        
        // Update the content
        highlightedCode.textContent = code;
        
        // Force highlight.js to re-highlight the code
        hljs.configure({ ignoreUnescapedHTML: true });
        hljs.highlightElement(highlightedCode);
    }
}

// Modify the updateXMLSource function
async function updateXMLSource() {
    const xmlSource = document.getElementById('xml-source');
    if (document.activeElement !== xmlSource) {
        try {
            const { xml } = await window.modeler.saveXML({ format: true });
            xmlSource.value = xml;
            // Ensure the XML is properly formatted before highlighting
            const formattedXml = xml.replace(/></g, '>\n<');
            await updateHighlighting(formattedXml);
        } catch (err) {
            console.error('Error updating XML source:', err);
        }
    }
}

// Add debounce function to limit update frequency
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Modify the XML source input handler
document.getElementById('xml-source').addEventListener('input', 
    debounce(async (e) => {
        const code = e.target.value;
        // Format the XML before highlighting
        const formattedXml = code.replace(/></g, '>\n<');
        await updateHighlighting(formattedXml);
        await updateCanvasFromXML();
    }, 1000)
);

// Add scroll sync between textarea and highlighted code
document.getElementById('xml-source').addEventListener('scroll', (e) => {
    const highlighted = document.querySelector('.xml-highlighted');
    highlighted.scrollTop = e.target.scrollTop;
    highlighted.scrollLeft = e.target.scrollLeft;
});

// Modify the existing event listener for diagram changes
window.modeler.on('commandStack.changed', async () => {
    await updateXMLSource();
    await diagramHistory.saveState();
});

// Add event listeners for undo/redo buttons
document.getElementById('undo-btn').addEventListener('click', () => {
    diagramHistory.undo();
});

document.getElementById('redo-btn').addEventListener('click', () => {
    diagramHistory.redo();
});

// Add keyboard shortcuts for undo/redo
document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey || e.metaKey) { // metaKey for Mac
        if (e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            await diagramHistory.undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
            e.preventDefault();
            await diagramHistory.redo();
        }
    }
});

// Update the expand panel click handler
document.querySelector('.expand-panel').addEventListener('click', () => {
    const panel = document.querySelector('.right-panel');
    const canvas = document.querySelector('#canvas');
    const expandIcon = document.querySelector('.expand-panel i');
    
    // Toggle expanded class
    panel.classList.toggle('expanded');
    
    // Toggle the icon
    if (panel.classList.contains('expanded')) {
        expandIcon.classList.remove('bi-arrows-fullscreen');
        expandIcon.classList.add('bi-fullscreen-exit');
    } else {
        expandIcon.classList.remove('bi-fullscreen-exit');
        expandIcon.classList.add('bi-arrows-fullscreen');
    }
    
    // Make sure the panel is visible if it was collapsed
    if (panel.classList.contains('collapsed')) {
        panel.classList.remove('collapsed');
        canvas.classList.remove('full-width');
    }
    
    // Trigger a resize event for the BPMN viewer
    window.modeler.get('canvas').zoom('fit-viewport');
});

// Add keyboard shortcut for deletion
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const selection = window.modeler.get('selection');
        const selectedElements = selection.get();
        
        if (selectedElements.length > 0) {
            e.preventDefault(); // Prevent default delete behavior
            
            // Get the context pad
            const contextPad = window.modeler.get('contextPad');
            
            // Get the delete entry from context pad
            const contextPadEntries = contextPad.getEntries(selectedElements[0]);
            const deleteEntry = contextPadEntries['delete'];
            
            // Trigger the delete action if available
            if (deleteEntry && deleteEntry.action) {
                if (typeof deleteEntry.action === 'function') {
                    deleteEntry.action(selectedElements[0]);
                } else if (typeof deleteEntry.action.click === 'function') {
                    deleteEntry.action.click(selectedElements[0]);
                }
            }
        }
    }
});

// Add clipboard functionality
document.addEventListener('keydown', (e) => {
    // Get required services
    const copyPaste = window.modeler.get('copyPaste');
    const selection = window.modeler.get('selection');
    const keyboard = window.modeler.get('keyboard');
    
    // Only handle if we're not in an input/textarea
    if (e.target.matches('input, textarea')) {
        return;
    }

    // Copy: Ctrl/Cmd + C
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        const selectedElements = selection.get();
        if (selectedElements.length > 0) {
            copyPaste.copy(selectedElements);
        }
    }
    
    // Paste: Ctrl/Cmd + V
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        // The copy-paste module handles positioning automatically
        copyPaste.paste();
    }
    
    // Cut: Ctrl/Cmd + X
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault();
        const selectedElements = selection.get();
        if (selectedElements.length > 0) {
            copyPaste.copy(selectedElements);
            // Use the modeling service to remove the elements
            const modeling = window.modeler.get('modeling');
            modeling.removeElements(selectedElements);
        }
    }
});

// Helper function to adjust color opacity (move this outside of any other function)
function adjustColorOpacity(hex) {
    // Remove the # if present
    hex = hex.replace('#', '');
    
    // Convert to a lighter version of the same color
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    // Make it darker by mixing with black
    const lighterR = Math.floor(r * 0.8);
    const lighterG = Math.floor(g * 0.8);
    const lighterB = Math.floor(b * 0.8);
    
    // Convert back to hex
    return '#' + 
        lighterR.toString(16).padStart(2, '0') +
        lighterG.toString(16).padStart(2, '0') +
        lighterB.toString(16).padStart(2, '0');
}

// Custom context pad provider for color picker
function ColorContextPadProvider(contextPad, modeling) {
    console.log('Initializing ColorContextPadProvider');
    this._contextPad = contextPad;
    this._modeling = modeling;
}

ColorContextPadProvider.$inject = [
    'contextPad',
    'modeling'
];

// Function to show color picker popup
function showColorPicker(event, element, modeling) {
    const popup = document.getElementById('color-picker-popup');
    const padPosition = event.target.getBoundingClientRect();
    
    // Position the popup near the context pad
    popup.style.left = `${padPosition.left + padPosition.width + 5}px`;
    popup.style.top = `${padPosition.top}px`;
    popup.style.display = 'block';
    
    // Handle color option clicks
    const handleColorClick = (color, stroke) => {
        if (color === 'none') {
            modeling.setColor(element, {
                stroke: null,
                fill: null
            });
        } else {
            modeling.setColor(element, {
                stroke: element.type.includes('Event') ?
                    stroke ? stroke : adjustColorOpacity(color) :
                    adjustColorOpacity(color),
                fill: element.type.includes('Event') ? 
                    color : color
            });
        }
        popup.style.display = 'none';
    };
    
    // Add click handlers to color options
    document.querySelectorAll('.color-option').forEach(option => {
        option.onclick = () => handleColorClick(option.dataset.color, option.dataset.stroke);
    });
    
    // Handle "More colors" button
    document.querySelector('.more-colors').onclick = () => {
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        
        // Get current color if exists
        if (element.di && element.di.get('stroke')) {
            colorInput.value = element.di.get('stroke');
        }
        
        colorInput.style.position = 'fixed';
        colorInput.style.opacity = '0';
        document.body.appendChild(colorInput);
        
        colorInput.addEventListener('change', (e) => {
            handleColorClick(e.target.value);
            document.body.removeChild(colorInput);
        });
        
        colorInput.click();
        popup.style.display = 'none';
    };
    
    // Close popup when clicking outside
    document.addEventListener('click', function closePopup(e) {
        if (!popup.contains(e.target) && !event.target.contains(e.target)) {
            popup.style.display = 'none';
            document.removeEventListener('click', closePopup);
        }
    });
}

// Update the context pad color picker action
ColorContextPadProvider.prototype.getContextPadEntries = function(element) {
    const modeling = this._modeling;

    if (!element.waypoints) {
        return {
            'custom-color': {
                group: 'edit',
                className: 'entry custom-color bpmn-icon-custom-color',
                title: 'Change color',
                action: {
                    click: function(event, element) {
                        showColorPicker(event, element, modeling);
                    }
                }
            }
        };
    }
    return {};
};

// Wait for modeler to be initialized before registering the provider
window.modeler.on('import.done', () => {
    console.log('Registering ColorContextPadProvider');
    const contextPad = window.modeler.get('contextPad');
    const modeling = window.modeler.get('modeling');
    
    // Create and register the provider
    const colorContextPadProvider = new ColorContextPadProvider(contextPad, modeling);
    contextPad.registerProvider(colorContextPadProvider);

    console.log("contextPad", contextPad);

    // Add keyboard shortcuts initialization
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing keyboard shortcuts');
        
        // Add keyboard shortcuts handlers
        const closeButton = document.getElementById('close-keyboard');
        if (closeButton) {
            console.log('Adding close button handler');
            closeButton.addEventListener('click', () => {
                console.log('Close button clicked');
                document.getElementById('keyboard-shortcuts').style.display = 'none';
            });
        } else {
            console.error('Close button not found');
        }

        // Add overlay click handler
        const overlay = document.getElementById('keyboard-shortcuts');
        if (overlay) {
            console.log('Adding overlay click handler');
            overlay.addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    console.log('Overlay background clicked');
                    e.currentTarget.style.display = 'none';
                }
            });
        } else {
            console.error('Keyboard shortcuts overlay not found');
        }

        // Add toggle button handler
        const toggleButton = document.getElementById('show-shortcuts');
        if (toggleButton) {
            console.log('Adding toggle button handler');
            toggleButton.addEventListener('click', () => {
                console.log('Toggle button clicked');
                toggleKeyboardShortcuts();
            });
        } else {
            console.error('Toggle button not found');
        }
    });
});

// Add multi-selection handler
window.modeler.on('selection.changed', ({ newSelection }) => {
    console.log('Selection changed:', newSelection);
    
    const multiSelectionPanel = document.getElementById('multi-selection-panel');
    const xmlPanel = document.querySelector('.panel-content:not(#multi-selection-panel)');
    
    if (newSelection.length > 1) {
        // Show multi-selection panel
        if (multiSelectionPanel) {
            multiSelectionPanel.style.display = 'block';
            if (xmlPanel) xmlPanel.style.display = 'none';
            
            // Make sure the panel is visible
            const panel = document.querySelector('.right-panel');
            if (panel.classList.contains('collapsed')) {
                panel.classList.remove('collapsed');
                document.querySelector('#canvas').classList.remove('full-width');
            }
        }
    } else {
        // Hide multi-selection panel
        if (multiSelectionPanel) {
            multiSelectionPanel.style.display = 'none';
            if (xmlPanel) xmlPanel.style.display = 'block';
        }
    }
});

// Add handlers for multi-selection actions
document.getElementById('multi-color-btn')?.addEventListener('click', () => {
    const selection = window.modeler.get('selection');
    const modeling = window.modeler.get('modeling');
    const selectedElements = selection.get();
    
    // Create color picker
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.style.position = 'fixed';
    colorInput.style.left = '-1000px';
    colorInput.style.top = '-1000px';
    document.body.appendChild(colorInput);
    
    // Handle color selection
    colorInput.addEventListener('change', (e) => {
        const color = e.target.value;
        selectedElements.forEach(element => {
            modeling.setColor(element, {
                stroke: color,
                fill: element.type.includes('Event') ? color : adjustColorOpacity(color)
            });
        });
        document.body.removeChild(colorInput);
    });
    
    colorInput.click();
});

document.getElementById('multi-delete-btn')?.addEventListener('click', () => {
    const selection = window.modeler.get('selection');
    const modeling = window.modeler.get('modeling');
    const selectedElements = selection.get();
    
    modeling.removeElements(selectedElements);
});

// Add zoom control handlers
document.getElementById('zoom-in')?.addEventListener('click', () => {
    const zoomScroll = window.modeler.get('zoomScroll');
    zoomScroll.stepZoom(1);
});

document.getElementById('zoom-out')?.addEventListener('click', () => {
    const zoomScroll = window.modeler.get('zoomScroll');
    zoomScroll.stepZoom(-1);
});

document.getElementById('zoom-fit')?.addEventListener('click', () => {
    const canvas = window.modeler.get('canvas');
    canvas.zoom('fit-viewport');
});

// Add handlers for multi-selection copy/paste
document.getElementById('multi-copy-btn')?.addEventListener('click', () => {
    const selection = window.modeler.get('selection');
    const copyPaste = window.modeler.get('copyPaste');
    const selectedElements = selection.get();
    
    if (selectedElements.length > 0) {
        copyPaste.copy(selectedElements);
    }
});

document.getElementById('multi-paste-btn')?.addEventListener('click', () => {
    const copyPaste = window.modeler.get('copyPaste');
    copyPaste.paste();
});

// Add keyboard shortcuts overlay toggle
function toggleKeyboardShortcuts() {
    const overlay = document.getElementById('keyboard-shortcuts');
    console.log('Toggling keyboard shortcuts overlay');
    console.log('Current display:', overlay.style.display);
    overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none';
    console.log('New display:', overlay.style.display);
}

// Keep the keyboard shortcut handler at document level
document.addEventListener('keydown', (e) => {
    if (e.key === '?' && (e.ctrlKey || e.metaKey)) {
        console.log('Keyboard shortcut triggered');
        e.preventDefault();
        toggleKeyboardShortcuts();
    }
});

// Add auto-color functionality
let autoColorEnabled = false;

// Function to get most common color for element type
function getMostCommonColor(elementType) {
    const elementRegistry = window.modeler.get('elementRegistry');
    const allElements = elementRegistry.getAll();
    
    // Create a color frequency map for this element type
    const colorFrequency = {};
    
    allElements.forEach(element => {
        if (element.type === elementType && element.di && element.di.get('fill')) {
            const color = element.di.get('fill');
            colorFrequency[color] = (colorFrequency[color] || 0) + 1;
        }
    });
    
    // Find the most common color
    let mostCommonColor = null;
    let highestFrequency = 0;
    
    Object.entries(colorFrequency).forEach(([color, frequency]) => {
        if (frequency > highestFrequency) {
            mostCommonColor = color;
            highestFrequency = frequency;
        }
    });
    
    return mostCommonColor;
}

// Add auto-color toggle handler
document.getElementById('auto-color-toggle')?.addEventListener('change', (e) => {
    autoColorEnabled = e.target.checked;
    console.log('Auto-color toggle changed:', autoColorEnabled);
});

// Add shape create listener with delayed color application
window.modeler.on('shape.added', ({ element }) => {
    if (autoColorEnabled && element.type) {
        // Wait for the next event loop to apply color
        setTimeout(() => {
            try {
                const modeling = window.modeler.get('modeling');
                const commonColor = getMostCommonColor(element.type);
                console.log('Common color:', commonColor);
                if (commonColor) {
                    modeling.setColor(element, {
                        stroke: element.type.includes('Event') ? 
                        adjustColorOpacity(commonColor) : adjustColorOpacity(commonColor),
                        fill: element.type.includes('Event') ? 
                            commonColor : commonColor
                    });
                }
            } catch (error) {
                console.error('Error applying auto-color:', error);
            }
        }, 0);
    }
});

// Add this near the top with other event listeners
window.addEventListener('beforeunload', function(e) {
    // Show confirmation dialog
    return e.preventDefault();
});

// Chat message handling
let chatMessages = [
    { system: "How can I help you?" }
];

function updateChatMessages() {
    const chatMessagesContainer = document.querySelector('.chat-messages');
    chatMessagesContainer.innerHTML = ''; // Clear existing messages

    chatMessages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message';
        
        if (message.system) {
            messageDiv.classList.add('system-message');
            messageDiv.innerHTML = `<div class="message-content">${message.system}</div>`;
        } else if (message.user) {
            messageDiv.classList.add('user-message');
            messageDiv.innerHTML = `<div class="message-content">${message.user}</div>`;
        }
        
        chatMessagesContainer.appendChild(messageDiv);
    });

    // Scroll to bottom
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Send message handler
document.querySelector('.send-message').addEventListener('click', () => {
    const input = document.querySelector('.chat-input');
    const message = input.value.trim();
    
    if (message) {
        chatMessages.push({ user: message });
        input.value = '';
        updateChatMessages();
        setTimeout(() => {
            // Wait 1 second before continuing
        }, 1000);
        systemMessage("This feature is coming soon. Please check in with us later.");
    }
});

function systemMessage(message) {
    chatMessages.push({ system: message });
    updateChatMessages();
}

// Enter key handler
document.querySelector('.chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.querySelector('.send-message').click();
    }
});

// Initialize chat messages
updateChatMessages(); 