var IV2D = (function (model, config) {
    
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
    var sceneSelection = null;
    var sceneNeighbors = null;
    
    var cameraData = null;
    var cameraAxes = null;
    var renderer = null;
    var raycaster = null;
    var controls = null;
    var particlesByGroup = null;
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
    
    var symbols = new Array(config.symbols_2d.length);
    
    // Initialize symbols
    for (var i = 0; i < symbols.length; i++) {
        symbols[i] = new THREE.TextureLoader().load(config.symbols_2d[i]);
    }
      
    // Calculate bouding rectangle for data
    var calculateDataBoundingRectangle = function(xDim, yDim) {
        dataBoundingRectangle.minX = Number.MAX_VALUE;
        dataBoundingRectangle.minY = Number.MAX_VALUE;
        dataBoundingRectangle.maxX = 0;
        dataBoundingRectangle.maxY = 0;
            
        for (var i = 0; i < model.points.length; i++) {
            x = model.points[i].loc[xDim];
            y = model.points[i].loc[yDim];
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
//            console.log("append X = "  + append);
            while (append > 0) {
                if (Math.abs(dataViewSquare.minX) < Math.abs(dataViewSquare.maxX)) {
                    dataViewSquare.minX = dataViewSquare.minX - 1;
                } else {
                    dataViewSquare.maxX = dataViewSquare.maxX + 1;
                }
                append--;
            }            
//          dataViewSquare.minX = dataViewSquare.minX - Math.floor(append / 2);
//          dataViewSquare.maxX = dataViewSquare.maxX + Math.ceil(append / 2);                     
        } else if (dataViewSquare.maxY - dataViewSquare.minY < dataViewSquare.sideSize) {
            var append = dataViewSquare.sideSize - dataViewSquare.maxY + dataViewSquare.minY;
//            console.log("append Y = "  + append);
            while (append > 0) {
                if (Math.abs(dataViewSquare.minY) < Math.abs(dataViewSquare.maxY)) {
                    dataViewSquare.minY = dataViewSquare.minY - 1;
                } else {
                    dataViewSquare.maxY = dataViewSquare.maxY + 1;
                }
                append--;
            }            
//          dataViewSquare.minY = dataViewSquare.minY - Math.floor(append / 2);
//          dataViewSquare.maxY = dataViewSquare.maxY + Math.ceil(append / 2);
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
    var createLabel = function(text, fontface, fontsize, valign, halign, canvasWidth) {
        var canvas = document.createElement('canvas');
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
            
        labelX = createLabel(model.dimensions[config.xDim], "Arial", 24, "bottom", "");
        labelY = createLabel(model.dimensions[config.yDim], "Arial", 24, "", "left");
            
        labelX.sprite.position.set(0, axesViewSquare.xAxis.start.y - axesViewSquare.labelOffset, 0);
        labelY.sprite.position.set(axesViewSquare.yAxis.start.x - axesViewSquare.labelOffset, 0, 0);
            
        sceneAxes.add(labelX.sprite);
        sceneAxes.add(labelY.sprite);
    };
    
    // Draw data
    var drawData = function() {
        for (var group in model.pointsByGroup) {
            var particles = sceneData.getObjectByName(group);
            if ((particles !== undefined) && (particles !== null)) {
                sceneData.remove(particles);
            }
        }
        
        particlesByGroup = {};
    
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
            material.depthWrite = false;
            
            for (var i = 0; i < points.length; i++) {
                var j = points[i];
                geometry.vertices.push(
                    new THREE.Vector3(model.points[j].loc[config.xDim], model.points[j].loc[config.yDim], 0));
                geometry.colors.push(new THREE.Color(color));
            }
            
            var particles = new THREE.Points(geometry, material);
            particles.name = group;
            particlesByGroup[group] = particles;
        }
        
        // Initially add to the scene partincles only for active(selected by user) groups.
        for (var group in model.activeGroups) {
            sceneData.add(particlesByGroup[group]);
            // raycaster doesn't work when there is only one point. I think this is because boundingSphere.radius is 0.
            // Let's fix it by setting hardcoded radius
            if (particlesByGroup[group].geometry.vertices.length == 1) { 
                particlesByGroup[group].geometry.computeBoundingSphere();
                particlesByGroup[group].geometry.boundingSphere.radius = 1;
            }
        }
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
            sceneNeighbors.remove(neighbors);
            neighbors = null;
        }
        
        if (model.nearestNeighbors.length > 0) {
            var s = model.getSelection();
            
            var material = new THREE.LineBasicMaterial({color: 0x555555, linewidth: 1});
            var geometry = new THREE.Geometry();
            
            var x0 = particlesByGroup[s.group].geometry.vertices[s.index].x;
            var y0 = particlesByGroup[s.group].geometry.vertices[s.index].y;
            var x = 0;
            var y = 0;
            var particle = null;
            var particlesInGroup = null;
            
            for (var i = 0; i < model.nearestNeighbors.length; i++) {
                particle = model.nearestNeighbors[i];
                particlesInGroup = particlesByGroup[particle.group];
                x = particlesInGroup.geometry.vertices[particle.index].x;
                y = particlesInGroup.geometry.vertices[particle.index].y;
                geometry.vertices.push(new THREE.Vector3(x0, y0, 0));
                geometry.vertices.push(new THREE.Vector3(x, y, 0));
            }
            
            neighbors = new THREE.LineSegments(geometry, material);
            sceneNeighbors.add(neighbors);
        }
    }
    
    // Update normalized mouse coordinates on mouse move event inside canvas
    var onMouseMoveInsideCanvas = function() {
        var boundingClientRect = canvas.getBoundingClientRect();
        //mouse.x = d3.event.x;
        //mouse.y = d3.event.y;
        mouse.x = d3.event.clientX;
        mouse.y = d3.event.clientY;
//        mouse2d.x = ((d3.event.x - boundingClientRect.left) / canvas.width) * 2 * window.devicePixelRatio - 1;
//        mouse2d.y = (-(d3.event.y - boundingClientRect.top) / canvas.height) * 2 * window.devicePixelRatio + 1;
        mouse2d.x = ((d3.event.clientX - boundingClientRect.left) / canvas.width) * 2 * window.devicePixelRatio - 1;
        mouse2d.y = (-(d3.event.clientY - boundingClientRect.top) / canvas.height) * 2 * window.devicePixelRatio + 1;
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
        selection.position.set(particlesByGroup[group].geometry.vertices[index].x, particlesByGroup[group].geometry.vertices[index].y, 0);
    }
    
    // Rescale selection shape
    var rescaleSelection = function() {
        var normalizedSize = (dataViewSquare.sideSize / canvas.width) * config.pointSize * window.devicePixelRatio;
        var size = normalizedSize / cameraData.zoom;
        selection.scale.set(size, size, size);
    }
        
    // Find object under mouse pointer.
    var updatePicked = function() {
        raycaster.setFromCamera(mouse2d, cameraData);
//        raycaster.params.Points.threshold = config.pointSize / (2 * cameraData.zoom);
        raycaster.params.Points.threshold = ((dataViewSquare.sideSize / canvas.width) * config.pointSize * window.devicePixelRatio) / (2 * cameraData.zoom);
        intersects = raycaster.intersectObjects(sceneData.children); 
        if (intersects.length > 0) {
            picked.group = intersects[0].object.name;
            picked.index = intersects[0].index;
        } else {
            picked.group = null;
            picked.index = null;
        }
    };
    
    // Highlight picked object.
    var highlightPicked = function() {
        if ((picked.group != highlighted.group) || (picked.index != highlighted.index)) {
            if ((highlighted.group != null) && (highlighted.index != null)) {
                sceneData.getObjectByName(highlighted.group).geometry.colors[highlighted.index] = new THREE.Color(model.groups[highlighted.group].color);
                sceneData.getObjectByName(highlighted.group).geometry.colorsNeedUpdate = true;
            }
            if ((picked.group != null) && (picked.index != null)) {
                sceneData.getObjectByName(picked.group).geometry.colors[picked.index] = new THREE.Color(0xff00ff);
                sceneData.getObjectByName(picked.group).geometry.colorsNeedUpdate = true;
            }
            highlighted.group = picked.group;
            highlighted.index = picked.index;
        }
    };
    
    var modelToScreenXY = function(point) {
        var vector = new THREE.Vector3(point.loc[config.xDim], point.loc[config.yDim], 0);
        vector.project(cameraData);

        var boundingClientRect = canvas.getBoundingClientRect();
        
        vector.x = ((vector.x + 1) / (2 * window.devicePixelRatio)) * canvas.width + boundingClientRect.left + window.pageXOffset;
        vector.y = -((vector.y - 1) / (2 * window.devicePixelRatio)) * canvas.height + boundingClientRect.top + window.pageYOffset;
        
        return {
            x: vector.x,
            y: vector.y
        };
    }
    
    // Create/remove tooltip.
    var updateTooltip = function() {
        if ((picked.group != tooltip.group) || (picked.index != tooltip.index)) {
            d3.select("#iv-tooltip").remove();
            if ((picked.group != null) && (picked.index != null)) {
                var point = model.getPoint(picked.group, picked.index);
                var coordinate = modelToScreenXY(point);
                var html = point.id + "</br>" + point.grp;
                if (point.pop) {
                    html += " (" + point.pop + ")";
                }
                html += "</br>" + model.dimensions[config.xDim] + "=" + point.loc[config.xDim] + 
                    "</br>" + model.dimensions[config.yDim] + "=" + point.loc[config.yDim]
                d3.select("body").append("div")
                    .attr("id", "iv-tooltip")
                    .style("left", coordinate.x + "px")
                    .style("top", (coordinate.y - config.pointSize / 2 - 7) + "px")
                    .html(html);
            }
            tooltip.group = picked.group;
            tooltip.index = picked.index;
        }
    };
    
    // Initialize GL
    var initializeGL = function() {
        sceneData = new THREE.Scene();
        sceneAxes = new THREE.Scene();
        sceneGrid = new THREE.Scene();
        sceneSelection = new THREE.Scene();
        sceneNeighbors = new THREE.Scene();
            
        cameraData = new THREE.OrthographicCamera(dataViewSquare.minX, dataViewSquare.maxX, dataViewSquare.maxY, dataViewSquare.minY, 0, 100);
        cameraData.position.set(0, 0, 100);
        
        cameraAxes = new THREE.OrthographicCamera(axesViewSquare.minX, axesViewSquare.maxX, axesViewSquare.maxY, axesViewSquare.minY, 0, 100);
        cameraAxes.position.set(0, 0, 100);
        
//        cameraGrid = new THREE.OrthographicCamera(axesViewSquare.minX, axesViewSquare.maxX, axesViewSquare.maxY, axesViewSquare.minY, 0, 100);
//        cameraGrid.position.set(0, 0, 100);
        
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: false
        });
        renderer.setSize(canvas.width, canvas.height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setClearColor(0xffffff);
        renderer.autoClear = false;

        raycaster = new THREE.Raycaster();
//        raycaster.params.Points.threshold = config.pointSize;
//        raycaster.params.Points.threshold = (dataViewSquare.sideSize / canvas.width) * config.pointSize * window.devicePixelRatio;
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
        
        if (model.hasSelectedPoint()) {
            var s = model.getSelection();
            changeSelection(s.group, s.index);
            sceneSelection.add(selection);
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
        renderer.render(sceneGrid, cameraAxes);
        renderer.clearDepth();
        renderer.render(sceneNeighbors, cameraData);
        renderer.clearDepth();
        renderer.render(sceneData, cameraData);
        renderer.clearDepth();
        renderer.render(sceneSelection, cameraData);
        renderer.clearDepth();
        renderer.render(sceneAxes, cameraAxes);
    };
    
    var drawLegend = function() {
        var labelfontsize = 32;
        var groupfontsize = 28;
        var starx = 60;
        var starty = 90;
        var stepy = -5;
        
        var scene = new THREE.Scene();
        var name = null;
        
        var n_reference_groups = 0;
        var n_active_reference_groups = 0;
        var n_study_groups = 0;
        var n_active_study_groups = 0;
        for (var group in model.groups) {
            if (model.groups[group].reference) {
                n_reference_groups += 1;
                if (model.isGroupActive(group)) {
                    n_active_reference_groups += 1;
                }
            } else {
                n_study_groups += 1;
                if (model.isGroupActive(group)) {
                    n_active_study_groups += 1;
                }
            }
        }
        
        if (n_active_reference_groups > 0) {
            if (n_study_groups > 0) {
                name = createLabel("Reference", "Arial", labelfontsize, "", "right", 500);
            } else {
                name = createLabel("Groups", "Arial", labelfontsize, "", "right", 500);
            }
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
        }
        
        if (n_active_study_groups > 0) {
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
        }
        
        return scene;
    }
    
    this.saveImageToBlob = function(legend) {
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
        rendererScreen.render(sceneGrid, cameraAxes);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneNeighbors, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneData, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneSelection, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneAxes, cameraAxes);
        
        if (legend == true) {
            var cameraLegend = new THREE.OrthographicCamera(-100, 100, 100, -100, 0, 100);
            cameraLegend.position.set(0, 0, 100);
            
            rendererScreen.clearDepth();
            rendererScreen.render(drawLegend(), cameraLegend);
        }
        
        var dataUrlFields = rendererScreen.domElement.toDataURL().split(/[,:;]/);
        var bytes = atob(dataUrlFields[3]);
        var mime = dataUrlFields[1];
        
        var ia = new Uint8Array(bytes.length);
        for (var i = 0; i < bytes.length; i++) {
            ia[i] = bytes.charCodeAt(i);
        }
        
        return new Blob([ia], {type:mime});
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
        rendererScreen.render(sceneGrid, cameraAxes);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneNeighbors, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneData, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneSelection, cameraData);
        rendererScreen.clearDepth();
        rendererScreen.render(sceneAxes, cameraAxes);
        
        if (legend == true) {
            var cameraLegend = new THREE.OrthographicCamera(-100, 100, 100, -100, 0, 100);
            cameraLegend.position.set(0, 0, 100);
            
            rendererScreen.clearDepth();
            rendererScreen.render(drawLegend(), cameraLegend);
        }    
            
        return rendererScreen.domElement.toDataURL();
    }
    
    var updateView = function() {
        calculateDataBoundingRectangle(config.xDim, config.yDim);
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
        updateLabel(labelX, model.dimensions[dim]);
    }; 
    
    this.setYDimension = function(dim) {
        config.yDim = dim;
        updateView();
        updateLabel(labelY, model.dimensions[dim]);
    };
    
    this.deactivate = function() {
        model.removeListener("onGroupChange", "pca2d");
        model.removeListener("onSelectionChange", "pca2d");
        model.removeListener("onNeighborsChange", "pca2d");
        model.removeListener("onGroupColorChange", "pca2d");
        model.removeListener("onGroupOpacityChange", "pca2d");
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
    
    calculateDataBoundingRectangle(config.xDim, config.yDim);
    calculateDataViewSquare();
    
    model.addListener("onGroupChange", "pca2d", function() {
        for (var group in model.pointsByGroup) {
            var particles = sceneData.getObjectByName(group);
            if (!model.activeGroups.hasOwnProperty(group)) {
                if ((particles !== undefined) && (particles !== null)) {
                    sceneData.remove(particles);
                }
            } else {
                if ((particles === undefined) || (particles === null)) {
                    sceneData.add(particlesByGroup[group]);
                }
            }
        }
    });
    
    model.addListener("onSelectionChange", "pca2d", function() {
        if (model.hasSelectedPoint()) {
            var s = model.getSelection();
            changeSelection(s.group, s.index);
            if (sceneSelection.children.length == 0) {
                sceneSelection.add(selection);
            }            
        } else {
            if (sceneSelection.children.length > 0) {
                sceneSelection.remove(selection);
            } 
        }
    });
    
    model.addListener("onNeighborsChange", "pca2d", function() {
        drawNeighbors();
    });
    
    model.addListener("onGroupColorChange", "pca2d", function(group) {
        var colors = particlesByGroup[group].geometry.colors;
        var newColor = model.groups[group].color;
        for (var i = 0; i < colors.length; i++) {
            colors[i] = new THREE.Color(newColor);    
        }
        particlesByGroup[group].geometry.colorsNeedUpdate = true;
    });
    
    model.addListener("onGroupOpacityChange", "pca2d", function(group) {
        particlesByGroup[group].material.opacity = model.groups[group].opacity;
    });
    
});