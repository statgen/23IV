var pca3d = (function (data, config) {
    
    var canvas = d3.select(config.canvasId).node();
    var originalCanvasWidth = canvas.width;
    var originalCanvasHeight = canvas.height;
    
    // Bounding box for data
    var dataBoundingBox = {
        minX: Number.MAX_VALUE,
        minY: Number.MAX_VALUE,
        minZ: Number.MAX_VALUE,
        maxX: 0,
        maxY: 0,
        maxZ: 0,
        centerX: Number.MAX_VALUE,
        centerY: Number.MAX_VALUE,
        centerZ: Number.MAX_VALUE,
        width: 0,
        height: 0,
        length: 0
    };
    
    // Bounding cube for data.
    var dataViewCube = {
        minX: Number.MAX_VALUE,
        minY: Number.MAX_VALUE,
        minZ: Number.MAX_VALUE,
        maxX: 0,
        maxY: 0,
        maxZ: 0,
        centerX: Number.MAX_VALUE,
        centerY: Number.MAX_VALUE,
        centerZ: Number.MAX_VALUE,
        sideSize: 0
    };
    
// Bounding square for fixed view of X and Y axes on top of data view.
//    var axesViewSquare = {
//        minX: -50,
//        maxX: 50,
//        minY: -50,
//        maxY: 50,
//        sideSize: 100,
//        tickSize: 1,
//        margin: 10,
//        xAxis: {
//            start: {x: -40, y: -40},
//            end: {x: 40, y: -40}
//        },
//        yAxis: {
//            start: {x: -40, y: -40},
//            end: {x: -40, y: 40}
//        }
//    }
        
    var sceneData = null;
    var cameraData = null;
    var renderer = null;
    var raycaster = null;
    var controls = null;
    var particles = null;
    var grid = null;
    var axes = null;
    var ticks = null;
    var selection = null;
    
    // Axes labels and ticks labels
    var labelX = null;
    var labelY = null;
    var labelZ = null;
    var labelTickMinX = null;
    var labelTickMaxX = null;
    var labelTickMinY = null;
    var labelTickMaxY = null;
    var labelTickMinZ = null;
    var labelTickMaxZ = null;
    
    // Mouse position in window
    var mouse = {x: 0, y: 0};
    // Normalized mouse position in canvas
    var mouse2d = new THREE.Vector2();
    
    // Currently picked object ID
    var picked = null;
    // Currently tipped objtect ID
    var tooltip = null;
    // Currently highlighted object ID
    var highlighted = null;
    // Currently selected object ID
    var selected = null;
    
    var lookupTable = new Map();
    
    var sphere = new THREE.TextureLoader().load("textures/sphere.png");
    
    // Calculate bouding box for data
    var calculateDataBoundingBox = function(xDimName, yDimName, zDimName) {
        dataBoundingBox.minX = Number.MAX_VALUE;
        dataBoundingBox.minY = Number.MAX_VALUE;
        dataBoundingBox.minZ = Number.MAX_VALUE;
        dataBoundingBox.maxX = 0;
        dataBoundingBox.maxY = 0;
        dataBoundingBox.maxZ = 0;
            
        for (var i = 0; i < data.length; i++) {
            var x = data[i][xDimName];
            var y = data[i][yDimName];
            var z = data[i][zDimName];
            if (x > dataBoundingBox.maxX) { dataBoundingBox.maxX = x; }
            if (x < dataBoundingBox.minX) { dataBoundingBox.minX = x; }
            if (y > dataBoundingBox.maxY) { dataBoundingBox.maxY = y; }
            if (y < dataBoundingBox.minY) { dataBoundingBox.minY = y; }
            if (z > dataBoundingBox.maxZ) { dataBoundingBox.maxZ = z; }
            if (z < dataBoundingBox.minZ) { dataBoundingBox.minZ = z; }
        }
            
        dataBoundingBox.centerX = dataBoundingBox.minX + (dataBoundingBox.maxX - dataBoundingBox.minX) / 2;
        dataBoundingBox.centerY = dataBoundingBox.minY + (dataBoundingBox.maxY - dataBoundingBox.minY) / 2;
        dataBoundingBox.centerZ = dataBoundingBox.minZ + (dataBoundingBox.maxZ - dataBoundingBox.minZ) / 2;
            
        dataBoundingBox.width = dataBoundingBox.maxX - dataBoundingBox.minX;
        dataBoundingBox.height = dataBoundingBox.maxY - dataBoundingBox.minY;
        dataBoundingBox.length = dataBoundingBox.maxZ - dataBoundingBox.minZ;
    }
    
    // Calculate view square for data
    var calculateDataViewCube = function() {
        dataViewCube.minX = Math.floor(dataBoundingBox.minX);
        dataViewCube.maxX = Math.ceil(dataBoundingBox.maxX);
        dataViewCube.minY = Math.floor(dataBoundingBox.minY);
        dataViewCube.maxY = Math.ceil(dataBoundingBox.maxY);
        dataViewCube.minZ = Math.floor(dataBoundingBox.minZ);
        dataViewCube.maxZ = Math.ceil(dataBoundingBox.maxZ);
        
        dataViewCube.sideSize = Math.max(
            dataViewCube.maxX - dataViewCube.minX, 
            dataViewCube.maxY - dataViewCube.minY,
            dataViewCube.maxZ - dataViewCube.minZ
        );
        
        if (dataViewCube.maxX - dataViewCube.minX < dataViewCube.sideSize) {
            var append = dataViewCube.sideSize - dataViewCube.maxX + dataViewCube.minX;
            dataViewCube.minX = dataViewCube.minX - Math.floor(append / 2);
            dataViewCube.maxX = dataViewCube.maxX + Math.ceil(append / 2);            
        } 
        
        if (dataViewCube.maxY - dataViewCube.minY < dataViewCube.sideSize) {
            var append = dataViewCube.sideSize - dataViewCube.maxY + dataViewCube.minY;
            dataViewCube.minY = dataViewCube.minY - Math.floor(append / 2);
            dataViewCube.maxY = dataViewCube.maxY + Math.ceil(append / 2);
        }

        if (dataViewCube.maxZ - dataViewCube.minZ < dataViewCube.sideSize) {
            var append = dataViewCube.sideSize - dataViewCube.maxZ + dataViewCube.minZ;
            dataViewCube.minZ = dataViewCube.minZ - Math.floor(append / 2);
            dataViewCube.maxZ = dataViewCube.maxZ + Math.ceil(append / 2);
        }

        dataViewCube.centerX = dataViewCube.minX + (dataViewCube.maxX - dataViewCube.minX) / 2;
        dataViewCube.centerY = dataViewCube.minY + (dataViewCube.maxY - dataViewCube.minY) / 2;   
        dataViewCube.centerZ = dataViewCube.minZ + (dataViewCube.maxZ - dataViewCube.minZ) / 2;   
    }
    
    // Create label
    var createLabel = function(text, fontface, fontsize, valign, halign) {
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
            
        context.font = fontsize + "px " + fontface;
        context.fillStyle = "rgba(0, 0, 0, 1.0)";

        var metrics = context.measureText(text);
        var textWidth = metrics.width;
            
        var cx = canvas.width / 2;
        var cy = canvas.height / 2;
        var tx = textWidth / 2;
        var ty = fontsize / 2;
           
        if (valign == "top") {
            ty = 0;
        } else if (valign == "bottom") {
            ty = fontsize;
        }
            
        if (halign == "left") {
            tx = textWidth;
        } else if (halign == "right") {
            tx = 0;
        }

        context.fillText(text, cx - tx, cy + ty);
            
        var texture = new THREE.Texture(canvas);
            
        texture.minFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
            
        var material = new THREE.SpriteMaterial({
            map: texture
        });
            
        var sprite = new THREE.Sprite(material);
        sprite.scale.set(40, 20, 1);
        
        return {
            cwidth: canvas.width,
            cheight: canvas.height,
            cx: cx,
            cy: cy,
            context: context,
            sprite: sprite,
            valign: valign,
            halign: halign,
            fontface: fontface,
            fontsize: fontsize
        };
    };  
    
    // Update label text
    var updateLabel = function(label, text) {
        label.context.clearRect(0, 0, label.cwidth, label.cheight);
        label.context.fillStyle = "rgba(0, 0, 0, 1.0)";
            
        var metrics = label.context.measureText(text);
        var textWidth = metrics.width;
            
        var tx = textWidth / 2.0;
        var ty = label.fontsize / 2.0;
            
        if (label.valign == "top") {
            ty = 0;
        } else if (label.valign == "bottom") {
            ty = label.fontsize;
        }
            
        if (label.halign == "left") {
            tx = textWidth;
        } else if (label.halign == "right") {
            tx = 0;
        }
            
        label.context.fillText(text, label.cx - tx, label.cy + ty);
        label.sprite.material.map.needsUpdate = true;
    };
    
    // Get X axis tick label at tick_position
//    var getTickXLabel = function(tick_position, data_view_minX, data_view_maxX) {
//        var unit = (data_view_maxX - data_view_minX) / axesViewSquare.sideSize;
//        var  label = data_view_minX + unit * (tick_position - axesViewSquare.minX);
//        return label.toFixed(2);
//    };
    
    // Get Y axis tick label at tick_position
//    var getTickYLabel = function(tick_position, data_view_minY, data_view_maxY) {
//        var unit = (data_view_maxY - data_view_minY) / axesViewSquare.sideSize;
//        var label = data_view_minY + unit * (tick_position - axesViewSquare.minY);
//        return label.toFixed(2);
//    };
        
    // Draw axes.
    function drawAxes() {
        var axis_material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
        
        if (axes) {
            sceneData.remove(axes);
        }
        
        if (ticks) {
            sceneData.remove(ticks);
        }
        
        var axes_geometry = new THREE.Geometry();
        var ticks_geometry = new THREE.Geometry();
                
        axes_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ));
        axes_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.maxY, dataViewCube.maxZ));
        axes_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.minZ), 
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ));
        
        axes = new THREE.LineSegments(axes_geometry, axis_material);
        sceneData.add(axes);
        
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX - 2, dataViewCube.maxY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.maxY, dataViewCube.maxZ));
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX - 2, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ));
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ + 2));
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.maxX + 2, dataViewCube.minY, dataViewCube.maxZ));
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ), 
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ + 2));
        ticks_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.minZ), 
            new THREE.Vector3(dataViewCube.maxX + 2, dataViewCube.minY, dataViewCube.minZ));

        ticks = new THREE.LineSegments(ticks_geometry, axis_material);
        sceneData.add(ticks);
        
        if (labelX) {
            sceneData.remove(labelX.sprite);
        }
        
        if (labelY) {
            sceneData.remove(labelY.sprite);
        }
        
        if (labelZ) {
            sceneData.remove(labelZ.sprite);
        }
        
        labelX = createLabel(config.xAttribute, "Arial", 32, "bottom", "");
        labelY = createLabel(config.yAttribute, "Arial", 32, "", "left");
        labelZ = createLabel(config.zAttribute, "Arial", 32, "bottom", "");
        
        labelX.sprite.position.set(dataViewCube.centerX, dataViewCube.minY, dataViewCube.maxZ + 5);
        labelY.sprite.position.set(dataViewCube.minX, dataViewCube.centerY, dataViewCube.maxZ + 5);
        labelZ.sprite.position.set(dataViewCube.maxX + 5, dataViewCube.minY, dataViewCube.centerZ);
            
        sceneData.add(labelX.sprite);
        sceneData.add(labelY.sprite);
        sceneData.add(labelZ.sprite);
        
        if (labelTickMinX) {
            sceneData.remove(labelTickMinX.sprite);
        }
        
        if (labelTickMaxX) {
            sceneData.remove(labelTickMaxX.sprite);
        }
        
        if (labelTickMinY) {
            sceneData.remove(labelTickMinY.sprite);
        }
        
        if (labelTickMaxY) {
            sceneData.remove(labelTickMaxY.sprite);    
        }
        
        if (labelTickMinZ) {
            sceneData.remove(labelTickMinZ.sprite);
        }
        
        if (labelTickMaxZ) {
            sceneData.remove(labelTickMaxZ.sprite);
        }
        
        labelTickMinX = createLabel("" + dataViewCube.minX, "Arial", 24, "bottom", "");
        labelTickMaxX = createLabel("" + dataViewCube.maxX, "Arial", 24, "bottom", "");
        labelTickMinY = createLabel("" + dataViewCube.minY, "Arial", 24, "bottom", "");
        labelTickMaxY = createLabel("" + dataViewCube.maxY, "Arial", 24, "bottom", "");
        labelTickMinZ = createLabel("" + dataViewCube.minZ, "Arial", 24, "bottom", "");
        labelTickMaxZ = createLabel("" + dataViewCube.maxZ, "Arial", 24, "bottom", "");
        
        labelTickMinX.sprite.position.set(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ + 5);
        labelTickMaxX.sprite.position.set(dataViewCube.maxX, dataViewCube.minY, dataViewCube.maxZ + 5);
        labelTickMinY.sprite.position.set(dataViewCube.minX - 5, dataViewCube.minY, dataViewCube.maxZ);
        labelTickMaxY.sprite.position.set(dataViewCube.minX - 5, dataViewCube.maxY, dataViewCube.maxZ);
        labelTickMinZ.sprite.position.set(dataViewCube.maxX + 5, dataViewCube.minY, dataViewCube.minZ);
        labelTickMaxZ.sprite.position.set(dataViewCube.maxX + 5, dataViewCube.minY, dataViewCube.maxZ);
        
        sceneData.add(labelTickMinX.sprite);
        sceneData.add(labelTickMaxX.sprite);
        sceneData.add(labelTickMinY.sprite);
        sceneData.add(labelTickMaxY.sprite);
        sceneData.add(labelTickMinZ.sprite);
        sceneData.add(labelTickMaxZ.sprite);
    }
    
    // Update tick labels
    var updateTickLabels = function() {
        var cx = dataViewSquare.centerX + cameraData.position.x;
        var cy = dataViewSquare.centerY + cameraData.position.y;
        var minx = cx + (dataViewSquare.minX - dataViewSquare.centerX) / cameraData.zoom;
        var maxx = cx + (dataViewSquare.maxX - dataViewSquare.centerX) / cameraData.zoom;
        var miny = cy + (dataViewSquare.minY - dataViewSquare.centerY) / cameraData.zoom;
        var maxy = cy + (dataViewSquare.maxY - dataViewSquare.centerY) / cameraData.zoom;

        updateLabel(labelTickMinX, getTickXLabel(axesViewSquare.xAxis.start.x, minx, maxx));
        updateLabel(labelTickMaxX, getTickXLabel(axesViewSquare.xAxis.end.x, minx, maxx));
        updateLabel(labelTickMinY, getTickYLabel(axesViewSquare.yAxis.start.y, miny, maxy));
        updateLabel(labelTickMaxY, getTickYLabel(axesViewSquare.yAxis.end.y, miny, maxy));
    }
    
    // Draw grid
    var drawGrid = function() {
        var material = new THREE.LineBasicMaterial({color: 0xD3D3D3, linewidth: 1});
        var geometry = new THREE.Geometry();
        var step = dataViewCube.sideSize / 10;
        
        if (grid) {
            sceneData.remove(grid);
        }
        
        for (var x = dataViewCube.minX; x <= dataViewCube.maxX; x += step) {
            geometry.vertices.push(new THREE.Vector3(x, dataViewCube.minY, dataViewCube.minZ));
            geometry.vertices.push(new THREE.Vector3(x, dataViewCube.maxY, dataViewCube.minZ));
            
            geometry.vertices.push(new THREE.Vector3(x, dataViewCube.minY, dataViewCube.minZ));
            geometry.vertices.push(new THREE.Vector3(x, dataViewCube.minY, dataViewCube.maxZ));
        }
        
        for (var y = dataViewCube.minY; y <= dataViewCube.maxY; y += step) {
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, y, dataViewCube.minZ));
            geometry.vertices.push(new THREE.Vector3(dataViewCube.maxX, y, dataViewCube.minZ));
            
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, y, dataViewCube.minZ));
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, y, dataViewCube.maxZ));
        }
        
        for (var z = dataViewCube.minZ; z <= dataViewCube.maxZ; z += step) {
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, z));
            geometry.vertices.push(new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, z));
            
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, z));
            geometry.vertices.push(new THREE.Vector3(dataViewCube.minX, dataViewCube.maxY, z));
        }
        
        grid = new THREE.LineSegments(geometry, material);
        
        if (config.grid) {
            sceneData.add(grid);
        }
    };
    
    // Draw data
    var drawData = function() {
        var geometry = new THREE.Geometry();
        var material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 10,
            sizeAttenuation: false,
            transparent: true,
            map: sphere,
//            opacity: 0.7,
            vertexColors: THREE.VertexColors
        });
        
        material.alphaTest = 0.5;
        
        if (selected) {         
            var selectedDataItem = lookupTable.get(selected);
            if (!config.groups.has(data[selectedDataItem][config.groupAttribute])) {
                //sceneData.remove(selection);
                selected = null;
            }
        }
                    
        lookupTable.clear();
          
        if (particles) {
            sceneData.remove(particles);
        }
                    
        for (var i = 0, j = 0; i < data.length; i++) {
            if (config.groups.has(data[i][config.groupAttribute])) {
                geometry.vertices.push(new THREE.Vector3(
                    data[i][config.xAttribute], 
                    data[i][config.yAttribute], 
                    data[i][config.zAttribute]));
                geometry.colors.push(new THREE.Color(data[i][config.colorAttribute]));
                lookupTable.set(j, i);
                if (i == selectedDataItem) {
                    selected = j;
                }
                j++;
            }
        }
                
        particles = new THREE.Points(geometry, material);
        sceneData.add(particles);
    };
    
    // Draw square for point selection
    var drawSelection = function(size, width) {
        var material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: width});
        var geometry = new THREE.Geometry();
        
        if (selection) {
            sceneData.remove(selection);
        }
                                              
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, -0.5));
        
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, -0.5));
        
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0.5));

        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0.5));
        
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0.5));
        
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, -0.5));
        
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, -0.5));
        
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, -0.5));
        
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, -0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0.5));
        
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0.5));
        
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0.5));
        
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, 0.5));
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, -0.5));
        
        selection = new THREE.LineSegments(geometry, material);
        
        if (selected) {
            var distance = cameraData.position.distanceTo(particles.geometry.vertices[selected]);
            var vFOV = cameraData.fov * Math.PI / 180;
            var height = 2 * Math.tan(vFOV / 2) * distance;
        
            var normalizedSize2 = (height / canvas.width) * 10 * window.devicePixelRatio;
            var zoomLevel = normalizedSize2;
            
            selection.position.set(
            particles.geometry.vertices[selected].x, 
            particles.geometry.vertices[selected].y, 
            particles.geometry.vertices[selected].z);
            selection.scale.set(zoomLevel, zoomLevel, zoomLevel);
            sceneData.add(selection);
        }
    };

    // Update normalized mouse coordinates on mouse move event inside canvas
    var onMouseMoveInsideCanvas = function() {
        var boundingClientRect = canvas.getBoundingClientRect();
        mouse.x = d3.event.x;
        mouse.y = d3.event.y;
        mouse2d.x = ((d3.event.x - boundingClientRect.left) / canvas.width) * 2 * window.devicePixelRatio - 1;
        mouse2d.y = (-(d3.event.y - boundingClientRect.top) / canvas.height) * 2 * window.devicePixelRatio + 1;
    };
    
    // On mouse click inside canvas
    var onMouseClickInsideCanvas = function() {
        if (selected) { 
            sceneData.remove(selection);
        }

        if ((picked) && (picked != selected)) {
            selected = picked;
            selection.position.set(
                particles.geometry.vertices[selected].x, 
                particles.geometry.vertices[selected].y, 
                particles.geometry.vertices[selected].z);
            sceneData.add(selection);
            //console.log(selection);
        } else {
            selected = null;
        }
    };
    
    // Find 3D object under mouse pointer
    var updatePicked = function() {
        raycaster.setFromCamera(mouse2d, cameraData);
        intersects = raycaster.intersectObject(particles);
        if (intersects.length > 0) {
            picked = intersects[0].index;
        } else {
            picked = null;
        }
    };
    
    // Highlight picked 3D object
    var highlightPicked = function() {
        if (picked != highlighted) {
            if (highlighted != null) {
                particles.geometry.colors[highlighted] = new THREE.Color(data[lookupTable.get(highlighted)][config.colorAttribute]);
            }
            if (picked != null) {
                particles.geometry.colors[picked] = new THREE.Color(0xff00ff);
            }
            particles.geometry.colorsNeedUpdate = true;
            highlighted = picked;
        }
    };
    
    // Create/remove tooltip
    var updateTooltip = function() {
        if (picked != tooltip) {
            d3.select("#tooltip").remove();
            if (picked != null) {
                var coordinate = mouse;
                d3.select("body").append("div")
                    .attr("id", "tooltip")
                    .style("left", (coordinate.x + 10) + "px")
                    .style("top", (coordinate.y - 30) + "px")
                    .html(data[lookupTable.get(picked)][config.nameAttribute] + 
                          "</br>" + config.xAttribute + "=" + data[lookupTable.get(picked)][config.xAttribute] + 
                          "</br>" + config.yAttribute + "=" + data[lookupTable.get(picked)][config.yAttribute] + 
                          "</br>" + config.zAttribute + "=" + data[lookupTable.get(picked)][config.zAttribute]);
            }
            tooltip = picked;
        }
    };
    
    // Initialize GL
    var initializeGL = function() {
        sceneData = new THREE.Scene();
        
        cameraData = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 1000);
        cameraData.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
                        
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xffffff);

        raycaster = new THREE.Raycaster();
    }
    
    // Initialize controls.
    var initializeControls = function() {
        controls = new THREE.TrackballControls(cameraData, canvas);
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
        controls.rotateSpeed = 2.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;
        controls.addEventListener('change', render);
        
        d3.select(config.canvasId).on("mousemove", onMouseMoveInsideCanvas);
        d3.select(config.canvasId).on("click", onMouseClickInsideCanvas);
    };
    
    // Initialize view
    var initializeScene = function() {
        drawData();
        drawGrid();
        drawAxes();  
        drawSelection(10, 2);
    };
    
    this.initialize = function() {
        initializeGL();
        initializeControls();
        initializeScene();
    };
    
    var render = function() {
        updatePicked();
        highlightPicked();
        updateTooltip();
//        updateTickLabels();
    
        if (selected) {
            //var normalizedSize = (dataViewCube.sideSize / canvas.width) * 10 * window.devicePixelRatio;
            var normalizedSize = 1;
                    var distance = cameraData.position.distanceTo(particles.geometry.vertices[selected]);
            var vFOV = cameraData.fov * Math.PI / 180;
            var height = 2 * Math.tan(vFOV / 2) * distance;
        
            var normalizedSize2 = (height / canvas.width) * 10 * window.devicePixelRatio;
            var zoomLevel = normalizedSize2 / normalizedSize;
        
        selection.scale.set(zoomLevel, zoomLevel, zoomLevel);
        }
        
        renderer.render(sceneData, cameraData);
    };
    
    this.updateData = function() {
        drawData();
        drawGrid();
        drawAxes();
        drawSelection(10, 2);
    }
    
    this.draw = function() {
        controls.update();
        render();
    };
       
    this.setXCoordinateAttr = function(name) {
        config.xAttribute = name;
        
        calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
        calculateDataViewCube();
        
        cameraData.zoom = 1;
        cameraData.up.set(0, 1, 0);
        cameraData.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
        cameraData.updateProjectionMatrix();
        
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
    };
    
    this.setYCoordinateAttr = function(name) {
        config.yAttribute = name;
        
        calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
        calculateDataViewCube();
        
        cameraData.zoom = 1;
        cameraData.up.set(0, 1, 0);
        cameraData.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
        cameraData.updateProjectionMatrix();
        
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
    };
    
    this.setZCoordinateAttr = function(name) {
        config.zAttribute = name;
        
        calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
        calculateDataViewCube();
        
        cameraData.zoom = 1;
        cameraData.up.set(0, 1, 0);
        cameraData.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
        cameraData.updateProjectionMatrix();
        
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
    };

    this.getDataBoundingRectangle = function() {
        return dataBoundingRectangle;  
    };
    
    this.getDataViewCube = function() {
        return dataViewCube;  
    };
    
    this.deactivate = function() {
        controls.removeEventListener("change");
        d3.select(config.canvasId).on("mousemove", null);
        d3.select(config.canvasId).on("click", null);
        d3.select(config.canvasId)
            .attr("width", originalCanvasWidth)
            .attr("height", originalCanvasHeight);
    }
    
    this.enableGrid = function() {
        if (grid) {
            if (!config.grid) {
                config.grid = true;
                sceneData.add(grid);
            }
        }
    }
    
    this.disableGrid = function(enable) {
         if (grid) {
            if (config.grid) {
                config.grid = false;
                sceneData.remove(grid);
            }
        }
    }
    
    this.getSelection = function() {
//        console.log(cameraData);
//        console.log(controls);
        //var vFOV = camera.fov * Math.PI / 180;
        //var height = 2 * Math.tan(vFOV / 2) *
        
        //console.log(cameraData.position);
        //console.log(particles.geometry.vertices[selected]);    
        //console.log(cameraData.position.distanceTo(particles.geometry.vertices[selected]));
        
        var distance = cameraData.position.distanceTo(particles.geometry.vertices[selected]);
        var vFOV = cameraData.fov * Math.PI / 180;
        var width = 2 * Math.tan(vFOV / 2) * distance;
        
        var normalizedSize = (dataViewCube.sideSize / canvas.width) * 10 * window.devicePixelRatio;
        var normalizedSize2 = (width / canvas.width) * 10 * window.devicePixelRatio;
        var zoomLevel = normalizedSize / normalizedSize2;
        
        console.log(normalizedSize + " " + normalizedSize2 + " " + height + " " + zoomLevel);
        
        //return selection;
    }
           
    calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
    calculateDataViewCube();

});