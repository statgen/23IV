var pca3d = (function (model, config) {
    
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
    // Currently selected neighbors
    var neighbors = null;
    
    var sphere = new THREE.TextureLoader().load("textures/sphere.png");
    
    // Calculate bouding box for data
    var calculateDataBoundingBox = function(xDimName, yDimName, zDimName) {
        dataBoundingBox.minX = Number.MAX_VALUE;
        dataBoundingBox.minY = Number.MAX_VALUE;
        dataBoundingBox.minZ = Number.MAX_VALUE;
        dataBoundingBox.maxX = 0;
        dataBoundingBox.maxY = 0;
        dataBoundingBox.maxZ = 0;
            
        for (var i = 0; i < model.data.length; i++) {
            var x = model.data[i][xDimName];
            var y = model.data[i][yDimName];
            var z = model.data[i][zDimName];
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
//        sprite.scale.set(40, 20, 1);
        
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
            fontsize: fontsize,
            textWidth: textWidth
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
        
        labelTickMinX = createLabel("" + dataViewCube.minX, "Arial", 24, "bottom", "right");
        labelTickMaxX = createLabel("" + dataViewCube.maxX, "Arial", 24, "bottom", "left");
        labelTickMinY = createLabel("" + dataViewCube.minY, "Arial", 24, "top", "left");
        labelTickMaxY = createLabel("" + dataViewCube.maxY, "Arial", 24, "bottom", "left");
        labelTickMinZ = createLabel("" + dataViewCube.minZ, "Arial", 24, "bottom", "left");
        labelTickMaxZ = createLabel("" + dataViewCube.maxZ, "Arial", 24, "bottom", "right");
        
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
            size: config.pointSize,
            sizeAttenuation: false,
            transparent: true,
            map: sphere,
            opacity: config.pointOpacity,
            vertexColors: THREE.VertexColors
        });
        
//        material.alphaTest = 0.5;
        material.alphaTest = 0.3;
        
        if (particles) {
            sceneData.remove(particles);
        }

        for (var j = 0; j < model.activeElements.length; j++) {
            var i = model.activeElements[j];
            geometry.vertices.push(new THREE.Vector3(model.data[i][config.xAttribute], model.data[i][config.yAttribute], model.data[i][config.zAttribute]));
            geometry.colors.push(new THREE.Color(model.data[i][config.colorAttribute]));
        }
        
        particles = new THREE.Points(geometry, material);
        sceneData.add(particles);
    };
    
    // Draw square for point selection
    var drawSelection = function() {
        var material = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 2});
        var geometry = new THREE.Geometry();
                                                      
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
    };
    
    // Draw neighbors
    var drawNeighbors = function() {
        if (neighbors) {
            sceneData.remove(neighbors);
            neighbors = null;
        }
        
        if (model.nearestActiveNeighbors.length > 0) {
            var selected = model.getSelectedActiveElement();
            
            var material = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 1});
            var geometry = new THREE.Geometry();
            
            var x0 = particles.geometry.vertices[selected].x;
            var y0 = particles.geometry.vertices[selected].y;
            var z0 = particles.geometry.vertices[selected].z;
            var x = 0;
            var y = 0;
            var z = 0;
            
            for (var i = 0; i < model.nearestActiveNeighbors.length; i++) {
                x = particles.geometry.vertices[model.nearestActiveNeighbors[i]].x;
                y = particles.geometry.vertices[model.nearestActiveNeighbors[i]].y;
                z = particles.geometry.vertices[model.nearestActiveNeighbors[i]].z;
                geometry.vertices.push(new THREE.Vector3(x0, y0, z0));
                geometry.vertices.push(new THREE.Vector3(x, y, z));
            }
            
            neighbors = new THREE.LineSegments(geometry, material);
            sceneData.add(neighbors);
        }
    }

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
        if (picked) {
            var selected = model.getSelectedActiveElement();
            if (picked != selected) {
                model.selectActiveElement(picked);
            } else {
                model.selectActiveElement(null);
            }
        }
    };
    
    // Change selected object
    var changeSelection = function(selected) {
        selection.position.set(particles.geometry.vertices[selected].x, particles.geometry.vertices[selected].y, particles.geometry.vertices[selected].z);
    }
    
    // Rescale selection shape
    var rescaleSelection = function() {
        var distance = cameraData.position.distanceTo(selection.position);
        var vFOV = cameraData.fov * Math.PI / 180;
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var scale = (width / canvas.width) * config.pointSize * window.devicePixelRatio;
        selection.scale.set(scale, scale, scale);
        
        
        var distance = cameraData.position.distanceTo(labelX.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelY.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelZ.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMinX.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMaxX.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMinY.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMaxY.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMinZ.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        var distance = cameraData.position.distanceTo(labelTickMaxZ.sprite.position);
        var width = 2 * Math.tan(vFOV / 2) * distance;
        var textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
    }
    
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
                particles.geometry.colors[highlighted] = new THREE.Color(model.data[model.getElement(highlighted)][config.colorAttribute]);
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
                var element = model.getElement(picked);
                
                var coordinate = mouse;
                d3.select("body").append("div")
                    .attr("id", "tooltip")
                    .style("left", (coordinate.x + 10) + "px")
                    .style("top", (coordinate.y - 30) + "px")
                    .html(model.data[element][config.nameAttribute] + 
                        "</br>" + model.data[element][config.groupAttribute] + " (" + model.data[element][config.subgroupAttribute] + ")" +
                          "</br>" + config.xAttribute + "=" + model.data[element][config.xAttribute] + 
                          "</br>" + config.yAttribute + "=" + model.data[element][config.yAttribute] + 
                          "</br>" + config.zAttribute + "=" + model.data[element][config.zAttribute]);
            }
            tooltip = picked;
        }
    };
    
    // Initialize GL
    var initializeGL = function() {
        sceneData = new THREE.Scene();
        cameraData = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, dataViewCube.sideSize * 20);
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
        drawSelection();

        var selected = model.getSelectedActiveElement();
        if (selected) {
            changeSelection(selected);
            sceneData.add(selection);
            drawNeighbors();
        }
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
        rescaleSelection();
        
        renderer.render(sceneData, cameraData);
    };

    this.saveImage = function() {
        var canvasScreen = document.createElement("canvas");
        canvasScreen.width = 500;
        canvasScreen.height = 500;
            
        var rendererScreen = new THREE.WebGLRenderer({
            canvas: canvasScreen,
            reserveDrawingBuffer: true,
            antialias: false
        });
        rendererScreen.setSize(canvasScreen.width, canvasScreen.height);
        rendererScreen.setPixelRatio(8);
        rendererScreen.setClearColor(0xffffff);

        rendererScreen.render(sceneData, cameraData);
            
        return rendererScreen.domElement.toDataURL();
    }
    
    var updateView = function() {
        calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
        calculateDataViewCube();
        
        cameraData.zoom = 1;
        cameraData.up.set(0, 1, 0);
        cameraData.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
        cameraData.updateProjectionMatrix();
        
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
        
        drawData();
        drawGrid();
        drawAxes();
        
        var selected = model.getSelectedActiveElement();
        if (selected) {
            changeSelection(selected);
            drawNeighbors();
        }
    }
    
    this.draw = function() {
        controls.update();
        render();
    };
    
    this.setPointSize = function(size) {
        config.pointSize = size;
        if (particles) {
            particles.material.size = size;
        }
    }
    
    this.setPointOpacity = function(alpha) {
        config.pointOpacity = alpha;
        if (particles) {
            particles.material.opacity = alpha;
        }
    }
       
    this.setXCoordinateAttr = function(name) {
        config.xAttribute = name;
        updateView();
    };
    
    this.setYCoordinateAttr = function(name) {
        config.yAttribute = name;
        updateView();
    };
    
    this.setZCoordinateAttr = function(name) {
        config.zAttribute = name;
        updateView();
    };

    this.getDataBoundingRectangle = function() {
        return dataBoundingRectangle;  
    };
    
    this.getDataViewCube = function() {
        return dataViewCube;  
    };
    
    this.deactivate = function() {
        model.removeListener("pca3d");
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
           
    calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
    calculateDataViewCube();

    model.addListener("pca3d", function(dataChanged, selectionChanged, neighborsChanged) {
        if (dataChanged) {
            drawData();
            drawGrid();
            drawAxes();
        }
        
        if (selectionChanged) {
            var selected = model.getSelectedActiveElement();
            sceneData.remove(selection);   
            if (selected) {
                changeSelection(selected);
                sceneData.add(selection);
            }
        }
        
        if (neighborsChanged) {
            drawNeighbors();
        }
    });
});