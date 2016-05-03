var DataModel = (function (data, dimensionNames, groups) {
    this.data = data;
    
    this.activeGroups = {};
    this.inactiveGroups = {};
    this.activeElements = [];
    
    for (var i = 0; i < groups.length; i++) {
        this.activeGroups[groups[i]["color"]] = [];
    }
    
    for (var i = 0; i < data.length; i++) {
        this.activeElements.push(i);
        this.activeGroups[data[i]["color"]].push(i);
    }
    
    this.deactivateGroup = function(name) {
        if (this.activeGroups.hasOwnProperty(name)) {
            this.inactiveGroups[name] = this.activeGroups[name];
            delete this.activeGroups[name];
            this.activeElements = this.activeElements.filter(
                function(value, index, array) { 
                    return this.activeGroups.hasOwnProperty(data[value]["color"]); 
                }, 
                this
            );
        }    
    }
    
    this.activateGroup = function(name) {
        if (this.inactiveGroups.hasOwnProperty(name)) {
            this.activeGroups[name] = this.inactiveGroups[name];
            delete this.inactiveGroups[name];
            Array.prototype.push.apply(this.activeElements, this.activeGroups[name]);
        }
    }
    
    this.isGroupActive = function(name) {
        return this.activeGroups.hasOwnProperty(name);
    }
    
    this.changeData = function() {
        data[0].name = "lala";
    }
    
});