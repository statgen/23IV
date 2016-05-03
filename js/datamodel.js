var DataModel = (function (data, dimensionNames, groups) {
    this.data = data;
    
    this.activeGroups = {};
    this.inactiveGroups = {};
    this.activeElements = [];
    
    var selectedActiveElement = null;
    
    var listeners = {};
    
    for (var i = 0; i < groups.length; i++) {
        this.activeGroups[groups[i]["color"]] = [];
    }
    
    for (var i = 0; i < data.length; i++) {
        this.activeElements.push(i);
        this.activeGroups[data[i]["color"]].push(i);
    }
    
    this.addListener = function(name, callback) {
        listeners[name] = callback;
    }
    
    this.removeListener = function(name) {
        if (listeners.hasOwnProperty(name)) {
            delete listeners[name];
        }
    }
    
    var notifyListeners = function(dataChanged, selectionChanged) {
        for (var listener in listeners) {
            listeners[listener](dataChanged, selectionChanged);
        }
    }
    
    this.getElement = function(activeElement) {
        return this.activeElements[activeElement];
    }
    
    this.selectActiveElement = function(activeElement) {
        selectedActiveElement = activeElement;
        notifyListeners(false, true);
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
                if (this.data[selectedElement]["color"] == name) {
                    selectedActiveElement = null;
                }
            }
            
            this.inactiveGroups[name] = this.activeGroups[name];
            delete this.activeGroups[name];
            
            var i = 0;

            this.activeElements = this.activeElements.filter(
                function(value, index, array) { 
                    if (this.activeGroups.hasOwnProperty(data[value]["color"])) {
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
                        
            notifyListeners(true, true);
        }    
    }
    
    this.activateGroup = function(name) {
        if (this.inactiveGroups.hasOwnProperty(name)) {
            this.activeGroups[name] = this.inactiveGroups[name];
            delete this.inactiveGroups[name];
            Array.prototype.push.apply(this.activeElements, this.activeGroups[name]);
            
            notifyListeners(true, false);
        }
    }
    
    this.isGroupActive = function(name) {
        return this.activeGroups.hasOwnProperty(name);
    }
    
});