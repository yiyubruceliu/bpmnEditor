const fs = require('fs');
const path = require('path');

// Function to read file content
function readFileContent(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return '';
    }
}

// Function to inline CSS
function inlineCSS(html) {
    const localCssRegex = /<link rel="stylesheet" href="(css\/[^"]+)">/g;
    let match;
    
    while ((match = localCssRegex.exec(html)) !== null) {
        const cssPath = path.join(__dirname, match[1]);
        const cssContent = readFileContent(cssPath);
        html = html.replace(
            match[0],
            `<style>\n${cssContent}\n</style>`
        );
    }
    
    return html;
}

// Function to inline JavaScript
function inlineJS(html) {
    const localJsRegex = /<script src="(js\/[^"]+)"><\/script>/g;
    let match;
    
    while ((match = localJsRegex.exec(html)) !== null) {
        const jsPath = path.join(__dirname, match[1]);
        const jsContent = readFileContent(jsPath);
        html = html.replace(
            match[0],
            `<script>\n${jsContent}\n</script>`
        );
    }
    
    return html;
}

// Main function
function compile() {
    console.log('Starting compilation...');
    
    // Read the original index.html
    const indexPath = path.join(__dirname, 'index.html');
    let html = readFileContent(indexPath);
    
    // Inline CSS and JS
    html = inlineCSS(html);
    html = inlineJS(html);
    
    // Add production comment
    html = `<!-- 
    This is an automatically generated production version of index.html
    All local CSS and JavaScript files have been inlined
    Generated on: ${new Date().toISOString()}
-->\n` + html;
    
    // Write the production file
    const outputPath = path.join(__dirname, 'bpmnEditor.prod.html');
    fs.writeFileSync(outputPath, html);
    
    console.log('Compilation complete! Created index.prod.html');
}

// Run the compilation
compile(); 