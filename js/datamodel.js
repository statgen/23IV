var DataModel = (function (groups, dimensions, points) {
    this.groups = groups;
    this.dimensions = dimensions;
    this.points = points;
    this.pointsByGroup = {};
    this.activeGroups = {};
    this.nearestNeighbors = [];
    
    var selection = {
        group: null,
        index: null
    };
    
    var listeners = {
        "onGroupChange": {},
        "onSelectionChange": {},
        "onNeighborsChange": {},
        "onGroupColorChange": {},
        "onGroupOpacityChange": {}
    };
    
    // BEGIN: Variables for K-nearest neighbors (KNN).
    var activeDimensions = dimensions.length;
    var maxNearestNeighbors = 0;
    var sortedAllNeighbors = null;
    // END.
                 
    // BEGIN: Append negative dimensions i.e. -PC1, -PC2, etc.
    var k = this.dimensions.length;
    for (var i = 0; i < k; i++) {
        this.dimensions.push("-" + this.dimensions[i]);
    }
    
    for (var i = 0; i < this.points.length; i++) {
        for (var j = 0; j < k; j++) {
            this.points[i].loc.push(-this.points[i].loc[j]);
        }
    }
    // END.
    
    // BEGIN: (a) Split points into arrays by group. (b) Assign default opacity to each group. (c) Set active groups (initially all groups are active).
    for (var group in this.groups) {
        this.pointsByGroup[group] = new Array();
        this.groups[group].opacity = 0.7;
        this.activeGroups[group] = "";
    }
    
    for (var i = 0; i < this.points.length; i++) {
        this.pointsByGroup[this.points[i].grp].push(i);
    }
    // END.
    
    // BEGIN: Add/remove/notify model change listeners.
    this.addListener = function(event, name, callback) {
        if (listeners.hasOwnProperty(event)) {
            listeners[event][name] = callback;
        }
    }
    
    this.removeListener = function(event, name) {
        if (listeners.hasOwnProperty(event)) {
            if (listeners[event].hasOwnProperty(name)) {
                delete listeners[event][name];
            }
        }
    }
    
    var notifyListeners = function(event, object) {
        if (listeners.hasOwnProperty(event)) {
             for (var listener in listeners[event]) {
                 listeners[event][listener](object);
             }
        }
    }
    // BEGIN.
    
    // BEGIN: Change group visual attributes.
    this.getGroupColor = function(group) {
        return groups[group].color;
    }
    
    this.setGroupColor = function(group, hexColor) {
        groups[group].color = hexColor;
        notifyListeners("onGroupColorChange", group);
    }
    
    this.getGroupOpacity = function(group) {
        return groups[group].opacity;
    }
    
    this.setGroupOpacity = function(group, alpha) {
        groups[group].opacity = alpha;
        notifyListeners("onGroupOpacityChange", group);
    }
    // END.
    
    // BEGIN: Activate/deactivate group.
    this.isGroupActive = function(group) {
        return this.activeGroups.hasOwnProperty(group);
    }
    
    this.deactivateGroup = function(group) {
        if (!this.activeGroups.hasOwnProperty(group)) {
            return;
        }
        
        delete this.activeGroups[group];
        
        notifyListeners("onGroupChange");
        
        if (selection.group == group) {
            selection.group = null;
            selection.index = null;
            sortedAllNeighbors = null;
            this.nearestNeighbors = [];
            notifyListeners("onSelectionChange");
            notifyListeners("onNeighborsChange");
        }
        
        if ((selection.group != null) && (selection.index != null)) {
            sortAllNeighbors(this);
            this.nearestNeighbors = sortedAllNeighbors.slice(1, 1 + maxNearestNeighbors);
            notifyListeners("onNeighborsChange");
        }
    }
    
    this.activateGroup = function(group) {
        if (this.activeGroups.hasOwnProperty(group)) {
            return;
        }
        
        if (!this.groups.hasOwnProperty(group)) {
            return;
        }
        
        this.activeGroups[group] = "";
        
        notifyListeners("onGroupChange");
        
        if ((selection.group != null) && (selection.index != null)) {
            sortAllNeighbors(this);
            this.nearestNeighbors = sortedAllNeighbors.slice(1, 1 + maxNearestNeighbors);
            notifyListeners("onNeighborsChange");
        }
    }
    // END.
    
    this.getPoint = function(group, index) {
        return this.points[this.pointsByGroup[group][index]];
    }
    
    // BEGIN: Point selection.
    this.isPointSelected = function(group, index) {
        if ((selection.group == group) && (selection.index == index)) {
            return true;
        }
        return false;
    }
    
    this.hasSelectedPoint = function() {
        if ((selection.group != null) && (selection.index != null)) {
            return true;
        }
        return false;
    }
    
    this.getSelection = function() {
        return {
            group: selection.group,
            index: selection.index
        }; 
    }
    
    this.getSelectedPoint = function() {
        if ((selection.group != null) && (selection.index != null)) {
            return this.points[this.pointsByGroup[selection.group][selection.index]];
        }
        return null;
    }
    
    this.selectPoint = function(group, index) {
        selection.group = group;
        selection.index = index;
        
        if ((group != null) && (index != null)) {
            sortAllNeighbors(this);
            this.nearestNeighbors = sortedAllNeighbors.slice(1, 1 + maxNearestNeighbors);
        } else {
            sortedAllNeighbors = null;
            this.nearestNeighbors = [];
        }
    
        notifyListeners("onSelectionChange");
        notifyListeners("onNeighborsChange");
    }
    // END.
    
    // BEGIN: Functions for K-nearest neighbors (KNN).
    this.getActiveDimensions = function() {
        return activeDimensions;
    }
    
    this.setActiveDimensions = function(value) {
        activeDimensions = parseInt(value);

        if (activeDimensions < 1) {
            activeDimensions = 1;
        } else if (activeDimensions > this.dimensions.length) {
            activeDimensions = this.dimensions.length;
        } 
        
        if ((selection.group != null) && (selection.index != null)) {
            sortAllNeighbors(this);
            this.nearestNeighbors = sortedAllNeighbors.slice(1, 1 + maxNearestNeighbors);
            notifyListeners("onNeighborsChange");
        }
    }
    
    this.getMaxNearestNeighbors = function() {
        return maxNearestNeighbors;
    }
    
    this.getAllNeighbors = function() {
        var n = 0;
        for (var group in this.activeGroups) {
            if (this.groups[group].reference) {
                n += this.pointsByGroup[group].length;
            }
        }
        if (n > 0) {
            n -= 1;
        }
        return n;
    }
    
    var sortAllNeighbors = function(thisArg) {
        var selectedPoint = thisArg.pointsByGroup[selection.group][selection.index];
        
        sortedAllNeighbors = new Array(thisArg.getAllNeighbors());

        var i = 0;
        var pointsInGroup = null;
        var point = null;
        for (var group in thisArg.activeGroups) {
            if (thisArg.groups[group].reference) {
                pointsInGroup = thisArg.pointsByGroup[group];
                for (var j = 0; j < pointsInGroup.length; j++, i++) {
                    point = pointsInGroup[j];
                    sortedAllNeighbors[i] = { 
                        "group": group, 
                        "index": j,
                        "dist": distance(selectedPoint, point)
                    };
                }
            }
        }
        
        sortedAllNeighbors.sort(function(f, s) {
            return f.dist - s.dist;
        });
    }
    
    this.setMaxNearestNeighbors = function(value) {
        allNeighbors = this.getAllNeighbors();
        maxNearestNeighbors = parseInt(value);
        
        if (maxNearestNeighbors < 0) {
            maxNearestNeighbors = 0;
        } else if (maxNearestNeighbors > allNeighbors) {
            maxNearestNeighbors = allNeighbors;
        } 
        
        if ((selection.group != null) && (selection.index != null)) {
             this.nearestNeighbors = sortedAllNeighbors.slice(1, 1 + maxNearestNeighbors);
        }
        
        notifyListeners("onNeighborsChange");
    }
    
    var distance = function(point1, point2) {
        var distance = 0;
        var dimension = null;
            
        for (var d = 0; d < activeDimensions; d++) {
            distance += Math.pow(this.points[point1].loc[d] - this.points[point2].loc[d], 2);
        }
            
        return Math.sqrt(distance);
    }
    // END.
        
});