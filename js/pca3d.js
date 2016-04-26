var pca3d = (function (data, config) {
    
    var canvas = d3.select(config.canvasId).node();
    
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
    
    // Axes labels and ticks labels
    var labelX = null;
    var labelY = null;
    var labelZ = null;
    var labelTickMinX = null;
    var labelTickMaxX = null;
    var labelTickMinY = null;
    var labelTickMaxY = null;
    
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
    
    var lookupTable = new Map();
            
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
        var canvas = document.createElement('canvas');
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
    
    // Draw axes
//    var drawAxes = function() {
//        var material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
//            
//        var X_geometry = new THREE.Geometry();
//        var tickMinX_geometry = new THREE.Geometry();
//        var tickMaxX_geometry = new THREE.Geometry();
//                        
//        X_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y, 0), 
//            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y, 0));
//        tickMinX_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y, 0), 
//            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y - axesViewSquare.tickSize, 0));
//        tickMaxX_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y, 0), 
//            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y - axesViewSquare.tickSize, 0));
//            
//        sceneAxes.add(new THREE.Line(X_geometry, material));
//        sceneAxes.add(new THREE.Line(tickMinX_geometry, material));
//        sceneAxes.add(new THREE.Line(tickMaxX_geometry, material));
//        
//        var Y_geometry = new THREE.Geometry();
//        var tickMinY_geometry = new THREE.Geometry();
//        var tickMaxY_geometry = new THREE.Geometry();
//            
//        Y_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.yAxis.start.x, axesViewSquare.yAxis.start.y, 0), 
//            new THREE.Vector3(axesViewSquare.yAxis.end.x, axesViewSquare.yAxis.end.y, 0));
//        tickMinY_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.yAxis.start.x, axesViewSquare.yAxis.start.y, 0), 
//            new THREE.Vector3(axesViewSquare.yAxis.start.x - axesViewSquare.tickSize, axesViewSquare.yAxis.start.y, 0));
//        tickMaxY_geometry.vertices.push(
//            new THREE.Vector3(axesViewSquare.yAxis.end.x, axesViewSquare.yAxis.end.y, 0), 
//            new THREE.Vector3(axesViewSquare.yAxis.end.x - axesViewSquare.tickSize, axesViewSquare.yAxis.end.y, 0));
//            
//        sceneAxes.add(new THREE.Line(Y_geometry, material));
//        sceneAxes.add(new THREE.Line(tickMinY_geometry, material));
//        sceneAxes.add(new THREE.Line(tickMaxY_geometry, material));
//
//        labelTickMinX = createLabel(getTickXLabel(axesViewSquare.xAxis.start.x, dataViewSquare.minX, dataViewSquare.maxX), "Arial", 16, "bottom", "");
//        labelTickMaxX = createLabel(getTickXLabel(axesViewSquare.xAxis.end.x, dataViewSquare.minX, dataViewSquare.maxX), "Arial", 16, "bottom", "");
//        labelTickMinY = createLabel(getTickYLabel(axesViewSquare.yAxis.start.y, dataViewSquare.minY, dataViewSquare.maxY), "Arial", 16, "", "left");
//        labelTickMaxY = createLabel(getTickYLabel(axesViewSquare.yAxis.end.y, dataViewSquare.minY, dataViewSquare.maxY), "Arial", 16, "", "left");
//        
//        labelTickMinX.sprite.position.set(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y - axesViewSquare.tickSize, 0);
//        labelTickMaxX.sprite.position.set(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y - axesViewSquare.tickSize, 0);
//        labelTickMinY.sprite.position.set(axesViewSquare.yAxis.start.x - axesViewSquare.tickSize - 0.1, axesViewSquare.yAxis.start.y, 0);
//        labelTickMaxY.sprite.position.set(axesViewSquare.yAxis.end.x - axesViewSquare.tickSize - 0.1, axesViewSquare.yAxis.end.y, 0);
//
//        sceneAxes.add(labelTickMinX.sprite);
//        sceneAxes.add(labelTickMaxX.sprite);
//        sceneAxes.add(labelTickMinY.sprite);
//        sceneAxes.add(labelTickMaxY.sprite);
//            
//        labelX = createLabel(config.xAttribute, "Arial", 24, "top", "");
//        labelY = createLabel(config.yAttribute, "Arial", 24, "", "right");
//            
//        labelX.sprite.position.set(0, axesViewSquare.minY, 0);
//        labelY.sprite.position.set(axesViewSquare.minX, 0, 0);
//            
//        sceneAxes.add(labelX.sprite);
//        sceneAxes.add(labelY.sprite);
//    };
    
    // Draw axes.
    function drawAxes() {
        var axis_material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
        var arrow_material = new THREE.MeshBasicMaterial({color: 0x000000});
                
        var arrow_geometry = new THREE.CylinderGeometry(0, 1, 4, 12, 1, true);
                
        var X_geometry = new THREE.Geometry();
		var Y_geometry = new THREE.Geometry();
		var Z_geometry = new THREE.Geometry();
                
		X_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.minZ), 
            new THREE.Vector3(dataViewCube.maxX, dataViewCube.minY, dataViewCube.minZ));
		Y_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.minZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.maxY, dataViewCube.minZ));
		Z_geometry.vertices.push(
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.minZ), 
            new THREE.Vector3(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ));
                                
		sceneData.add(new THREE.Line(X_geometry, axis_material));
		sceneData.add(new THREE.Line(Y_geometry, axis_material));
		sceneData.add(new THREE.Line(Z_geometry, axis_material));
        
        labelX = createLabel(config.xAttribute, "Arial", 24, "top", "");
        labelY = createLabel(config.yAttribute, "Arial", 24, "top", "");
        labelZ = createLabel(config.zAttribute, "Arial", 24, "top", "");
        
        labelX.sprite.position.set(dataViewCube.maxX, dataViewCube.minY, dataViewCube.minZ);
        labelY.sprite.position.set(dataViewCube.minX, dataViewCube.maxY, dataViewCube.minZ);
        labelZ.sprite.position.set(dataViewCube.minX, dataViewCube.minY, dataViewCube.maxZ);
            
        sceneData.add(labelX.sprite);
        sceneData.add(labelY.sprite);
        sceneData.add(labelZ.sprite);
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
    
    // Draw data
    var drawData = function() {
        var geometry = new THREE.Geometry();
//        var material = new THREE.PointsMaterial({
//            size: 10.0,
//            sizeAttenuation: false,
//            transparent: true,
//            opacity: 0.7,
//            vertexColors: THREE.VertexColors
//        });
        
        var circle = THREE.ImageUtils.loadTexture("textures/sphere.png");
        
        var material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 10,
            sizeAttenuation: false,
            transparent: true,
            map: circle,
           // opacity: 0.7,
            vertexColors: THREE.VertexColors
        });
        
        material.depthWrite = false;
                    
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
                j++;
            }
        }
                
        particles = new THREE.Points(geometry, material);
        //particles.sortParticles = true;
        sceneData.add(particles);
    };    
    
    // Update normalized mouse coordinates on mouse move event inside canvas
    var onMouseMoveInsideCanvas = function() {
        var boundingClientRect = canvas.getBoundingClientRect();
        mouse.x = d3.event.x;
        mouse.y = d3.event.y;
        mouse2d.x = ((d3.event.x - boundingClientRect.left) / canvas.width) * 2 * window.devicePixelRatio - 1;
        mouse2d.y = (-(d3.event.y - boundingClientRect.top) / canvas.height) * 2 * window.devicePixelRatio + 1;
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
        
        cameraData = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        cameraData.position.set(1.5 * dataViewCube.maxX, 1.5 * dataViewCube.maxY, 1.5 * dataViewCube.maxZ);
                        
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
    };
    
    // Initialize view
    var initializeScene = function() {
        drawData();
        drawAxes();  
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
        
        renderer.render(sceneData, cameraData);
    };
    
    this.updateData = function() {
        drawData();
    }
    
    this.draw = function() {
        controls.update();
        render();
    };
    
    this.setNameAttribute = function () {
        
    };
    
    this.setGroupAttribute = function () {
        
    };
    
    this.setXCoordinateAttr = function () {
        
    };
    
    this.setYCoordinateAttr = function () {
        
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
    }
    
    calculateDataBoundingBox(config.xAttribute, config.yAttribute, config.zAttribute);
    calculateDataViewCube();
    

    
});