var pca2d = (function (model, config) {
    
    var canvas = d3.select(config.canvasId).node();
    var originalCanvasWidth = canvas.width;
    var originalCanvasHeight = canvas.height;
    
    // Bounding rectangle for data
    var dataBoundingRectangle = {
        minX: Number.MAX_VALUE,
        minY: Number.MAX_VALUE,
        maxX: 0,
        maxY: 0,
        centerX: Number.MAX_VALUE,
        centerY: Number.MAX_VALUE,
        width: 0,
        height: 0
    };
    
    // Bounding square for data viewing that will fit into squared canvas without stretching/squezzing the drawing.
    var dataViewSquare = {
        minX: Number.MAX_VALUE,
        minY: Number.MAX_VALUE,
        maxX: 0,
        maxY: 0,
        centerX: Number.MAX_VALUE,
        centerY: Number.MAX_VALUE,
        sideSize: 0
    };
    
    // Bounding square for fixed view of X and Y axes on top of data view.
    var axesViewSquare = {
        minX: -50,
        maxX: 50,
        minY: -50,
        maxY: 50,
        sideSize: 100,
        tickSize: 1,
        margin: 10,
        labelOffset: 2,
        xAxis: {
            start: {x: -40, y: -40},
            end: {x: 40, y: -40}
        },
        yAxis: {
            start: {x: -40, y: -40},
            end: {x: -40, y: 40}
        }
    }
    
    var sceneData = null;
    var sceneAxes = null;
    var sceneGrid = null;
    var cameraData = null;
    var cameraAxes = null;
    var cameraGrid = null;
    var renderer = null;
    var raycaster = null;
    var controls = null;
    var particles = null;
    var grid = null;
    var selection = null;
    var neighbors = null;
    
    // Axes labels and ticks labels
    var labelX = null;
    var labelY = null;
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
    
    var circle = new THREE.TextureLoader().load("textures/circle.png");
                
    // Calculate bouding rectangle for data
    var calculateDataBoundingRectangle = function(xDimName, yDimName) {
        dataBoundingRectangle.minX = Number.MAX_VALUE;
        dataBoundingRectangle.minY = Number.MAX_VALUE;
        dataBoundingRectangle.maxX = 0;
        dataBoundingRectangle.maxY = 0;
            
        for (var i = 0; i < model.data.length; i++) {
            x = model.data[i][xDimName];
            y = model.data[i][yDimName];
            if (x > dataBoundingRectangle.maxX) { dataBoundingRectangle.maxX = x; }
            if (x < dataBoundingRectangle.minX) { dataBoundingRectangle.minX = x; }
            if (y > dataBoundingRectangle.maxY) { dataBoundingRectangle.maxY = y; }
            if (y < dataBoundingRectangle.minY) { dataBoundingRectangle.minY = y; }
        }
            
        dataBoundingRectangle.centerX = dataBoundingRectangle.minX + (dataBoundingRectangle.maxX - dataBoundingRectangle.minX) / 2;
        dataBoundingRectangle.centerY = dataBoundingRectangle.minY + (dataBoundingRectangle.maxY - dataBoundingRectangle.minY) / 2;
            
        dataBoundingRectangle.width = dataBoundingRectangle.maxX - dataBoundingRectangle.minX;
        dataBoundingRectangle.height = dataBoundingRectangle.maxY - dataBoundingRectangle.minY;
    }
    
    // Calculate view square for data
    var calculateDataViewSquare = function() {
        dataViewSquare.minX = Math.floor(dataBoundingRectangle.minX);
        dataViewSquare.maxX = Math.ceil(dataBoundingRectangle.maxX);
        dataViewSquare.minY = Math.floor(dataBoundingRectangle.minY);
        dataViewSquare.maxY = Math.ceil(dataBoundingRectangle.maxY);
                   
        dataViewSquare.sideSize = Math.max(dataViewSquare.maxX - dataViewSquare.minX, dataViewSquare.maxY - dataViewSquare.minY);
        
        if (dataViewSquare.maxX - dataViewSquare.minX < dataViewSquare.sideSize) {
            var append = dataViewSquare.sideSize - dataViewSquare.maxX + dataViewSquare.minX;
            dataViewSquare.minX = dataViewSquare.minX - Math.floor(append / 2);
            dataViewSquare.maxX = dataViewSquare.maxX + Math.ceil(append / 2);            
        } else if (dataViewSquare.maxY - dataViewSquare.minY < dataViewSquare.sideSize) {
            var append = dataViewSquare.sideSize - dataViewSquare.maxY + dataViewSquare.minY;
            dataViewSquare.minY = dataViewSquare.minY - Math.floor(append / 2);
            dataViewSquare.maxY = dataViewSquare.maxY + Math.ceil(append / 2);
        }
                    
        var unit = dataViewSquare.sideSize / (axesViewSquare.sideSize - 2 * axesViewSquare.margin);
        
        dataViewSquare.minX = dataViewSquare.minX - axesViewSquare.margin * unit;
        dataViewSquare.maxX = dataViewSquare.maxX + axesViewSquare.margin * unit;
        dataViewSquare.minY = dataViewSquare.minY - axesViewSquare.margin * unit;
        dataViewSquare.maxY = dataViewSquare.maxY + axesViewSquare.margin * unit;
        dataViewSquare.sideSize = dataViewSquare.sideSize + 2 * axesViewSquare.margin * unit;
        dataViewSquare.centerX = dataViewSquare.minX + (dataViewSquare.maxX - dataViewSquare.minX) / 2;
        dataViewSquare.centerY = dataViewSquare.minY + (dataViewSquare.maxY - dataViewSquare.minY) / 2;   
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
    
    // Get X axis tick label at tick_position
    var getTickXLabel = function(tick_position, data_view_minX, data_view_maxX) {
        var unit = (data_view_maxX - data_view_minX) / axesViewSquare.sideSize;
        var  label = data_view_minX + unit * (tick_position - axesViewSquare.minX);
        return label.toFixed(2);
    };
    
    // Get Y axis tick label at tick_position
    var getTickYLabel = function(tick_position, data_view_minY, data_view_maxY) {
        var unit = (data_view_maxY - data_view_minY) / axesViewSquare.sideSize;
        var label = data_view_minY + unit * (tick_position - axesViewSquare.minY);
        return label.toFixed(2);
    };
    
    // Draw axes
    var drawAxes = function() {
        var material = new THREE.LineBasicMaterial({color: 0x000000, linewidth: 1});
            
        var X_geometry = new THREE.Geometry();
        var tickMinX_geometry = new THREE.Geometry();
        var tickMaxX_geometry = new THREE.Geometry();
                        
        X_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y, 0), 
            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y, 0));
        tickMinX_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y, 0), 
            new THREE.Vector3(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y - axesViewSquare.tickSize, 0));
        tickMaxX_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y, 0), 
            new THREE.Vector3(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y - axesViewSquare.tickSize, 0));
            
        sceneAxes.add(new THREE.Line(X_geometry, material));
        sceneAxes.add(new THREE.Line(tickMinX_geometry, material));
        sceneAxes.add(new THREE.Line(tickMaxX_geometry, material));
        
        var Y_geometry = new THREE.Geometry();
        var tickMinY_geometry = new THREE.Geometry();
        var tickMaxY_geometry = new THREE.Geometry();
            
        Y_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.yAxis.start.x, axesViewSquare.yAxis.start.y, 0), 
            new THREE.Vector3(axesViewSquare.yAxis.end.x, axesViewSquare.yAxis.end.y, 0));
        tickMinY_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.yAxis.start.x, axesViewSquare.yAxis.start.y, 0), 
            new THREE.Vector3(axesViewSquare.yAxis.start.x - axesViewSquare.tickSize, axesViewSquare.yAxis.start.y, 0));
        tickMaxY_geometry.vertices.push(
            new THREE.Vector3(axesViewSquare.yAxis.end.x, axesViewSquare.yAxis.end.y, 0), 
            new THREE.Vector3(axesViewSquare.yAxis.end.x - axesViewSquare.tickSize, axesViewSquare.yAxis.end.y, 0));
            
        sceneAxes.add(new THREE.Line(Y_geometry, material));
        sceneAxes.add(new THREE.Line(tickMinY_geometry, material));
        sceneAxes.add(new THREE.Line(tickMaxY_geometry, material));

        labelTickMinX = createLabel(getTickXLabel(axesViewSquare.xAxis.start.x, dataViewSquare.minX, dataViewSquare.maxX), "Arial", 16, "bottom", "");
        labelTickMaxX = createLabel(getTickXLabel(axesViewSquare.xAxis.end.x, dataViewSquare.minX, dataViewSquare.maxX), "Arial", 16, "bottom", "");
        labelTickMinY = createLabel(getTickYLabel(axesViewSquare.yAxis.start.y, dataViewSquare.minY, dataViewSquare.maxY), "Arial", 16, "", "left");
        labelTickMaxY = createLabel(getTickYLabel(axesViewSquare.yAxis.end.y, dataViewSquare.minY, dataViewSquare.maxY), "Arial", 16, "", "left");
        
        labelTickMinX.sprite.position.set(axesViewSquare.xAxis.start.x, axesViewSquare.xAxis.start.y - axesViewSquare.tickSize, 0);
        labelTickMaxX.sprite.position.set(axesViewSquare.xAxis.end.x, axesViewSquare.xAxis.end.y - axesViewSquare.tickSize, 0);
        labelTickMinY.sprite.position.set(axesViewSquare.yAxis.start.x - axesViewSquare.tickSize - 0.1, axesViewSquare.yAxis.start.y, 0);
        labelTickMaxY.sprite.position.set(axesViewSquare.yAxis.end.x - axesViewSquare.tickSize - 0.1, axesViewSquare.yAxis.end.y, 0);

        sceneAxes.add(labelTickMinX.sprite);
        sceneAxes.add(labelTickMaxX.sprite);
        sceneAxes.add(labelTickMinY.sprite);
        sceneAxes.add(labelTickMaxY.sprite);
            
        labelX = createLabel(config.xAttribute, "Arial", 24, "bottom", "");
        labelY = createLabel(config.yAttribute, "Arial", 24, "", "left");
            
        labelX.sprite.position.set(0, axesViewSquare.xAxis.start.y - axesViewSquare.labelOffset, 0);
        labelY.sprite.position.set(axesViewSquare.yAxis.start.x - axesViewSquare.labelOffset, 0, 0);
            
        sceneAxes.add(labelX.sprite);
        sceneAxes.add(labelY.sprite);
    };
    
    // Draw data
    var drawData = function() {
        var geometry = new THREE.Geometry();
        
        var material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 10,
            sizeAttenuation: false,
            transparent: true,
            map: circle,
            opacity: 0.7,
            vertexColors: THREE.VertexColors
        });
        
        material.depthWrite = false;
          
        if (particles) {
            sceneData.remove(particles);
        }

        for (var j = 0; j < model.activeElements.length; j++) {
            var i = model.activeElements[j];
            geometry.vertices.push(new THREE.Vector3(model.data[i][config.xAttribute], model.data[i][config.yAttribute], 0));
            geometry.colors.push(new THREE.Color(model.data[i][config.colorAttribute]));
        }
        
        particles = new THREE.Points(geometry, material);
        sceneData.add(particles);
    };
    
    // Draw grid
    var drawGrid = function() {
        var material = new THREE.LineBasicMaterial({color: 0xD3D3D3, linewidth: 1});
        var geometry = new THREE.Geometry();
        var step = (axesViewSquare.sideSize - 2 * axesViewSquare.margin) / 10;
        
        if (grid) {
            sceneGrid.add(grid);
        }
        
        for (var x = axesViewSquare.minX + axesViewSquare.margin + step; x <= axesViewSquare.maxX - axesViewSquare.margin; x += step) {
            geometry.vertices.push(new THREE.Vector3(x, axesViewSquare.minY + axesViewSquare.margin, 0));
            geometry.vertices.push(new THREE.Vector3(x, axesViewSquare.maxY - axesViewSquare.margin, 0));
        }
        
        for (var y = axesViewSquare.minY + axesViewSquare.margin + step; y <= axesViewSquare.maxY - axesViewSquare.margin; y += step) {
            geometry.vertices.push(new THREE.Vector3(axesViewSquare.minX + axesViewSquare.margin, y, 0));
            geometry.vertices.push(new THREE.Vector3(axesViewSquare.maxX - axesViewSquare.margin, y, 0));
        }
        
        grid = new THREE.LineSegments(geometry, material);
        
        if (config.grid) {
            sceneGrid.add(grid);
        }
    };
    
    // Draw square for point selection
    var drawSelection = function() {
        var material = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 2});
        var geometry = new THREE.Geometry();
        
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0));
        geometry.vertices.push(new THREE.Vector3(0.5, -0.5, 0));
        geometry.vertices.push(new THREE.Vector3(0.5, 0.5, 0));
        geometry.vertices.push(new THREE.Vector3(-0.5, 0.5, 0));
        geometry.vertices.push(new THREE.Vector3(-0.5, -0.5, 0));
            
        selection = new THREE.Line(geometry, material);
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
            var x = 0;
            var y = 0;
            
            for (var i = 0; i < model.nearestActiveNeighbors.length; i++) {
                x = particles.geometry.vertices[model.nearestActiveNeighbors[i]].x;
                y = particles.geometry.vertices[model.nearestActiveNeighbors[i]].y;
                geometry.vertices.push(new THREE.Vector3(x0, y0, 0));
                geometry.vertices.push(new THREE.Vector3(x, y, 0));
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
        selection.position.set(particles.geometry.vertices[selected].x, particles.geometry.vertices[selected].y, 0);
    }
    
    // Rescale selection shape
    var rescaleSelection = function() {
        var normalizedSize = (dataViewSquare.sideSize / canvas.width) * 10 * window.devicePixelRatio;
        var size = normalizedSize / cameraData.zoom;
        selection.scale.set(size, size, size);
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
            var element = model.getElement(picked);
            
            d3.select("#tooltip").remove();
            if (picked != null) {
                var coordinate = mouse;
                d3.select("body").append("div")
                    .attr("id", "tooltip")
                    .style("left", (coordinate.x + 10) + "px")
                    .style("top", (coordinate.y - 30) + "px")
                    .html(model.data[element][config.nameAttribute] + 
                          "</br>" + model.data[element][config.groupAttribute] + " (" + model.data[element][config.subgroupAttribute] + ")" +
                              "</br>" + config.xAttribute + "=" + model.data[element][config.xAttribute] +
                              "</br>" + config.yAttribute + "=" + model.data[element][config.yAttribute]);
            }
            tooltip = picked;
        }
    };
    
    // Initialize GL
    var initializeGL = function() {
        sceneData = new THREE.Scene();
        sceneAxes = new THREE.Scene();
        sceneGrid = new THREE.Scene();
            
        cameraData = new THREE.OrthographicCamera(dataViewSquare.minX, dataViewSquare.maxX, dataViewSquare.maxY, dataViewSquare.minY, 0, 100);
        cameraData.position.set(0, 0, 100);
        
        cameraAxes = new THREE.OrthographicCamera(axesViewSquare.minX, axesViewSquare.maxX, axesViewSquare.maxY, axesViewSquare.minY, 0, 100);
        cameraAxes.position.set(0, 0, 100);
        
        cameraGrid = new THREE.OrthographicCamera(axesViewSquare.minX, axesViewSquare.maxX, axesViewSquare.maxY, axesViewSquare.minY, 0, 100);
        cameraGrid.position.set(0, 0, 100);
        
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xffffff);
        renderer.autoClear = false;

        raycaster = new THREE.Raycaster();
    }
    
    // Initialize controls.
    var initializeControls = function() {
        controls = new THREE.OrthographicTrackballControls(cameraData, canvas);
        controls.target.set(0, 0, 0);
        controls.noRotate = true;
        controls.noRoll = true;
        controls.noZoom = false;
        controls.noPan = false;
        controls.zoomSpeed = 1.2;
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
        updateTickLabels();
        rescaleSelection();
        
        renderer.clear();
        renderer.render(sceneGrid, cameraGrid);
        renderer.clearDepth();
        renderer.render(sceneData, cameraData);
        renderer.clearDepth();
        renderer.render(sceneAxes, cameraAxes);
        
        if (config.getImage == true) {
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
            rendererScreen.render(sceneGrid, cameraGrid);
            rendererScreen.clearDepth();
            rendererScreen.render(sceneData, cameraData);
            rendererScreen.clearDepth();
            rendererScreen.render(sceneAxes, cameraAxes);
            
            config.imgData = rendererScreen.domElement.toDataURL();
            config.getImage = false;
        }
    };
    
    var updateView = function() {
        calculateDataBoundingRectangle(config.xAttribute, config.yAttribute);
        calculateDataViewSquare();
        
        cameraData.zoom = 1;
        cameraData.left = dataViewSquare.minX;
        cameraData.right = dataViewSquare.maxX;
        cameraData.top = dataViewSquare.maxY;
        cameraData.bottom = dataViewSquare.minY;
        cameraData.near = 0;
        cameraData.far = 100;
        cameraData.position.set(0, 0, 100);
        cameraData.updateProjectionMatrix();
        
        controls.target.set(0, 0, 0);
        
        drawData();
        
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
        
    this.setXCoordinateAttr = function (name) {
        config.xAttribute = name;
        updateView();
        updateLabel(labelX, name);
    }; 
    
    this.setYCoordinateAttr = function (name) {
        config.yAttribute = name;
        updateView();
        updateLabel(labelY, name);
    };
    
    this.deactivate = function() {
        model.removeListener("pca2d");
        controls.removeEventListener("change");
        d3.select(config.canvasId).on("mousemove", null);
        d3.select(config.canvasId).on("click", null);
        d3.select(config.canvasId)
            .attr("width", originalCanvasWidth)
            .attr("height", originalCanvasHeight);
    };
    
    this.enableGrid = function() {
        if (grid) {
            if (!config.grid) {
                config.grid = true;
                sceneGrid.add(grid);
            }
        }
    }
    
    this.disableGrid = function(enable) {
         if (grid) {
            if (config.grid) {
                config.grid = false;
                sceneGrid.remove(grid);
            }
        }
    }
    
    calculateDataBoundingRectangle(config.xAttribute, config.yAttribute);
    calculateDataViewSquare();
    
    model.addListener("pca2d", function(dataChanged, selectionChanged, neighborsChanged) {
        if (dataChanged) {
            drawData();
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