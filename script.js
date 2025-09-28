let treeData = {
    id: 0,
    name: "Root",
    power: 0,
    color: "#ffffff",
    children: []
};

let draggedNode = null;
let dropTarget = null;
let selectedNode = null;
let nodeIdCounter = 1;
let displayAttributes = ['name', 'power', 'child_power', 'total_power'];
let root;

const svg = d3.select("#tree-svg");
const width = window.innerWidth - 400;
const height = window.innerHeight;

svg.attr("width", width).attr("height", height);

const g = svg.append("g").attr("transform", "translate(40,0)");

const treeLayout = d3.tree().size([height - 100, width - 200]);

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
    }
    computePowers(treeData);

    // Update tree layout
    root = d3.hierarchy(treeData);
    treeLayout(root);

    // Update links
    const link = g.selectAll(".link")
        .data(root.links())
        .join("path")
        .attr("class", "link")
        .attr("d", d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x));

    // Update nodes
    const node = g.selectAll(".node")
        .data(root.descendants())
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
        const textGroup = d3.select(this).append("text");

        const lines = displayAttributes.map(attr => {
            if (attr === 'name') return d.data.name;
            if (attr === 'power') return `Power: ${d.data.power}`;
            if (attr === 'child_power') return `Child Power: ${d.data.child_power}`;
            if (attr === 'total_power') return `Total Power: ${d.data.total_power}`;
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

        d3.select(this).attr("transform", `translate(${d.y - centerX},${d.x - centerY})`);

        d.centerX = centerX;
        d.centerY = centerY;
        d.rectX = textBBox.x - 5;
        d.rectY = textBBox.y - 5;
        d.rectWidth = textBBox.width + 10;
        d.rectHeight = textBBox.height + 10;

        d3.select(this).insert("rect", "text")
            .attr("x", textBBox.x - 5)
            .attr("y", textBBox.y - 5)
            .attr("width", textBBox.width + 10)
            .attr("height", textBBox.height + 10)
            .attr("fill", d.data.color)
            .attr("stroke", d.data === selectedNode ? "red" : "black")
            .attr("stroke-width", 2);
    });
}

function dragStart(event, d) {
    draggedNode = d.data;
    d.dragOffsetX = event.x - d.y;
    d.dragOffsetY = event.y - d.x;
    d3.select(this).raise();
}

function drag(event, d) {
    const newX = event.x - d.dragOffsetX;
    const newY = event.y - d.dragOffsetY;
    d3.select(this).attr("transform", `translate(${newX - d.centerX},${newY - d.centerY})`);
}

function dragEnd(event, d) {
    const [px, py] = d3.pointer(event, g.node());
    let foundTarget = null;
    root.descendants().forEach(h => {
        if (h.data === draggedNode) return;
        const rectLeft = h.y - h.centerX + h.rectX;
        const rectTop = h.x - h.centerY + h.rectY;
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
    updateTree();
}

function updateNodeProperties() {
    if (selectedNode) {
        selectedNode.name = document.getElementById("node-name").value;
        selectedNode.power = parseFloat(document.getElementById("node-power").value) || 0;
        selectedNode.color = document.getElementById("node-color").value;
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
        children: []
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

function importTree(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                treeData = JSON.parse(e.target.result);
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
        const label = document.createElement("span");
        label.textContent = attr.replace('_', ' ').toUpperCase();
        item.appendChild(checkbox);
        item.appendChild(label);
        list.appendChild(item);
    });
    // For order, make draggable, but for simplicity, fixed order
}

document.getElementById("add-node").addEventListener("click", addNode);
document.getElementById("remove-node").addEventListener("click", removeNode);
document.getElementById("export-tree").addEventListener("click", exportTree);
document.getElementById("import-tree").addEventListener("change", importTree);
document.getElementById("node-name").addEventListener("input", updateNodeProperties);
document.getElementById("node-power").addEventListener("input", updateNodeProperties);
document.getElementById("node-color").addEventListener("input", updateNodeProperties);

updateDisplayOptions();
updateTree();