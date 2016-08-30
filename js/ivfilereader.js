var IVFileReader = (function() {
    var obj = {};
    
    var groups = {};
    var dimensions = [];
    var points = [];
    
    obj.fileInputChangeEventHandler = function(event) {
        var files = event.target.files;
        if (files.length == 1) {
            readFile(files[0]);
        }
    }

    obj.fileDragOverEventHandler = function(event) {
        event.stopPropagation();
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
    }

    obj.fileDropEventHandler = function(event) {
        event.stopPropagation();
        event.preventDefault();
        var files = event.dataTransfer.files;
        if (files.length == 1) {
            readFile(files[0]);
        }
    }
    
    function readFile(file) {
        var reader = new FileReader();
                    
        reader.onload = function(event) {
            parse(event.target.result);
            removeControls();
            IVPlotBuilder.createPlot(groups, dimensions, points);
        }

        reader.onprogress = function(event) {
        }
                        
        reader.onerror = function(event) {
        }
                        
        reader.onloaded = function(event) {
        }

        reader.readAsText(file);
    }
    
    function parse(text) {
        var lines = text.split("\n");
        var fields = null;
        var nubmerOfFields = 0;
        var i = 0;
        
        var fieldNames = {
            "popID": "group",
            "indivID": "id"
        }
        
        var fieldIndices = {
            "group": -1,
            "id": -1,
            "loc": []
        }
        
        /* BEGIN: read header */
        for (i = 0; i < lines.length; i++) {
            lines[i] = lines[i].trim();
            if (lines[i].length == 0) {
                continue;
            }
            fields = lines[i].split("\t");
            nubmerOfFields = fields.length;
            for (var j = 0; j < nubmerOfFields; j++) {
                if (fieldNames.hasOwnProperty(fields[j])) {
                    if (fieldNames[fields[j]] == "group") {
                        fieldIndices["group"] = j;
                    } else if (fieldNames[fields[j]] == "id") {
                        fieldIndices["id"] = j;
                    } else if (fieldNames[fields[j]] == "loc") {
                        fieldIndices["loc"].push(j);
                        dimensions.push(fields[j]);
                    }
                } else if (fields[j].startsWith("PC")) {
                    fieldNames[fields[j]] = "loc";
                    fieldIndices["loc"].push(j);
                    dimensions.push(fields[j]);
                }
            }            
            break;
        }
        /* END: read header */
        
        if (fieldIndices["group"] < 0) {
            return; //error
        }
        if (fieldIndices["id"] < 0) {
            return; //error
        }
        if (fieldIndices["loc"].length == 0) {
            return; //error
        }

        /* BEGIN: read data lines */
        for (i++; i < lines.length; i++) {
            lines[i] = lines[i].trim();
            if (lines[i].length == 0) {
                continue;
            }
            fields = lines[i].split("\t");
            if (fields.length != nubmerOfFields) {
                return; //error
            }
            var hasNAorInfinite = false;
            var group = fields[fieldIndices["group"]];
            var id = fields[fieldIndices["id"]];
            var loc = [];
            for (var j = 0; j < fieldIndices["loc"].length; j++) {
                var value = parseFloat(fields[fieldIndices["loc"][j]]);
                if (isNaN(value) || !isFinite(value)) {
                    hasNAorInfinite = true;
                    break;
                }
                loc.push(value);
            }
            
            if (hasNAorInfinite) {
                continue;
            }
            
            if (!groups.hasOwnProperty(group)) {
                groups[group] = {
                    "color": "#FFFFFF",
                    "symbol": 0,
                    "reference": true
                }
            }
            
            points.push(
                {
                    "id": id,
                    "grp": group,
                    "loc": loc
                }
            );
        }
        /* END: read data lines */
    }

    function removeControls(file) {
//      document.getElementById("iv-file-select-form").remove(); // This doesn't work in IE11
        $("#iv-file-select-form").remove();
    }
    
    return obj;
}());
