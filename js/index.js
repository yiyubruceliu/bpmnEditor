// Make modeler available globally for other modules
window.modeler = new BpmnJS({
    container: '#canvas'
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
function updateHighlighting(code) {
    const highlightedCode = document.querySelector('.xml-highlighted code');
    if (highlightedCode) {
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
            updateHighlighting(formattedXml);
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
        updateHighlighting(formattedXml);
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