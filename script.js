let treeData = {
    id: 0,
    name: "Root",
    power: 0,
    color: "#ffffff",
    location: "",
    note: "",
    children: [],
    displayOptions: {
        name: true,
        power: true,
        child_power: true,
        total_power: true,
        location: true,
        note: true
    }
};

let draggedNode = null;
let dropTarget = null;
let selectedNode = null;
let nodeIdCounter = 1;
let displayAttributes = ['name', 'power', 'child_power', 'total_power', 'location', 'note'];
let root;
let isDragging = false;
let isPanning = false;
let panStart = null;
let panTransform = {x: 0, y: 0};
let zoomLevel = 1;
let panOffset = {x: 0, y: 0};

const svg = d3.select("#tree-svg");
const width = window.innerWidth - 400;
const height = window.innerHeight;

svg.attr("width", width).attr("height", height);

const g = svg.append("g").attr("transform", "translate(40,0)");

const treeLayout = d3.tree(); // Remove fixed size here

function updateTree() {
    // Compute child_power and total_power
    function computePowers(node) {
        if (node.children.length === 0) {
            node.child_power = 0;
            node.total_power = node.power;
        } else {
            node.child_power = node.children.reduce((sum, child) => {
                computePowers(child);
                return sum + child.total_power;
            }, 0);
            node.total_power = node.child_power + node.power;
        }
        // Ensure new attributes exist
        if (node.location === undefined) node.location = "";
        if (node.note === undefined) node.note = "";
        if (!node.displayOptions) {
            node.displayOptions = {};
            displayAttributes.forEach(attr => node.displayOptions[attr] = true);
        }
    }
    computePowers(treeData);

    // Update tree layout
    root = d3.hierarchy(treeData);
    // Calculate dynamic size based on node count and depth
    const allNodes = root.descendants();
    const maxDepth = Math.max(...allNodes.map(n => n.depth));
    // Count max nodes at any depth (breadth)
    const depthCounts = {};
    allNodes.forEach(n => {
        depthCounts[n.depth] = (depthCounts[n.depth] || 0) + 1;
    });
    const maxBreadth = Math.max(...Object.values(depthCounts));
    const nodeHeight = 80;
    const nodeWidth = 220;
    // Estimate vertical spacing to avoid overlap
    const minVerticalSpacing = nodeHeight + 20;
    const minHorizontalSpacing = nodeWidth + 20;
    // Set tree layout size so nodes do not overlap
    const svgHeight = Math.max(maxBreadth * minVerticalSpacing, 600);
    const svgWidth = Math.max((maxDepth + 2) * minHorizontalSpacing, 800);
    
    const margin = 40;
    treeLayout.size([svgHeight - (2*margin), svgWidth - (2*margin)]);
    treeLayout(root);
    // Calculate min/max after layout
    const minX = Math.min(...allNodes.map(n => n.x));
    const maxX = Math.max(...allNodes.map(n => n.x));
    const minY = Math.min(...allNodes.map(n => n.y));
    const maxY = Math.max(...allNodes.map(n => n.y));
    
    // Calculate left/top shift so tree is always visible
    const leftShift = margin - minY;
    const topShift = margin - minX + margin; // Add extra margin to top
    // Store leftShift/topShift globally for drag logic
    window.leftShift = leftShift;
    window.topShift = topShift;
    d3.select("#tree-svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .style("min-width", svgWidth + minHorizontalSpacing/2 + "px")
        .style("min-height", svgHeight + "px");
    // Update links
    const link = g.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y + leftShift)
            .y(d => d.x + topShift));
    // Update nodes
    const node = g.selectAll(".node")
        .data(root.descendants(), d => d.data.id)
        .join("g")
        .attr("class", "node")
        .on("click", (event, d) => selectNode(d.data))
        .call(d3.drag()
            .on("start", dragStart)
            .on("drag", drag)
            .on("end", dragEnd));

    node.selectAll("*").remove(); // Clear previous

    // Adjust rect size and add rect and text
    node.each(function(d) {
        // Draw text first
        const textGroup = d3.select(this).append("text");
        // Only show attributes if both global and node display options are enabled
        const lines = displayAttributes.filter(attr => {
            const globalEnabled = document.getElementById("attribute-list")?.querySelector(`input[data-attr='${attr}']`)?.checked;
            const nodeEnabled = d.data.displayOptions ? d.data.displayOptions[attr] : true;
            return globalEnabled && nodeEnabled;
        }).map(attr => {
            if (attr === 'name') return d.data.name;
            if (attr === 'power') return `Power: ${d.data.power}`;
            if (attr === 'child_power') return `Child Power: ${d.data.child_power}`;
            if (attr === 'total_power') return `Total Power: ${d.data.total_power}`;
            if (attr === 'location') return `Location: ${d.data.location}`;
            if (attr === 'note') return `Note: ${d.data.note}`;
        });
        lines.forEach((line, i) => {
            textGroup.append("tspan")
                .attr("x", 0)
                .attr("dy", i === 0 ? 0 : "1.2em")
                .text(line);
        });
        const textBBox = textGroup.node().getBBox();
        const centerX = textBBox.x + textBBox.width / 2;
        const centerY = textBBox.y + textBBox.height / 2;
        d.centerX = centerX;
        d.centerY = centerY;
        d.rectX = textBBox.x - 5;
        d.rectY = textBBox.y - 5;
        d.rectWidth = textBBox.width + 10;
        d.rectHeight = textBBox.height + 10;
        // Draw rectangle after text
        d3.select(this).insert("rect", "text")
            .attr("x", d.rectX)
            .attr("y", d.rectY)
            .attr("width", d.rectWidth)
            .attr("height", d.rectHeight)
            .attr("fill", d.data.color)
            .attr("stroke", d.data === selectedNode ? "red" : "black")
            .attr("stroke-width", 2);
        // Move node group to front so it is above edges
        this.parentNode.appendChild(this);
        // Set transform so node is centered
        d3.select(this).attr("transform", `translate(${d.y + leftShift - centerX},${d.x + topShift - centerY})`);
    });

    // Update links
    link.attr("d", d3.linkHorizontal()
        .x(d => d.y + leftShift)
        .y(d => d.x + topShift));
    resizeTreeContainer();
}

function dragStart(event, d) {
    draggedNode = d.data;
    selectNode(draggedNode);
    // Use leftShift/topShift for correct offset
    d.dragOffsetX = event.x - (d.y + (window.leftShift || 0));
    d.dragOffsetY = event.y - (d.x + (window.topShift || 0));
    // Robustly raise node to front
    if (this.parentNode) {
        this.parentNode.appendChild(this);
    }
}

function drag(event, d) {
    isDragging = true;
    // Use leftShift/topShift for correct position
    const newX = event.x - d.dragOffsetX;
    const newY = event.y - d.dragOffsetY;
    d3.select(this).attr("transform", `translate(${newX - d.centerX},${newY - d.centerY})`);
}

function dragEnd(event, d) {
    // Use leftShift/topShift for pointer position
    const [px, py] = d3.pointer(event, g.node());
    const x = px - (window.leftShift || 0);
    const y = py - (window.topShift || 0);
    let foundTarget = null;
    root.descendants().forEach(h => {
        if (h.data === draggedNode) return;
        const rectLeft = h.y - h.centerX + h.rectX + (window.leftShift || 0);
        const rectTop = h.x - h.centerY + h.rectY + (window.topShift || 0);
        if (px >= rectLeft && px <= rectLeft + h.rectWidth && py >= rectTop && py <= rectTop + h.rectHeight) {
            foundTarget = h.data;
        }
    });
    dropTarget = foundTarget;
    if (dropTarget && dropTarget !== draggedNode && !isDescendant(draggedNode, dropTarget)) {
        const oldParent = findParent(treeData, draggedNode);
        if (oldParent) {
            oldParent.children = oldParent.children.filter(c => c !== draggedNode);
        }
        dropTarget.children.push(draggedNode);
    }
    updateTree();
    draggedNode = null;
    dropTarget = null;
}

function isDescendant(node, target) {
    if (node.children) {
        for (let child of node.children) {
            if (child === target || isDescendant(child, target)) return true;
        }
    }
    return false;
}

function findParent(node, target) {
    if (node.children && node.children.includes(target)) return node;
    if (node.children) {
        for (let child of node.children) {
            const p = findParent(child, target);
            if (p) return p;
        }
    }
    return null;
}

function selectNode(node) {
    selectedNode = node;
    document.getElementById("node-name").value = node.name;
    document.getElementById("node-power").value = node.power;
    document.getElementById("node-color").value = node.color;
    document.getElementById("node-location").value = node.location || "";
    document.getElementById("node-note").value = node.note || "";
    updateNodeDisplayOptionsUI();
    updateTree();
}

function updateNodeDisplayOptionsUI() {
    const container = document.getElementById("node-display-options");
    container.innerHTML = "<strong>Node Display Options:</strong><br>";
    if (!selectedNode) return;
    displayAttributes.forEach(attr => {
        const label = document.createElement("label");
        label.style.display = "block";
        label.style.marginBottom = "4px";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = "node-display-" + attr;
        cb.checked = selectedNode.displayOptions[attr];
        cb.addEventListener("change", updateNodeProperties);
        label.appendChild(cb);
        label.appendChild(document.createTextNode(" " + attr.replace('_', ' ')));
        container.appendChild(label);
    });
}

function updateNodeProperties() {
    if (selectedNode) {
        selectedNode.name = document.getElementById("node-name").value;
        selectedNode.power = parseFloat(document.getElementById("node-power").value) || 0;
        selectedNode.color = document.getElementById("node-color").value;
        selectedNode.location = document.getElementById("node-location").value;
        selectedNode.note = document.getElementById("node-note").value;
        // Update display options from checkboxes
        displayAttributes.forEach(attr => {
            const cb = document.getElementById("node-display-" + attr);
            if (cb) selectedNode.displayOptions[attr] = cb.checked;
        });
        updateTree();
    }
}

function addNode() {
    const parent = selectedNode || treeData;
    const newNode = {
        id: nodeIdCounter++,
        name: "New Node",
        power: 0,
        color: "#ffffff",
        location: "",
        note: "",
        children: [],
        displayOptions: {
            name: true,
            power: true,
            child_power: true,
            total_power: true,
            location: true,
            note: true
        }
    };
    parent.children.push(newNode);
    selectNode(newNode);
    updateTree();
}

function removeNode() {
    if (selectedNode && selectedNode !== treeData) {
        const parent = findParent(treeData, selectedNode);
        if (parent) {
            parent.children = parent.children.filter(c => c !== selectedNode);
            // Optionally attach children to parent
            parent.children.push(...selectedNode.children);
        }
        selectedNode = null;
        updateTree();
    }
}

function exportTree() {
    const dataStr = JSON.stringify(treeData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'tree.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function reindexNodeIds(node) {
    node.id = nodeIdCounter++;
    if (node.children && node.children.length) {
        node.children.forEach(reindexNodeIds);
    }
}

function importTree(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                treeData = JSON.parse(e.target.result);
                // Ensure displayOptions exists for all nodes
                function ensureDisplayOptions(node) {
                    if (!node.displayOptions) {
                        node.displayOptions = {
                            name: true,
                            power: true,
                            child_power: true,
                            total_power: true
                        };
                    }
                    if (node.children) {
                        node.children.forEach(ensureDisplayOptions);
                    }
                }
                ensureDisplayOptions(treeData);
                // Re-index node ids
                nodeIdCounter = 1;
                reindexNodeIds(treeData);
                selectedNode = null;
                updateTree();
            } catch (err) {
                alert("Invalid JSON file");
            }
        };
        reader.readAsText(file);
    }
}

function updateDisplayOptions() {
    const list = document.getElementById("attribute-list");
    list.innerHTML = "";
    displayAttributes.forEach(attr => {
        const item = document.createElement("div");
        item.className = "attribute-item";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = true; // For simplicity, all checked
        checkbox.setAttribute("data-attr", attr);
        checkbox.addEventListener("change", updateTree);
        const label = document.createElement("span");
        label.textContent = attr.replace('_', ' ').toUpperCase();
        item.appendChild(checkbox);
        item.appendChild(label);
        list.appendChild(item);
    });
    // For order, make draggable, but for simplicity, fixed order
}

// Remove previous style injection if present
// Add scrollable style to tree-container in index.html instead

// Add node display options UI to properties panel
const propertiesPanel = document.getElementById("properties");
const nodeDisplayDiv = document.createElement("div");
nodeDisplayDiv.id = "node-display-options";
nodeDisplayDiv.style.marginTop = "10px";
nodeDisplayDiv.innerHTML = "<strong>Node Display Options:</strong>";
propertiesPanel.appendChild(nodeDisplayDiv);

document.getElementById("add-node").addEventListener("click", addNode);
document.getElementById("remove-node").addEventListener("click", removeNode);
document.getElementById("export-tree").addEventListener("click", exportTree);
document.getElementById("import-tree").addEventListener("change", importTree);
document.getElementById("node-name").addEventListener("input", updateNodeProperties);
document.getElementById("node-power").addEventListener("input", updateNodeProperties);
document.getElementById("node-color").addEventListener("input", updateNodeProperties);
document.getElementById("node-location").addEventListener("input", updateNodeProperties);
document.getElementById("node-note").addEventListener("input", updateNodeProperties);

function updateTransform() {
    g.attr("transform", `translate(${panOffset.x},${panOffset.y}) scale(${zoomLevel})`);
}

svg.on("mousedown", function(event) {
    if (event.target === svg.node()) {
        isPanning = true;
        panStart = {x: event.clientX, y: event.clientY};
        svg.style("cursor", "grab");
    }
});
svg.on("mousemove", function(event) {
    if (isPanning) {
        const dx = event.clientX - panStart.x;
        const dy = event.clientY - panStart.y;
        panOffset.x += dx;
        panOffset.y += dy;
        updateTransform();
        panStart = {x: event.clientX, y: event.clientY};
    }
});
svg.on("mouseup", function() {
    isPanning = false;
    svg.style("cursor", "default");
});
svg.on("mouseleave", function() {
    isPanning = false;
    svg.style("cursor", "default");
});
svg.on("wheel", function(event) {
    event.preventDefault();
    const delta = event.deltaY;
    // Zoom to mouse position
    const mouse = d3.pointer(event, svg.node());
    const prevZoom = zoomLevel;
    zoomLevel *= delta > 0 ? 0.9 : 1.1;
    zoomLevel = Math.max(0.2, Math.min(zoomLevel, 5));
    // Adjust panOffset so zoom centers on mouse
    panOffset.x = mouse[0] - ((mouse[0] - panOffset.x) * (zoomLevel / prevZoom));
    panOffset.y = mouse[1] - ((mouse[1] - panOffset.y) * (zoomLevel / prevZoom));
    updateTransform();
});

function resizeTreeContainer() {
    const treeContainer = document.getElementById('tree-container');
    const svg = document.getElementById('tree-svg');
    // Use leftShift/topShift to ensure scrollable area covers the whole graph
    const svgWidth = svg ? parseInt(svg.getAttribute('width') || 0) : 0;
    const svgHeight = svg ? parseInt(svg.getAttribute('height') || 0) : 0;
    const leftShift = window.leftShift || 0;
    const topShift = window.topShift || 0;
    if (treeContainer && svg) {
        treeContainer.style.height = Math.max(window.innerHeight, svgHeight + topShift) + 'px';
        treeContainer.style.width = Math.max(window.innerWidth, svgWidth + leftShift) + 'px';
        treeContainer.style.overflow = 'auto';
    }
}
window.addEventListener('resize', resizeTreeContainer);

// Initial call
resizeTreeContainer();

updateDisplayOptions();
updateTree();

function zoomToFit() {
    // Get bounding box of all nodes
    const nodes = g.selectAll('.node').nodes();
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        const bbox = node.getBBox();
        const tx = node.transform.baseVal.length ? node.transform.baseVal.getItem(0).matrix.e : 0;
        const ty = node.transform.baseVal.length ? node.transform.baseVal.getItem(0).matrix.f : 0;
        minX = Math.min(minX, tx + bbox.x);
        minY = Math.min(minY, ty + bbox.y);
        maxX = Math.max(maxX, tx + bbox.x + bbox.width);
        maxY = Math.max(maxY, ty + bbox.y + bbox.height);
    });
    const svgRect = svg.node().getBoundingClientRect();
    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    // Calculate scale to fit
    const scale = Math.min(svgRect.width / graphWidth, svgRect.height / graphHeight, 1);
    zoomLevel = scale;
    // Center graph
    panOffset.x = svgRect.width / 2 - (minX + graphWidth / 2) * scale;
    panOffset.y = svgRect.height / 2 - (minY + graphHeight / 2) * scale;
    updateTransform();
}

// Ensure Zoom to Fit button calls zoomToFit
const zoomFitBtn = document.getElementById('zoom-fit');
if (zoomFitBtn) zoomFitBtn.onclick = zoomToFit;

function showTopMessage(msg) {
    let msgDiv = document.getElementById('top-message');
    if (!msgDiv) {
        msgDiv = document.createElement('div');
        msgDiv.id = 'top-message';
        msgDiv.style.position = 'fixed';
        msgDiv.style.top = '10px';
        msgDiv.style.left = '50%';
        msgDiv.style.transform = 'translateX(-50%)';
        msgDiv.style.background = 'rgba(40,40,40,0.95)';
        msgDiv.style.color = '#fff';
        msgDiv.style.padding = '8px 24px';
        msgDiv.style.borderRadius = '6px';
        msgDiv.style.zIndex = '9999';
        msgDiv.style.fontSize = '1.1em';
        msgDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        document.body.appendChild(msgDiv);
    }
    msgDiv.textContent = msg;
    msgDiv.style.display = 'block';
    clearTimeout(msgDiv._hideTimeout);
    msgDiv._hideTimeout = setTimeout(() => {
        msgDiv.style.display = 'none';
    }, 1500);
}

function quickSaveTree() {
    localStorage.setItem('graphTreeCache', JSON.stringify(treeData));
    showTopMessage('Tree saved to cache!');
}

function ensureUniqueNodeIds(node, usedIds = new Set()) {
    if (usedIds.has(node.id)) {
        node.id = ++nodeIdCounter;
    }
    usedIds.add(node.id);
    if (node.children && node.children.length) {
        node.children.forEach(child => ensureUniqueNodeIds(child, usedIds));
    }
}



function quickLoadTree() {
    const cached = localStorage.getItem('graphTreeCache');
    if (cached) {
        try {
            treeData = JSON.parse(cached);
            function ensureDisplayOptions(node) {
                if (!node.displayOptions) {
                    node.displayOptions = {
                        name: true,
                        power: true,
                        child_power: true,
                        total_power: true,
                        location: true,
                        note: true
                    };
                }
                if (node.children) {
                    node.children.forEach(ensureDisplayOptions);
                }
            }
            ensureDisplayOptions(treeData);
            // Re-index node ids
            nodeIdCounter = 1;
            reindexNodeIds(treeData);
            selectedNode = null;
            updateTree();
            showTopMessage('Tree loaded from cache!');
        } catch (err) {
            showTopMessage('Failed to load tree from cache!');
        }
    } else {
        showTopMessage('No cached tree found!');
    }
}
// Attach to existing buttons
const quickSaveBtn = document.getElementById('quick-save');
if (quickSaveBtn) quickSaveBtn.onclick = quickSaveTree;
const quickLoadBtn = document.getElementById('quick-load');
if (quickLoadBtn) quickLoadBtn.onclick = quickLoadTree;

function moveNodeUp() {
    if (!selectedNode || selectedNode === treeData) return;
    const parent = findParent(treeData, selectedNode);
    if (!parent) return;
    const idx = parent.children.indexOf(selectedNode);
    if (idx > 0) {
        parent.children.splice(idx, 1);
        parent.children.splice(idx - 1, 0, selectedNode);
        updateTree();
    }
}

function moveNodeDown() {
    if (!selectedNode || selectedNode === treeData) return;
    const parent = findParent(treeData, selectedNode);
    if (!parent) return;
    const idx = parent.children.indexOf(selectedNode);
    if (idx < parent.children.length - 1) {
        parent.children.splice(idx, 1);
        parent.children.splice(idx + 1, 0, selectedNode);
        updateTree();
    }
}

document.getElementById("move-up").addEventListener("click", moveNodeUp);
document.getElementById("move-down").addEventListener("click", moveNodeDown);
function duplicateNode() {
    if (!selectedNode) return;
    const parent = findParent(treeData, selectedNode) || treeData;
    // Deep clone the selected node (excluding children)
    const clone = {
        id: nodeIdCounter++,
        name: selectedNode.name,
        power: selectedNode.power,
        color: selectedNode.color,
        location: selectedNode.location,
        note: selectedNode.note,
        children: [],
        displayOptions: { ...selectedNode.displayOptions }
    };
    parent.children.push(clone);
    selectNode(clone);
    updateTree();
}

document.getElementById("duplicate-node").addEventListener("click", duplicateNode);