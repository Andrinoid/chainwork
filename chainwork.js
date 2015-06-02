//     Chainwork.js 0.1
//     webpage
//     (c) 2015 Andri Birgisson
//     Chainwork may be freely distributed under the MIT license.

//      Depends on lodash.

//TODO
//Load external scripts async
//Drop lodash dependancy in Chainwork and core components
//lint

//typeOf borrowed from mootools
var typeOf = function(item) {
    'use strict';
    if (item === null) {
        return 'null';  
    }
    if (typeof(item) === 'string')
        return 'string';
    if (item.nodeName) {
        if (item.nodeType === 1) {
            return 'element';
        }
        if (item.nodeType === 3) {
            return (/\S/).test(item.nodeValue) ? 'textnode' : 'whitespace';
        }
    } else if (typeof item.length === 'number') {
        if (item.callee) {
            return 'arguments';
        }
        if ('item' in item) {
            return 'collection';
        }
    }
    return typeof item;
};

var ChainWork = (function () {
    function ChainWork(options) {
        var self = this;
        var options = options || {};
        this.debug = options['debug'] || false;
        this.autoPlay = options['autoPlay'] || false;
        this.onComplete = options['onComplete'] || function(){};
        //Constructor
        this.chain = [];
        this.isBusy = false;
        this.isPlay = false;
        this.isAbort = false;
        this.initIndex = 0; //index for added components before chain is started
        this.index = 0;

        this.previousReturn = null;
        this.collection = {
            //collected data by the chain
        };
        this.stamps = [];
        //Play on load if autoplay is set
        if(this.autoPlay) {
            document.addEventListener('DOMContentLoaded', function() {
                self.play();
            }, false);
        }
    }
    //This is a trail of the components that have executed used for dependancy checks
    ChainWork.prototype.componentStamp = function() {
        this.stamps.push(this.chain[this.index].componentName);
        if(this.debug)
            console.log('running component: '+this.chain[this.index].componentName);
    }

    ChainWork.prototype.getComponentProperty = function(property) {
        return components[this.chain[this.index].componentName][property];
    }

    ChainWork.prototype.getChainProperty = function(property) {
        return this.chain[this.index][property];
    }

    ChainWork.prototype.setProperty = function(property, value) {
        components[this.chain[this.index].componentName][property] = value;
    }

    ChainWork.prototype.checkRequirements = function() {
        var self = this;
        var requirements = this.getComponentProperty('requirements');
        if(!requirements) return false;
        var errorList = _.map(requirements, function(item) {
            if(!self.collection[item]) {
                return item;
            }
        });
        if(errorList[0])
            return errorList;
        return false;
    }

    ChainWork.prototype.checkDependancies = function() {
        var self = this;
        var dependancies = this.getComponentProperty('dependsOn');
        if(!dependancies) return false;
        var errorList = _.map(dependancies, function(item) {
            if(self.stamps.indexOf(item) === -1 ) {
                return item;
            }
        });
        if(errorList[0])
            return errorList;
        return false;
    }
    //take the information provided by component and store them
    ChainWork.prototype.extendGlobal = function() {
        var provides = this.getComponentProperty('provides')
        _.extend(this.collection, provides);
    }

    ChainWork.prototype.applySettings = function() {
        var settings = this.getChainProperty('settings');
        var compontentSettings = this.getComponentProperty('settings');
        _.assign(compontentSettings, settings);
    }

    ChainWork.prototype.callchain = function (caller) {
        var self = this;
        //chain has reached the end
        if(this.index >= this.chain.length) {
            if(this.debug) console.log('chain is being called but out of range');
            this.onComplete(this.collection); 
            return;
        }
        this.caller = caller || 'user'; // if caller is not defined we asume its a user action
        //check for requirements
        var errorList = this.checkRequirements();
        if(errorList.length) {
            console.warn(this.chain[this.index], 'is missing requires some component to provide', errorList.toString());
            return false;
        }
        //if dependancies are listed run them before
        var depsErrorList = this.checkDependancies();
        if(depsErrorList.length) {
            if(this.debug)
                console.warn(this.chain[this.index].componentName, 'might be missing dependancy, please add them before. Missing:'+ depsErrorList.toString());
        }
        this.applySettings();
        //inject the this class as parent of all components. so components can access it with this.parent
        this.setProperty('parent', this);
        //run pre job function if any
        if(this.getComponentProperty('pre')) {
            //this can not be run with help method that returns the function
            //because that causes problem with components that require user action e.g facebook auth
            components[this.chain[this.index].componentName].pre();
        }
        //this gives pre function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        components[this.chain[this.index].componentName].job();//replace with help function
        //this gives job function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        //each component must call componentDone to stop blocking
        this.isBusy = true; //isBuisy is a good idea but not used. needs some thinking. should block and maybe bounce or scrapit for async components
        this.componentStamp();
    }

    ChainWork.prototype.componentDone = function() {
        var self = this;
        //Force this to the bottom of execution
        setTimeout(function() {
            if(self.getComponentProperty('post')) {
                components[self.chain[self.index].componentName].post();
            }
            self.extendGlobal();
            self.isBusy = false;
            self.index++;
            if(self.isPlay) {
                self.callchain('chain');
            }
        });
    }

    ChainWork.prototype.injectAfter = function(component) {
        this.chain.splice(this.index+1, 0, component);
    }

    ChainWork.prototype.play = function(caller) {
        var caller = caller || 'user';
        this.isPlay = true;
        this.isAbort = false;
        this.callchain(caller);
    }

    ChainWork.prototype.next = function(caller) {
        console.log(this.collection);
        var caller = caller || 'user';
        this.isPlay = false;
        this.isAbort = false;
        this.callchain(caller);
    }

    ChainWork.prototype.stop = function() {
        this.isPlay = false;
        this.isAbort = true;
    }

    ChainWork.prototype.add = function(component) {
        //Run init function on when components are added
        try {
            //inject chain as parent to access in init functions
            components[component.componentName]['parent'] = this;
            components[component.componentName]['init'](component);
        }
        catch(err) {
            //pass
        }
        this.chain.push(component);
        this.initIndex++;
        return this;
    }

    //**********************
    // Shortcuts to core components
    // It gives more readable syntax but follows the component standard
    //**********************
    ChainWork.prototype.pause = function(args) {
        var args = args || {};
        this.add({
            componentName: 'pause',
            settings: {
                delay: args.delay || null
            }
        });
        return this;
    }

    ChainWork.prototype.call = function(fn) {
        var componentName;
        _.contains(fn.toString(), 'sync') ? componentName = 'callSync' : componentName = 'callAsync';
        this.add({
            componentName: componentName,
            settings: {
                call: fn                    
            }
        });
        return this;
    }

    ChainWork.prototype.reset = function(args) {
        var args = args || {};
        this.add({
            componentName: 'reset',
            settings: {
                index: args.toIndex
            }
        });
        return this;
    }

    ChainWork.prototype.if = function(fn, component) {
        this.add({
            componentName: 'if',
            settings: {
                ifCondition: fn(), 
                component: component
            }
        });
        return this;
    }

    return ChainWork;
})();


var Component = (function() {
    
    function Component() {
        this.run = function(name, settings) {
            var component = {
                componentName: name,
                settings: settings
            }
            var link = new ChainWork();
            link.add(component);
            link.play();
        }
    }
    return Component;

})();

var Component = new Component();



