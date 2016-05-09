var DataModel = (function (data, dimensionNames, groups, studyGroups) {
    this.data = data;
    this.dimensionNames = dimensionNames;
    this.groups = groups;
    this.studyGroups = {};
    this.activeGroups = {};
    this.inactiveGroups = {};
    this.activeElements = [];
    this.activeNeighbors = [];
    this.nearestActiveNeighbors = [];
    
    var selectedActiveElement = null;
    
    var maxDimensions = dimensionNames.length;
    var kNearestNeighbors = 0;
    var sortedActiveNeighbors = null;
    
    var listeners = {};
    
    for (var i = 0; i < studyGroups.length; i++) {
        this.studyGroups[studyGroups[i]] = "";
    }
    
    for (var i = 0; i < this.groups.length; i++) {
        this.activeGroups[this.groups[i]["name"]] = [];
    }
    
    for (var i = 0; i < this.data.length; i++) {
        this.activeElements.push(i);
        this.activeGroups[this.data[i]["group"]].push(i);
        
        if (!this.studyGroups.hasOwnProperty(this.data[i]["group"])) {
            this.activeNeighbors.push(i);
        }
    }
    
    this.addListener = function(name, callback) {
        listeners[name] = callback;
    }
    
    this.removeListener = function(name) {
        if (listeners.hasOwnProperty(name)) {
            delete listeners[name];
        }
    }
    
    var notifyListeners = function(dataChanged, selectionChanged, neighborsChanged) {
        for (var listener in listeners) {
            listeners[listener](dataChanged, selectionChanged, neighborsChanged);
        }
    }
    
    this.getElement = function(activeElement) {
        return this.activeElements[activeElement];
    }
    
    this.selectActiveElement = function(activeElement) {
        selectedActiveElement = activeElement;
        
        if (selectedActiveElement) {
            sortNeighbors(this);
            this.nearestActiveNeighbors = sortedActiveNeighbors.slice(1, 1 + kNearestNeighbors);
        } else {
            sortedNeighbors = null;
            this.nearestActiveNeighbors = [];
        }
        
        notifyListeners(false, true, true);
    }
    
    this.getSelectedActiveElement = function() {
        return selectedActiveElement;
    }
    
    this.getSelectedElement = function() {
        if (selectedActiveElement) {
            return this.activeElements[selectedActiveElement];
        }
        return null;
    }
    
    this.deactivateGroup = function(name) {
        if (this.activeGroups.hasOwnProperty(name)) {
            var selectedElement = this.getSelectedElement();
            
            if (selectedElement) {
                if (this.data[selectedElement]["group"] == name) {
                    selectedActiveElement = null;
                    this.nearestActiveNeighbors = [];
                }
            }
            
            this.inactiveGroups[name] = this.activeGroups[name];
            delete this.activeGroups[name];
            
            var i = 0;
            
            this.activeElements = this.activeElements.filter(
                function(value, index, array) { 
                    if (this.activeGroups.hasOwnProperty(data[value]["group"])) {
                        if (value == selectedElement) {
                            selectedActiveElement = i;  
                        }
                        i++;
                        return true;
                    }
                    return false;
                }, 
                this
            );
            
            this.activeNeighbors = new Array();
            for (var j = 0; j < this.activeElements.length; j++) {
                if (!this.studyGroups.hasOwnProperty(this.data[this.activeElements[j]]["group"])) {
                    this.activeNeighbors.push(j);
                }
            }
            
            if (selectedActiveElement) {
                sortNeighbors(this);
                this.nearestActiveNeighbors = sortedActiveNeighbors.slice(1, 1 + kNearestNeighbors);
            }
                        
            notifyListeners(true, true, true);
        }    
    }
    
    this.activateGroup = function(name) {
        if (this.inactiveGroups.hasOwnProperty(name)) {
            this.activeGroups[name] = this.inactiveGroups[name];
            delete this.inactiveGroups[name];
            Array.prototype.push.apply(this.activeElements, this.activeGroups[name]);
            
            this.activeNeighbors = new Array();
            for (var j = 0; j < this.activeElements.length; j++) {
                if (!this.studyGroups.hasOwnProperty(this.data[this.activeElements[j]]["group"])) {
                    this.activeNeighbors.push(j);
                }
            }
            
            if (selectedActiveElement) {
                sortNeighbors(this);
                this.nearestActiveNeighbors = sortedActiveNeighbors.slice(1, 1 + kNearestNeighbors);
            }
            
            notifyListeners(true, false, true);
        }
    }
 
    this.isGroupActive = function(name) {
        return this.activeGroups.hasOwnProperty(name);
    }
    
    this.setMaxDimensions = function(dimensions) {
        dimensions = parseInt(dimensions);
        
        if (dimensions < 1) {
            maxDimensions = 1;
        } else if (dimensions > dimensionNames.length) {
            maxDimensions = dimensionNames.length;
        } else {
            maxDimensions = dimensions;
        }
        
        if (selectedActiveElement) {
            sortNeighbors(this);
            this.nearestActiveNeighbors = sortedActiveNeighbors.slice(1, 1 + kNearestNeighbors);
            notifyListeners(false, false, true);
        }
    }
    
    this.getMaxDimensions = function() {
        return maxDimensions;
    }
    
    this.setKNearestNeighbors = function(k) {
        k = parseInt(k);
        
        if (k < 0) {
            k = 0;
        } else if (k >= this.activeElements.length) {
            kNearestNeighbors = this.activeElements.length - 1;
        } else {
            kNearestNeighbors = k;
        }
        
        if (selectedActiveElement) {
            this.nearestActiveNeighbors = sortedActiveNeighbors.slice(1, 1 + kNearestNeighbors);
        }
        
        notifyListeners(false, false, true);
    }
    
    this.getKNearestNeighbors = function() {
        return kNearestNeighbors;
    }
        
    this.distance = function(element1, element2) {
        var distance = 0;
        var dimension = null;
            
        for (var d = 0; d < maxDimensions; d++) {
            dimensionName = dimensionNames[d];
            distance += Math.pow(this.data[element1][dimensionName] - this.data[element2][dimensionName], 2);
        }
            
        return Math.sqrt(distance);
    }
    
    var sortNeighbors = function(thisArg) {
        var element = null;
        var selectedElement = thisArg.getSelectedElement();
        
        sortedActiveNeighbors = new Array(thisArg.activeNeighbors.length);
            
        for (var i = 0; i < thisArg.activeNeighbors.length; ++i) {
            element = thisArg.activeElements[thisArg.activeNeighbors[i]];
            sortedActiveNeighbors[i] = { distance: thisArg.distance(element, selectedElement), index: thisArg.activeNeighbors[i]};
        }
        sortedActiveNeighbors.sort(function(f, s) {
            return f.distance - s.distance;
        });
        
        sortedActiveNeighbors = sortedActiveNeighbors.map(
            function(value, index, array) {
                return value.index;
            }, 
            this
        );
    }
    
});