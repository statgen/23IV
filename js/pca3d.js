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
        
    var scene = null;
    var camera = null;
    var renderer = null;
    var raycaster = null;
    var controls = null;
    
    var particlesByGroup = null;
    var particlesInScene = null;
    
    var selection = null;
    var selectionId = -1;
    
    var grid = null;
    var axes = null;
    var ticks = null;
    var neighbors = null;
    
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
    var mouse = {
        x: 0, 
        y: 0
    };
    
    // Normalized mouse position in canvas
    var mouse2d = new THREE.Vector2();
    
    // Currently picked object
    var picked = {
        group: null,
        index: null
    };
    
    // Currently highlighted object
    var highlighted = {
        group: null,
        index: null
    };

    // Currently tipped objtect
    var tooltip = {
        group: null,
        index: null
    };

    var symbols = new Array(7);
    
    // Initialize symbols
    for (var i = 0; i < symbols.length; i++) {
        symbols[i] = new THREE.TextureLoader().load("textures/2d_" + i + ".png");
    }        
    
    // Calculate bouding box for data
    var calculateDataBoundingBox = function(xDim, yDim, zDim) {
        dataBoundingBox.minX = Number.MAX_VALUE;
        dataBoundingBox.minY = Number.MAX_VALUE;
        dataBoundingBox.minZ = Number.MAX_VALUE;
        dataBoundingBox.maxX = 0;
        dataBoundingBox.maxY = 0;
        dataBoundingBox.maxZ = 0;
            
        for (var i = 0; i < model.points.length; i++) {
            var x = model.points[i].loc[xDim];
            var y = model.points[i].loc[yDim];
            var z = model.points[i].loc[zDim];
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
    var createLabel = function(text, fontface, fontsize, valign, halign, canvasWidth) {
        var canvas = document.createElement("canvas");
        var context = canvas.getContext("2d");
        
        if (canvasWidth) {
            canvas.width = canvasWidth;
            canvas.height = canvasWidth / 2;
        }
            
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
            scene.remove(axes);
        }
        
        if (ticks) {
            scene.remove(ticks);
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
        scene.add(axes);
        
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
        scene.add(ticks);
        
        if (labelX) {
            scene.remove(labelX.sprite);
        }
        
        if (labelY) {
            scene.remove(labelY.sprite);
        }
        
        if (labelZ) {
            scene.remove(labelZ.sprite);
        }
        
        labelX = createLabel(model.dimensions[config.xDim], "Arial", 32, "bottom", "");
        labelY = createLabel(model.dimensions[config.yDim], "Arial", 32, "", "left");
        labelZ = createLabel(model.dimensions[config.zDim], "Arial", 32, "bottom", "");
        
        labelX.sprite.position.set(dataViewCube.centerX, dataViewCube.minY, dataViewCube.maxZ + 5);
        labelY.sprite.position.set(dataViewCube.minX, dataViewCube.centerY, dataViewCube.maxZ + 5);
        labelZ.sprite.position.set(dataViewCube.maxX + 5, dataViewCube.minY, dataViewCube.centerZ);
            
        scene.add(labelX.sprite);
        scene.add(labelY.sprite);
        scene.add(labelZ.sprite);
        
        if (labelTickMinX) {
            scene.remove(labelTickMinX.sprite);
        }
        
        if (labelTickMaxX) {
            scene.remove(labelTickMaxX.sprite);
        }
        
        if (labelTickMinY) {
            scene.remove(labelTickMinY.sprite);
        }
        
        if (labelTickMaxY) {
            scene.remove(labelTickMaxY.sprite);    
        }
        
        if (labelTickMinZ) {
            scene.remove(labelTickMinZ.sprite);
        }
        
        if (labelTickMaxZ) {
            scene.remove(labelTickMaxZ.sprite);
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
        
        scene.add(labelTickMinX.sprite);
        scene.add(labelTickMaxX.sprite);
        scene.add(labelTickMinY.sprite);
        scene.add(labelTickMaxY.sprite);
        scene.add(labelTickMinZ.sprite);
        scene.add(labelTickMaxZ.sprite);
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
            scene.remove(grid);
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
            scene.add(grid);
        }
    };
    
    // Draw data
    var drawData = function() {
        for (var group in model.pointsByGroup) {
            var particles = scene.getObjectByName(group);
            if ((particles !== undefined) && (particles !== null)) {
                scene.remove(particles);
            }
        }
        
        particlesByGroup = {};
        particlesInScene = [];
        
        // Prepare all particles.
        for (var group in model.pointsByGroup) {
            var geometry = new THREE.Geometry();
            var points = model.pointsByGroup[group];
            var symbol = model.groups[group].symbol;
            var color = model.groups[group].color;
            
            var material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: config.pointSize,
                sizeAttenuation: false,
                transparent: true,
                map: symbols[symbol],
                opacity: model.groups[group].opacity,
                vertexColors: THREE.VertexColors
            });
            material.alphaTest = 0.3;
            
            for (var i = 0; i < points.length; i++) {
                var j = points[i];
                geometry.vertices.push(
                    new THREE.Vector3(model.points[j].loc[config.xDim], model.points[j].loc[config.yDim], model.points[j].loc[config.zDim]));
                geometry.colors.push(new THREE.Color(color));
            }
            var particles = new THREE.Points(geometry, material);
            particles.name = group;
            particlesByGroup[group] = particles;
        }
        
        // Initially add to the scene partincles only for active(selected by user) groups.
        for (var group in model.activeGroups) {
            scene.add(particlesByGroup[group]);
            particlesInScene.push(particlesByGroup[group]);
        }
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
        selectionId = selection.id;
    };
    
    // Draw neighbors
    var drawNeighbors = function() {
        if (neighbors) {
            scene.remove(neighbors);
            neighbors = null;
        }
        
        if (model.nearestNeighbors.length > 0) {
            var s = model.getSelection();
            
            var material = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 1});
            var geometry = new THREE.Geometry();
            
            var x0 = particlesByGroup[s.group].geometry.vertices[s.index].x;
            var y0 = particlesByGroup[s.group].geometry.vertices[s.index].y;
            var z0 = particlesByGroup[s.group].geometry.vertices[s.index].z;
            var x = 0;
            var y = 0;
            var z = 0;
            
            for (var i = 0; i < model.nearestNeighbors.length; i++) {
                particle = model.nearestNeighbors[i];
                particlesInGroup = particlesByGroup[particle.group];
                x = particlesInGroup.geometry.vertices[particle.index].x;
                y = particlesInGroup.geometry.vertices[particle.index].y;
                z = particlesInGroup.geometry.vertices[particle.index].z;
                geometry.vertices.push(new THREE.Vector3(x0, y0, z0));
                geometry.vertices.push(new THREE.Vector3(x, y, z));
            }
            
            neighbors = new THREE.LineSegments(geometry, material);
            scene.add(neighbors);
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
        if ((picked.group != null) && (picked.index != null)) {
            if (model.isPointSelected(picked.group, picked.index)) {
                model.selectPoint(null, null);
            } else {
                model.selectPoint(picked.group, picked.index);
            }
        }
    };
    
    // Change selected object
    var changeSelection = function(group, index) {
        selection.position.set(particlesByGroup[group].geometry.vertices[index].x, particlesByGroup[group].geometry.vertices[index].y, particlesByGroup[group].geometry.vertices[index].z);
    }
    
    // Rescale selection shape
    var rescaleSelection = function() {
        var vFOV = camera.fov * Math.PI / 180;
        var distance = 0;
        var width = 0;
        var scale = 0;
        
        distance = camera.position.distanceTo(selection.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        scale = (width / canvas.width) * config.pointSize * window.devicePixelRatio;
        selection.scale.set(scale, scale, scale);
        
        distance = camera.position.distanceTo(labelX.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelY.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelZ.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMinX.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMaxX.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxX.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMinY.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMaxY.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxY.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMinZ.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMinZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
        
        distance = camera.position.distanceTo(labelTickMaxZ.sprite.position);
        width = 2 * Math.tan(vFOV / 2) * distance;
        textScale = (width / canvas.width) * window.devicePixelRatio;
        labelTickMaxZ.sprite.scale.set(textScale * 120, textScale * 60, 1);
    }
    
    // Find 3D object under mouse pointer
    var updatePicked = function() {
        raycaster.setFromCamera(mouse2d, camera);
        intersects = raycaster.intersectObjects(particlesInScene);
        if (intersects.length > 0) {
            picked.group = intersects[0].object.name;
            picked.index = intersects[0].index;
        } else {
            picked.group = null;
            picked.index = null;
        }
    };
    
    // Highlight picked 3D object
    var highlightPicked = function() {
        if ((picked.group != highlighted.group) || (picked.index != highlighted.index)) {
            if ((highlighted.group != null) && (highlighted.index != null)) {
                particlesByGroup[highlighted.group].geometry.colors[highlighted.index] = new THREE.Color(model.groups[highlighted.group].color);
                particlesByGroup[highlighted.group].geometry.colorsNeedUpdate = true;
            }
            if ((picked.group != null) && (picked.index != null)) {
                particlesByGroup[picked.group].geometry.colors[picked.index] = new THREE.Color(0xff00ff);
                particlesByGroup[picked.group].geometry.colorsNeedUpdate = true;
            }
            highlighted.group = picked.group;
            highlighted.index = picked.index;
        }
    };
    
    // Create/remove tooltip
    var updateTooltip = function() {
        if ((picked.group != tooltip.group) || (picked.index != tooltip.index)) {
            d3.select("#tooltip").remove();
            if ((picked.group != null) && (picked.index != null)) {
                var point = model.getPoint(picked.group, picked.index);
                var coordinate = mouse;
                var html = point.id + "</br>" + point.grp;
                if (point.pop) {
                    html += " (" + point.pop + ")";
                }
                html += "</br>" + model.dimensions[config.xDim] + "=" + point.loc[config.xDim] + 
                    "</br>" + model.dimensions[config.yDim] + "=" + point.loc[config.yDim]
                d3.select("body").append("div")
                    .attr("id", "tooltip")
                    .style("left", (coordinate.x + 10) + "px")
                    .style("top", (coordinate.y - 30) + "px")
                    .html(html);
            }
            tooltip.group = picked.group;
            tooltip.index = picked.index;
        }
    };
    
    // Initialize GL
    var initializeGL = function() {
        scene = new THREE.Scene();
        
        camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, dataViewCube.sideSize * 20);
        camera.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
                        
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xffffff);
        renderer.autoClear = true;

        raycaster = new THREE.Raycaster();
    }
    
    // Initialize controls.
    var initializeControls = function() {
        controls = new THREE.TrackballControls(camera, canvas);
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
        
        if (model.hasSelectedPoint()) {
            var s = model.getSelection();
            changeSelection(s.group, s.index);
            scene.add(selection);
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
        
        renderer.render(scene, camera);
    };
    
    var drawLegend = function() {
        var labelfontsize = 32;
        var groupfontsize = 28;
        var starx = 60;
        var starty = 90;
        var stepy = -5;
        
        var scene = new THREE.Scene();
        var name = null;
        
        name = createLabel("Reference", "Arial", labelfontsize, "", "right", 500);
        name.sprite.scale.set(70, 35, 1);
        name.sprite.position.set(starx, starty, 0);
        scene.add(name.sprite);
        starty += stepy;
        
        for (var group in model.groups) {
            if (!model.isGroupActive(group)) {
                continue;
            }
            if (!model.groups[group].reference) {
                continue;
            }
            var geometry = new THREE.Geometry();
            var material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 10,
                sizeAttenuation: false,
                transparent: true,
                map: symbols[model.groups[group].symbol],
                vertexColors: THREE.VertexColors
            });
            geometry.vertices.push(new THREE.Vector3(starx + 2, starty, 0));
            geometry.colors.push(new THREE.Color(model.groups[group].color));
            scene.add(new THREE.Points(geometry, material));
            
            name = createLabel(group, "Arial", groupfontsize, "", "right", 500);
            name.sprite.scale.set(70, 35, 1);
            name.sprite.position.set(starx + 5, starty, 0);
            scene.add(name.sprite);
            
            starty += stepy;
        }
        
        starty -= 3;
        
        name = createLabel("Study", "Arial", labelfontsize, "", "right", 500);
        name.sprite.scale.set(70, 35, 1);
        name.sprite.position.set(starx, starty, 0);
        scene.add(name.sprite);
        starty += stepy;
        
        for (var group in model.groups) {
            if (!model.isGroupActive(group)) {
                continue;
            }
            if (model.groups[group].reference) {
                continue;
            }
            var geometry = new THREE.Geometry();
            var material = new THREE.PointsMaterial({
                color: 0xffffff,
                size: 10,
                sizeAttenuation: false,
                transparent: true,
                map: symbols[model.groups[group].symbol],
                vertexColors: THREE.VertexColors
            });
            geometry.vertices.push(new THREE.Vector3(starx + 2, starty, 0));
            geometry.colors.push(new THREE.Color(model.groups[group].color));
            scene.add(new THREE.Points(geometry, material));
            
            name = createLabel(group, "Arial", groupfontsize, "", "right", 500);
            name.sprite.scale.set(70, 35, 1);
            name.sprite.position.set(starx + 5, starty, 0);
            scene.add(name.sprite);
            
            starty += stepy;
        }
        
        return scene;
    }

    this.saveImage = function(legend) {
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
        rendererScreen.autoClear = false;

        rendererScreen.clear();
        rendererScreen.render(scene, camera);
        
        if (legend == true) {
            var cameraLegend = new THREE.OrthographicCamera(-100, 100, 100, -100, 0, 100);
            cameraLegend.position.set(0, 0, 100);
            
            rendererScreen.clearDepth();
            rendererScreen.render(drawLegend(), cameraLegend);
        }
            
        return rendererScreen.domElement.toDataURL();
    }
    
    var updateView = function() {
        calculateDataBoundingBox(config.xDim, config.yDim, config.zDim);
        calculateDataViewCube();
        
        camera.zoom = 1;
        camera.up.set(0, 1, 0);
        camera.position.set(3 * dataViewCube.maxX, 3 * dataViewCube.maxY, 3 * dataViewCube.maxZ);
        camera.updateProjectionMatrix();
        
        controls.target.set(dataViewCube.centerX, dataViewCube.centerY, dataViewCube.centerZ);
        
        drawData();
        drawGrid();
        drawAxes();
        
        if (model.hasSelectedPoint()) {
            var point = model.getSelection();
            changeSelection(point.group, point.index);
            drawNeighbors();
        }
    }
    
    this.draw = function() {
        controls.update();
        render();
    };
    
    this.setPointSize = function(size) {
        config.pointSize = size;
        for (var group in particlesByGroup) {
            particlesByGroup[group].material.size = size;
        }
    }
    
    this.setPointOpacity = function(alpha) {
        config.pointOpacity = alpha;
        for (var group in particlesByGroup) {
            particlesByGroup[group].material.opacity = alpha;
        }
    }
       
    this.setXDimension = function(dim) {
        config.xDim = dim;
        updateView();
    };
    
    this.setYDimension = function(dim) {
        config.yDim = dim;
        updateView();
    };
    
    this.setZDimension = function(dim) {
        config.zDim = dim;
        updateView();
    };

    this.getDataBoundingRectangle = function() {
        return dataBoundingRectangle;  
    };
    
    this.getDataViewCube = function() {
        return dataViewCube;  
    };
    
    this.deactivate = function() {
        model.removeListener("onGroupChange", "pca3d");
        model.removeListener("onSelectionChange", "pca3d");
        model.removeListener("onNeighborsChange", "pca3d");
        model.removeListener("onGroupColorChange", "pca3d");
        model.removeListener("onGroupOpacityChange", "pca3d");
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
                scene.add(grid);
            }
        }
    }
    
    this.disableGrid = function(enable) {
         if (grid) {
            if (config.grid) {
                config.grid = false;
                scene.remove(grid);
            }
        }
    }
           
    calculateDataBoundingBox(config.xDim, config.yDim, config.zDim);
    calculateDataViewCube();
    
    model.addListener("onGroupChange", "pca3d", function() {
        particlesInScene = [];
        for (var group in particlesByGroup) {
            var particles = scene.getObjectByName(group);
            if (!model.isGroupActive(group)) {
                if ((particles !== undefined) && (particles !== null)) {
                    scene.remove(particles);
                }
            } else {
                if ((particles === undefined) || (particles === null)) {
                    scene.add(particlesByGroup[group]);
                }
                particlesInScene.push(particlesByGroup[group]);
            }
        }
    });
    
    model.addListener("onSelectionChange", "pca3d", function() {
        var object = scene.getObjectById(selectionId);
        
        if (model.hasSelectedPoint()) {
            var s = model.getSelection();
            changeSelection(s.group, s.index);
            if ((object === null) || (object === undefined)) {
                scene.add(selection);
            }            
        } else {
            if ((object !== null) && (object !== undefined)) {
                scene.remove(selection);
            }
        }
    });
    
    model.addListener("onNeighborsChange", "pca3d", function() {
        drawNeighbors();
    });
    
    model.addListener("onGroupColorChange", "pca3d", function(group) {
        var colors = particlesByGroup[group].geometry.colors;
        var newColor = model.groups[group].color;
        for (var i = 0; i < colors.length; i++) {
            colors[i] = new THREE.Color(newColor);    
        }
        particlesByGroup[group].geometry.colorsNeedUpdate = true;
    });
    
    model.addListener("onGroupOpacityChange", "pca3d", function(group) {
        particlesByGroup[group].material.opacity = groups[group].opacity;
    });
    
});