var IVPlotBuilder = (function() {
    var obj = {};

    var width = 500;
    var height = 500;
    
    var animating = true;
    var gl = null;
    var config = {
        canvasId: "#iv-canvas",
        nameAttribute: "name",
        groupAttribute: "group",
        colorAttribute: "color",
        subgroupAttribute: "population",
        symbols_2d: [],
        symbols_3d: [],
        xDim: 0,
        yDim: 1,
        zDim: 2,
        pointSize: 10,
        pointOpacity: 0.7,
        grid: true,
        initK: 10
    };
    
    var images = {};
    
    var hasStudy = false;
    var dataDimensions = null;
    var model = null;

    var plotDiv = null;
    var legendDiv = null;
    var controlsDiv = null;
    var pieDiv = null;
    var canvas = null;
    
    obj.HSVtoRGB = function(h, s, v ) {
        var i;
        var f, p, q, t;
        
        if (s == 0) { // grey
            return { "red": v, "green": v, "blue": v }; 
        }
        
        h /= 60;
        i = Math.floor(h);
        f = h - i;
        p = v * (1 - s);
        q = v * (1 - s * f);
        t = v * (1 - s * (1 - f));
        
        hexv = Math.round(v * 255).toString(16);
        hexp = Math.round(p * 255).toString(16);
        hexq = Math.round(q * 255).toString(16);
        hext = Math.round(t * 255).toString(16);
	
		if (i == 0) {
            return "#" + 
                (hexv.length == 1 ? "0" + hexv : hexv) +
                (hext.length == 1 ? "0" + hext : hext) +
                (hexp.length == 1 ? "0" + hexp : hexp);
        } else if (i == 1) {
            return "#" + 
                (hexq.length == 1 ? "0" + hexq : hexq) +
                (hexv.length == 1 ? "0" + hexv : hexv) +
                (hexp.length == 1 ? "0" + hexp : hexp);
        } else if (i == 2) {
            return "#" + 
                (hexp.length == 1 ? "0" + hexp : hexp) +
                (hexv.length == 1 ? "0" + hexv : hexv) +
                (hext.length == 1 ? "0" + hext : hext);
        } else if (i == 3) {
            return "#" + 
                (hexp.length == 1 ? "0" + hexp : hexp) +
                (hexq.length == 1 ? "0" + hexq : hexq) +
                (hexv.length == 1 ? "0" + hexv : hexv);
        } else if (i == 4) {
            return "#" + 
                (hext.length == 1 ? "0" + hext : hext) +
                (hexp.length == 1 ? "0" + hexp : hexp) +
                (hexv.length == 1 ? "0" + hexv : hexv);
        } else {
            return "#" + 
                (hexv.length == 1 ? "0" + hexv : hexv) +
                (hexp.length == 1 ? "0" + hexp : hexp) +
                (hexq.length == 1 ? "0" + hexq : hexq);
        }
	}
    
    var recolorImage = function(origImage, colImage, color) {
        var canvas = document.createElement("canvas");

        canvas.width = origImage.width;
        canvas.height = origImage.height;

        var context = canvas.getContext("2d");

        var red = parseInt(color.substring(1, 3), 16);
        var green = parseInt(color.substring(3, 5), 16);
        var blue = parseInt(color.substring(5, 7), 16);

        context.drawImage(origImage, 0, 0, canvas.width, canvas.height);

        var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        var recolored = imageData.data;

        for (var i = 0; i < recolored.length; i += 4) {
            if ((recolored[i] == 255) && (recolored[i + 1] == 255) && (recolored[i + 2] == 255)) {
                recolored[i] = red;
                recolored[i + 1] = green;
                recolored[i + 2] = blue;
            }
        }
        context.putImageData(imageData, 0, 0);
        colImage.src = canvas.toDataURL("image/png");
    } 
    
    var recolor = function(thisArg, id, color) {
        if (images.hasOwnProperty(id)) {
            if (images[id].complete) {
                recolorImage(images[id], thisArg, color); 
            } else {
                window.setTimeout(function() { recolor(thisArg, id, color); }, 100); // check again every 100ms if image is still not loaded
            }
        } else {
            images[id] = new Image();
            images[id].onload = function() {recolorImage(images[id], thisArg, color);};
            images[id].src = config.symbols_2d[id];
        }
    }
    
    obj.displayGroup = function(thisArg) {
        var groupName = thisArg.getAttribute("data-group-name");
        var groupId = thisArg.getAttribute("data-group-id");
        var flag = model.isGroupActive(groupName);
        
        flag = !flag;
            
        if (flag) {
            if (thisArg.id == "displayoff") {
                d3.select(thisArg).attr("class", "btn btn-default btn-small");
                d3.select(thisArg.nextElementSibling).attr("class", "btn btn-primary btn-small");
            } else {
                d3.select(thisArg).attr("class", "btn btn-primary btn-small");
                d3.select(thisArg.previousElementSibling).attr("class", "btn btn-default btn-small");                    
            }
            d3.select("button#" + groupId).style("opacity", "1.0");
            model.activateGroup(groupName);
        } else {
            if (thisArg.id == "displayoff") {
                d3.select(thisArg).attr("class", "btn btn-primary btn-small");
                d3.select(thisArg.nextElementSibling).attr("class", "btn btn-default btn-small");
            } else {
                d3.select(thisArg).attr("class", "btn btn-default btn-small");
                d3.select(thisArg.previousElementSibling).attr("class", "btn btn-primary btn-small");
            }
            d3.select("button#" + groupId).style("opacity", "0.3");
            model.deactivateGroup(groupName);
        } 
    }
                
    obj.setGroupOpacity = function(thisArg) {
        model.setGroupOpacity(thisArg.getAttribute("data-group-name"), thisArg.value);
    }
        
    var createSwitchControl = function(parentDiv, label, isOn, on_callback, off_callback) {
        var dl = parentDiv.append("dl");
            
        dl.append("dt").text(label);
            
        var btnGroup = dl.append("dd").attr("class", "iv-dd").append("div").attr("class", "btn-group");
            
        btnGroup.append("button")
            .attr("type", "button")
            .attr("class", function() { if (!isOn) { return "btn btn-primary btn-small"; } else { return "btn btn-default btn-small"; }})
            .datum(!isOn)
            .text("OFF")
            .on("click", function(d, i) {
                var flag = d3.select(this).datum();
                flag = !flag;
                d3.select(this).datum(flag);
                if (flag) {
                    d3.select(this).attr("class", "btn btn-primary btn-small");
                    d3.select(this.nextSibling).datum(!flag);
                    d3.select(this.nextSibling).attr("class", "btn btn-default btn-small");
                    off_callback();
                } else {
                    d3.select(this).attr("class", "btn btn-default btn-small");
                    d3.select(this.nextSibling).datum(!flag);
                    d3.select(this.nextSibling).attr("class", "btn btn-primary btn-small");
                    on_callback();
                } 
            });
            
        btnGroup.append("button")
            .attr("type", "button")
            .attr("class", function() { if (isOn) { return "btn btn-primary btn-small"; } else { return "btn btn-default btn-small"; }} )
            .datum(isOn)
            .text("ON")
            .on("click", function(d, i) {
                var flag = d3.select(this).datum();
                flag = !flag;
                d3.select(this).datum(flag);
                if (flag) {
                    d3.select(this).attr("class", "btn btn-primary btn-small");
                    d3.select(this.previousSibling).datum(!flag);
                    d3.select(this.previousSibling).attr("class", "btn btn-default btn-small");
                    on_callback();
                } else {
                    d3.select(this).attr("class", "btn btn-default btn-small");
                    d3.select(this.previousSibling).datum(!flag);
                    d3.select(this.previousSibling).attr("class", "btn btn-primary btn-small");
                    off_callback();
                }
            });
    }
    
    var createAxisControl = function(parentDiv, id, label, dimensions, initDim, callback) {
        var dl = parentDiv.append("dl").attr("id", id);
            
        dl.append("dt").text(label);
                
        var btnGroup = dl.append("dd").attr("class", "iv-dd").append("div").attr("class", "btn-group");
            
        btnGroup.append("button")
            .attr("type", "button")
            .attr("class", "btn btn-default btn-small dropdown-toggle")
            .attr("data-toggle", "dropdown")
            .datum(initDim)
            .text(function(d) { return dimensions[initDim] + " "; })
            .append("span")
                .attr("class", "caret");
        
        var ul = btnGroup.append("ul").attr("class", "dropdown-menu");
            
        dimensions.forEach(function(row, index) {
            ul.append("li").append("a")
                .attr("href", "#")
                .datum(index)
                .text(function(d) {return dimensions[d];})
                .on("click", function(d, i) {
                    d3.select("#" + id).select("button")
                        .datum(d)
                        .text( function(d) { return dimensions[d] + " "; } )
                        .append("span")
                            .attr("class", "caret");
                    callback();
                });
        });
    }
    
    var createSliderControl = function(parentDiv, id, label, minValue, maxValue, initValue, width, callback) {
        var dl = parentDiv.append("dl").attr("id", id);
            
        dl.append("dt").text(label);
            
        var btnGroup =  dl.append("dd").attr("class", "iv-dd").append("ul")
                                .attr("class", "inline list-inline");
            
        btnGroup.append("li").append("input")
            .attr("type", "range")
            .attr("min", minValue)
            .attr("max", maxValue)
            .attr("step", 1)
            .attr("value", initValue)
            .style("width", width)
            .style("padding", "0px 0px")
            .on("change", function() {
                d3.select(this.parentElement.nextElementSibling).text(this.value);
                callback(this.value);
            })
            .on("input", function() {
                d3.select(this.parentElement.nextElementSibling).text(this.value);
            });
            
        btnGroup.append("li").text(initValue);
    }
    
    var createLegend = function(parentDiv, leftOffset, width, label, isReference) {
        var dl = parentDiv.append("dl")
            .style("position", "absolute")
            .style("left", leftOffset + "px")
            .style("width", width + "px");
            
        dl.append("dt").text(label);
        
        var btnGroup = dl.append("div")
            .attr("class", "btn-group-vertical")
            .attr("role", "group");

        for (var group in model.groups) {            
            if (model.groups[group].reference != isReference) {
                continue;
            }
            
            var btn = btnGroup.append("button")
                .attr("id", model.groups[group].id)
                .attr("type", "button")
                .attr("class", "btn btn-default btn-block btn-small")
                .attr("data-trigger", "click")
                .attr("data-toggle", "popover")
                .attr("title", "Edit")
                .datum({"name": group, "property": model.groups[group]})
                .on("click", function(d) { 
                    $('[data-toggle="popover"][id!="' + d.property.id + '"]').popover("hide");
                });
            
            var img = btn.append("span")
                .attr("class", "pull-left")
                .append("img")
                .attr("width", 12)
                .attr("height", 12)
                .style("margin-bottom", "2px")
                .style("margin-right", "2px")
                .attr("src", "");
                
            recolor(img.node(), model.groups[group].symbol, model.groups[group].color);
            
            btn.append("span").attr("class", "pull-left").text(function(d) {return d.name;});
        }
    }
    
    var createLegendPopups = function() {
        $('[data-toggle="popover"]').popover({
            placement: "bottom",
            container: "body",
            animation: false,
            html: true,
            content: function() {
                var data = d3.select(this).datum();
                
                var popup = d3.select(document.createElement("div"));
                
                popup.attr("data-group", data.name);
                popup.style("width", "125px");
                //popup.style("height", "180px");
                
                var dl = popup.append("dl");
                dl.append("dt").text("Display");
                var btnGroup = dl.append("dd").attr("class", "iv-dd").append("div").attr("class", "btn-group");
                var btnOff = btnGroup.append("button")
                    .attr("id", "displayoff")
                    .attr("type", "button")
                    .attr("class", "btn btn-default btn-small")
                    .text("OFF")
                    .attr("data-group-id", data.property.id)
                    .attr("data-group-name", data.name)
                    .on("click", function() { obj.displayGroup(this); });
                var btnOn = btnGroup.append("button")
                    .attr("id", "displayon")
                    .attr("type", "button")
                    .attr("class", "btn btn-primary btn-small")
                    .text("ON")
                    .attr("data-group-id", data.property.id)
                    .attr("data-group-name", data.name)
                    .on("click", function() { obj.displayGroup(this); });
                
                if (model.isGroupActive(data.name)) {
                    btnOff.attr("class", "btn btn-default btn-small");
                    btnOn.attr("class", "btn btn-primary btn-small");
                } else {
                    btnOff.attr("class", "btn btn-primary btn-small");
                    btnOn.attr("class", "btn btn-default btn-small");
                }   
                                
                dl = popup.append("dl");
                dl.append("dt").text("Opacity");
                dl.append("dd").attr("class", "iv-dd").append("input")
                    .attr("type", "range")
                    .attr("min", "0.3")
                    .attr("max", "1")
                    .attr("step", "0.1")
                    .attr("value", model.getGroupOpacity(data.name))
                    .style("width", "90px")
                    .style("padding", "0px 0px")
                    .attr("data-group-id", data.property.id)
                    .attr("data-group-name", data.name)
                    .on("change", function() { obj.setGroupOpacity(this); });
                
                dl = popup.append("dl");
                dl.style("margin-bottom", "0px");
                dl.append("dt").text("Color");
                dl.append("dd")
                    .attr("class", "iv-dd group-colorpicker")
                    .attr("data-group-id", data.property.id)
                    .attr("data-group-name", data.name);
                
                return popup;
            }
        });
        
        $('[data-toggle="popover"]').on('shown.bs.popover', function(e) {
            var groupId = this.getAttribute("id");
            var groupName = d3.select(".group-colorpicker[data-group-id=" + groupId + "]").attr("data-group-name");

            var div = d3.select(".group-colorpicker[data-group-id=" + groupId + "]").append("div")
                .attr("class", "input-append colorpicker-component");
            
            div.append("input")
                .attr("type", "text")
                .attr("value", model.getGroupColor(groupName))
                .style("width", "80px");
            
            div.append("span")
                .attr("class", "add-on")
                .append("i");
            
            $(div).colorpicker({
                color: model.getGroupColor(groupName),
                container: false,
                component: ".add-on",
                inline: false,
                format: "hex"
            });
                
            $(".group-colorpicker").on("changeColor", function(e) { 
                var groupId = this.getAttribute("data-group-id");
                var groupName = this.getAttribute("data-group-name");
                recolor(d3.select("button#" + groupId).select("img").node(), model.groups[groupName].symbol, e.color.toHex());
                model.setGroupColor(groupName, e.color.toHex());
            });
        });
        
        $('[data-toggle="popover"]').on('hide.bs.popover', function(e) {
            var groupId = this.getAttribute("id");
            var divs = $(".group-colorpicker[data-group-id='" + groupId + "'] div:first-child");
            if (divs.length > 0) {
                divs.colorpicker("destroy");
            }
        });
    }
    
    var createPieChart = function(parentDiv, radius) {
        var piesvgDiv = parentDiv.append("div").attr("id", "iv-pie-svg");
            
        var svg = piesvgDiv.append("svg")
            .attr("width", 1.2 * radius * 2)
            .attr("height", 1.2 * radius * 2);
            
        var g = svg.append("g")
            .attr("transform", "translate(" + (1.2 * radius) + ", " + (1.2 * radius) + ")");
            
        var counts = {};

        for (var i = 0; i < model.nearestNeighbors.length; i++) {
            var point = model.getPoint(model.nearestNeighbors[i].group, model.nearestNeighbors[i].index);    
            var count = 0;
            if (counts.hasOwnProperty(point.grp)) {
                counts[point.grp].total += 1;
            } else {
                counts[point.grp] = {};
                counts[point.grp].id = model.groups[point.grp].id;
                counts[point.grp].name = point.grp;
                counts[point.grp].color = model.groups[point.grp].color;
                counts[point.grp].total = 1;
                counts[point.grp].populations = {};
            }
            if (point.hasOwnProperty("pop")) {
                if (counts[point.grp].populations.hasOwnProperty(point.pop)) {
                    counts[point.grp].populations[point.pop] += 1;
                } else {
                    counts[point.grp].populations[point.pop] = 1;
                }
            }
        }
            
        var countsArray = [];
        for (var group in counts) {
            countsArray.push(counts[group]);
        }
                            
        var pie = d3.layout.pie().value(function(d) {
            return d.total; 
        });
            
        var arc = d3.svg.arc().outerRadius(radius);
        var arcOver = d3.svg.arc().outerRadius(1.2 * radius);
            
        var path = g.selectAll("path")
            .data(pie(countsArray))
            .enter()
            .append("path")
            .attr("id", function(d, i) { return d.data.id; } )
            .attr("d", arc)
            .attr("fill", function(d, i) { return d.data.color; })
            .attr("stroke", "black")
            .attr("stroke-width", "0.5")
            .on("mouseover", function(d) {
                d3.select(this).transition().duration(500).attr("d", arcOver);

                var table = parentDiv.append("div")
                    .attr("id", "iv-pie-legend").attr("class", "panel panel-default")
                    .append("table").attr("class", "table table-striped table-small table-condensed");
                    
                var row = table.append("tr").style("font-weight", "bold");
                row.append("td").text(d.data.name);
                row.append("td").text(d.data.total);
                    
                for (var population in d.data.populations) {
                    row = table.append("tr");
                    row.append("td").text(population);
                    row.append("td").text(d.data.populations[population]);
                }    
            })
            .on("mouseout", function(d) {
                d3.select(this).transition().duration(500).attr("d", arc);
                d3.select("#iv-pie-legend").remove();
            });
    }
    
    var destroyControl = function(id) {
        d3.select("#" + id).remove();
    }
    
    var enable3D = function(mode_3d) {
        gl.deactivate();
        if (mode_3d) {
            gl = new IV3D(model, config);
            createAxisControl(controlsDiv.select("div"), "Z", "Z", model.dimensions, config.zDim, function() {
                var zDim = d3.select("#Z").select("button").datum();
                gl.setZDimension(zDim);
            });
        } else {
            gl = new IV2D(model, config);
            destroyControl("Z");
        }
        gl.initialize();
    }
    
    var createControls = function() {
        plotDiv = d3.select("#iv-plot-form").append("div").attr("id", "iv-plot");
        legendDiv = plotDiv.append("div").attr("id", "iv-legend");
        controlsDiv = plotDiv.append("div").attr("id", "iv-controls");
        
        pieDiv = d3.select("#iv-plot-form").append("div").attr("id", "iv-pie");
        pieDiv.append("div").attr("id", "iv-pie-label").append("h4").text("Ancestry composition of nearest neighbors");
        pieDiv.append("div").attr("id", "iv-pie-alert").attr("class", "alert alert-info text-center").text("Select sample by clicking on point in PCA plot.");
        pieDiv.append("div")
            .attr("id", "iv-pie-display")
            .style("display", "none")
            .append("div")
                .attr("id", "iv-pie-controls")
                .append("h4")
                    .attr("id", "iv-pie-name").text("");
        
        controlsDiv.append("div"); //?
        
        canvas = plotDiv.append("canvas").attr("id", "iv-canvas").attr("width", width).attr("height", height).node();
        
        /* BEGIN: 2D/3D switch control */
        if (dataDimensions.length > 2) {
            createSwitchControl(controlsDiv.select("div"), "3D", false, function() {
                animating = false;
                enable3D(true);
                animating = true;
                animate();
            }, 
            function() {
                animating = false;
                enable3D(false);
                animating = true;
                animate();            
            });
        }
        /* END: 2D/3D switch control */
        
        /* BEGIN: Grid on/off control */
        createSwitchControl(controlsDiv.select("div"), "Grid", true, function() {
            gl.enableGrid();
        }, 
        function() {
            gl.disableGrid();
        });
        /* END: Grid on/off control */
        
        /* BEGIN: point size control */
        createSliderControl(controlsDiv.select("div"), "size", "Point size", 1, 20, config.pointSize, "70px", function(value) {
            gl.setPointSize(value);
        });
        /* END: point size control */
        
        /* BEGIN: Axes */
        createAxisControl(controlsDiv.select("div"), "X", "X", model.dimensions, config.xDim, function() {
            var xDim = d3.select("#X").select("button").datum();
            gl.setXDimension(xDim);
        });
        
        createAxisControl(controlsDiv.select("div"), "Y", "Y", model.dimensions, config.yDim, function() {
            var yDim = d3.select("#Y").select("button").datum();
            gl.setYDimension(yDim);
        });
        /* BEGIN: End */
        
        /* BEGIN: Add export controls */
        var dl = controlsDiv.append("dl");
            
        dl.append("dt").text("Export");
            
        var btnGroup = dl.append("dd").attr("class", "iv-dd").append("div").attr("class", "btn-group");
        
        btnGroup.append("button")
            .attr("type", "button")
            .attr("class", "btn btn-default btn-small dropdown-toggle")
            .attr("data-toggle", "dropdown")
            .text("Image ")
            .append("span")
                .attr("class", "caret");
        
        var ul = btnGroup.append("ul").attr("class", "dropdown-menu");
        
        [{"text": "With legend", "value": true}, {"text": "Without legend", "value": false}].forEach(
            function(row, index) {
                ul.append("li").append("a")
                    .attr("href", "#")
                    .datum(row)
                    .text(function(d) {return d.text;})
                    .on("click", function(d, i) {
                        var blob = gl.saveImageToBlob(d.value);
//                      IE and Safari doesn't support "download" attribute in <a> tag, so we do workarounds
                        if (window.navigator && window.navigator.msSaveOrOpenBlob) {    
                            window.navigator.msSaveOrOpenBlob(blob, "laser.png");
                        } else if (navigator.userAgent.toLowerCase().indexOf("safari") > -1 && 
                                   navigator.userAgent.toLowerCase().indexOf("chrome") < 0) {
                            var url = window.URL.createObjectURL(blob);
                            window.open(url);
                            window.URL.revokeObjectURL(url);
                        } else {
                            var url = window.URL.createObjectURL(blob);  
                            var a = document.createElement("a");
                            document.body.appendChild(a);
                            a.style = "display:none";
                            a.href = url;
                            a.download = "laser.png";
                            a.click();
//                          window.URL.revokeObjectURL(url); // Can't do this, because don't know when file object will be downloaded completely
                        }
                    
                    });
            }
        );
                
        btnGroup.append("button")
            .attr("type", "button")
            .attr("class", "btn btn-default btn-small")
            .text("TSV")
            .on("click", function(d, i) {
                var blob = model.saveDataToBlob();
//              IE and Safari doesn't support "download" attribute in <a> tag, so we do workarounds
                if (window.navigator && window.navigator.msSaveOrOpenBlob) {    
                    window.navigator.msSaveOrOpenBlob(blob, "laser.tsv");
                } else if (navigator.userAgent.toLowerCase().indexOf("safari") > -1 && 
                           navigator.userAgent.toLowerCase().indexOf("chrome") < 0) {
                    var url = window.URL.createObjectURL(blob);
                    window.open(url);
                    window.URL.revokeObjectURL(url);
                } else {
                    var url = window.URL.createObjectURL(blob);         
                    var a = document.createElement("a");
                    document.body.appendChild(a);
                    a.style = "display:none";
                    a.href = url;
                    a.download = "laser.tsv";
                    a.click();
//                  window.URL.revokeObjectURL(url); // Can't do this, because don't know when file object will be downloaded completely
                }
            });
        /* END: Add export controls */
        
        /* BEGIN: legend */
        if (hasStudy) {
            createLegend(legendDiv, 0, 150, "Reference", true);
            createLegend(legendDiv, 150, 150, "Study", false);
        } else {
            createLegend(legendDiv, 0, 150, "Groups", true);
        }
        createLegendPopups();
        /* END: legend */
        
        /* BEGIN: Pie sliders */
        createSliderControl(d3.select("#iv-pie-controls"), "pc", "Principal components", 1, dataDimensions.length, model.getActiveDimensions(), "100px", function(value) {
            model.setActiveDimensions(value);
        });
        
        if (config.initK <= model.getAllNeighbors()) {
            model.setMaxNearestNeighbors(config.initK);
            createSliderControl(d3.select("#iv-pie-controls"), "k", "K nearest neighbors", 0, model.getAllNeighbors(), config.initK, "100px", function(value) {
                model.setMaxNearestNeighbors(value);
            });
        } else {
            model.setMaxNearestNeighbors(model.getAllNeighbors());
            createSliderControl(d3.select("#iv-pie-controls"), "k", "K nearest neighbors", 0, model.getAllNeighbors(), model.getAllNeighbors(), "100px", function(value) {
                model.setMaxNearestNeighbors(value);
            });
        }
        /* END: Pie sliders */
        
        /* BEGIN: Pie listeners */
        model.addListener("onSelectionChange", "pie", function() {
            if (model.hasSelectedPoint()) {
                var point = model.getSelectedPoint();
                d3.select("#iv-pie-name").text(point.id);
                d3.select("#iv-pie-alert").style("display", "none");
                d3.select("#iv-pie-display").style("display", "block");
            } else {
                d3.select("#iv-pie-name").text("");
                d3.select("#iv-pie-display").style("display", "none");
                d3.select("#iv-pie-alert").style("display", "block");
            }
        }); 
        
        model.addListener("onNeighborsChange", "pie", function() {
            d3.select("#iv-pie-svg").remove();
            if (model.nearestNeighbors.length > 0) {
                createPieChart(d3.select("#iv-pie-display"), 70);
            }
        });
        
        model.addListener("onGroupColorChange", "pie", function(group) {
            if (model.nearestNeighbors.length > 0) {
                d3.select("path#" + model.groups[group].id).attr("fill", model.groups[group].color);
            }
        });
        
        model.addListener("onGroupChange", "pie", function() {
            var maxUserValue = model.getMaxNearestNeighbors();
            var maxPossibleValue = model.getAllNeighbors();
                
            d3.select("#k").select("input").attr("max", maxPossibleValue);
                
            if (maxUserValue < maxPossibleValue) {
                d3.select("#k").select("input").node().value = maxUserValue;
                d3.select(d3.select("#k").select("li").node().nextSibling).text(maxUserValue);       
            } else {
                d3.select("#k").select("input").node().value = maxPossibleValue;
                d3.select(d3.select("#k").select("li").node().nextSibling).text(maxPossibleValue);
            }
        });
        /* END: Pie listeners */
    }
    
    var createNotification = function(message) {
        d3.select("#iv-plot-form").append("div")
            .attr("class", "alert alert-info text-center")
            .style("position", "absolute")
            .style("top", "50%")
            .style("left", "50%")
            .style("transform", "translate(-50%, -50%)")
            .text(message);
    }
    
    var hasWebGL = function() {
        var testGL = null;
        var testCanvas = document.createElement("canvas"); 
        try {
            testGL = testCanvas.getContext("webgl"); // Chrome, Firefox
            if (testGL != null) {
                return true;
            }
            testGL = testCanvas.getContext("experimental-webgl"); // IE11, MS Edge
            if (testGL != null) {
                return true;
            }
        } catch (e) {
            return false;
        }        
        return false;
    }
    
    var animate = function() {
        if (animating) {
            requestAnimationFrame(animate);
        }
        gl.draw();
    }
    
    obj.setConfig = function(newConfig) {
        config = newConfig;
    }
    
    obj.createPlot = function(groups, dimensions, points) {
        // check if WebGL is supported
        if (!hasWebGL()) {
            createNotification("Unfortunately, the interactive 2D/3D visualization can't be displayed using your web browser version. Please, update your web browser to the most recent version or try using different web browser.");
            return;                        
        }

        // Assign click listener for hiding popup elements when click is outside them.
        $(document).on('click', function (e) {
            if (!$(e.target).hasClass('colorpicker dropdown-menu') &&
                $(e.target).parents('.colorpicker', '.dropdown-menu').length === 0 &&
                $(e.target).data('toggle') !== 'popover' &&
                $(e.target).parents('[data-toggle="popover"]').length === 0 &&  
                $(e.target).parents('.popover.in').length === 0) {
                $('[data-toggle="popover"]').popover('hide');
            }
        });
        
        var colors = {};
        for (var group in groups) {
            if (!groups[group].reference) {
                hasStudy = true;
            }
            if (!colors.hasOwnProperty(groups[group].color)) {
                colors[groups[group].color] = 1;
            }
        }
        
        if ((Object.keys(groups).length > 1) && (Object.keys(colors).length == 1)) {
            // Auto-assign group colors
            var hsvStep = 320 / Object.keys(groups).length; // 320 because 0 and 360 are both red in HSV
            var h = 0;
            for (var group in groups) {
                groups[group].color = obj.HSVtoRGB(h, 1, 1);
            h += hsvStep;
            }
        }
         
        // Generate groups id (based on djb2 string hashing). These ids will be used in HTML elements.
        for (var group in groups) {
            var string = groups[group].name + " " + groups[group].color + " " + groups[group].symbol;
            var hash = 5381;
            for (var i = 0; i < string.length; i++) {
                var char = string.charCodeAt(i);
                hash = ((hash << 5) + hash) + char;
            }
            groups[group].id = "group" + hash;
        }
        
        dataDimensions = dimensions.slice();
        model = new IVDataModel(groups, dimensions, points);
        
        createControls();
        
        gl = new IV2D(model, config);
        gl.initialize();
        
        animate();
    }

    return obj;
}());