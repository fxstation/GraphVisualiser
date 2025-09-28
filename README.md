# Interactive Tree Visualizer

A web-based application for interactively creating, editing, and visualizing tree structures with drag-and-drop functionality.

## Features

- **Interactive Tree Editing**: Add and remove nodes dynamically.
- **Editable Node Properties**: Customize node names, power values, and colors.
- **Computed Attributes**: Automatically calculate 'Child Power' and 'Total Power' for each node.
- **Drag-and-Drop Reassignment**: Move nodes to reassign parents by dragging and dropping.
- **Visual Customization**: Nodes auto-size to fit text, with configurable colors.
- **Display Options**: Choose which attributes to display on nodes.
- **Export/Import**: Save and load tree structures as JSON files.
- **Browser-Based**: No server required; runs entirely in the browser.

## Demo

You can view a live demo by opening `index.html` in a web browser or visiting the [GitHub Pages](https://fxstation.github.io/GraphVisualiser/) if enabled.

## How to Use

1. **Open the App**: Open `index.html` in any modern web browser.
2. **Add Nodes**: Click "Add Node" to create a new child node under the selected node (or root if none selected).
3. **Remove Nodes**: Select a node and click "Remove Node" to delete it (children are reattached to the parent).
4. **Edit Properties**: Click on a node to select it, then use the properties panel to change name, power, or color.
5. **Drag and Drop**: Drag a node and drop it on another to reassign its parent (avoids creating cycles).
6. **Display Options**: Use the checkboxes to show/hide attributes like name, power, etc.
7. **Export/Import**: Click "Export Tree" to download the tree as JSON, or use "Import Tree" to load a saved file.

## Technologies Used

- **HTML/CSS**: Structure and styling.
- **JavaScript**: Core logic and interactivity.
- **D3.js**: Tree layout, SVG rendering, and drag-and-drop.

## Project Structure

- `index.html`: Main HTML file.
- `styles.css`: CSS styles.
- `script.js`: JavaScript code for functionality.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Repository

[GitHub Repository](https://github.com/fxstation/GraphVisualiser)