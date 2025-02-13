# bpmnEditor
Trying to create something that will automate the creation of bpmn diagrams as much as possible. Starting with the editor


# BPMN.io Web Editor

A web-based BPMN (Business Process Model and Notation) editor built using BPMN.io. This editor allows you to create, edit, and export business process diagrams with an intuitive interface.

## Features

- 📝 Create and edit BPMN 2.0 diagrams
- 💾 Save and load diagrams
- 🖼️ Export diagrams as SVG or PNG
- 📄 Live XML source code view with syntax highlighting
- ↩️ Undo/Redo functionality
- 📱 Responsive design with collapsible panels

## Getting Started

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, or Edge)
- Web server to host the files (or you can run locally)

### Installation

1. Clone this repository:
```bash
git clone [your-repository-url]
```

2. Place the files on your web server or run locally using a development server.

### Running Locally

You can use any local development server. The project is currently running  fully on client side. So no server is required. Just double click index.html.

## Dependencies

This project uses the following libraries:

- [BPMN.io](https://bpmn.io/) (v9.0.3) - Core BPMN modeling library
- [Bootstrap](https://getbootstrap.com/) (v5.3.3) - UI components and styling
- [Bootstrap Icons](https://icons.getbootstrap.com/) (v1.11.3) - Icon set
- [Highlight.js](https://highlightjs.org/) (v11.9.0) - XML syntax highlighting
- [Fira Code](https://github.com/tonsky/FiraCode) - Monospace font for code display

## Usage

1. **Creating a New Diagram**
   - The editor starts with a blank diagram
   - Use the modeling palette to add BPMN elements
   - Click and drag to connect elements

2. **Saving/Loading**
   - Click "Save" to download your diagram
   - Click "Open" to load an existing BPMN file

3. **Exporting**
   - Use "Export SVG" for vector graphics
   - Use "Export PNG" for raster images

4. **XML Editing**
   - The right panel shows the XML source code
   - Edit the XML directly to modify the diagram
   - XML updates are reflected in real-time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your chosen license here]

## Acknowledgments

- [BPMN.io](https://bpmn.io/) for their excellent BPMN modeling library
- [Camunda](https://camunda.com/) for maintaining BPMN.io