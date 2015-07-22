//     Chainwork.js 0.5
//     webpage
//     (c) 2015 Andri Birgisson
//     Chainwork may be freely distributed under the MIT license.

//      Depends on lodash.

//TODO
//Load external scripts async
//Drop lodash dependancy in Chainwork and core components
//lint

//typeOf based on mootools typeOf
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
        //cache is not cleared by the chain, but can be overwritten by any component.
        this.cache = null;

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
        if(this.debug) {
            var name = this.getComponentProperty('name');
            console.log('running component: ' + name);
        }
    }

    ChainWork.prototype.getComponentProperty = function(property) {
        return components[this.chain[this.index].componentName][property];
    }

    ChainWork.prototype.getChainProperty = function(property) {
        return this.chain[this.index][property];
    }

    ChainWork.prototype.chainHasProperty = function(property) {
        return this.chain[this.index] ? hasOwnProperty.call(this.chain[this.index], property) : false;
    }

    ChainWork.prototype.componentHasProperty = function(property) {
        return components[this.chain[this.index].componentName] ? hasOwnProperty.call(components[this.chain[this.index].componentName], property) : false;
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
        //If the component has property once and it is true then skip it
        if(this.chainHasProperty('once')) {
            if(this.getChainProperty('once')) {
                this.componentDone();
                return;
            }
        }
        //if the component has property once then mark it as true to prevent it from running again.
        if(this.chainHasProperty('once')) {
            this.chain[this.index].once = true;
        }

        //TODO move assignment to special method
        //We must add the assigned function to "this" for binding and give the function access to this class
        //This occurs if the previous component have added the assignToNext property to the component
        if(this.chainHasProperty('assigned')) {
            this.assignment = this.getChainProperty('assigned');
            this.assignment();
        }

        if(this.componentHasProperty('assignToNext')) {
            var assignment = this.getComponentProperty('assignToNext');
            this.chain[this.index + 1]['assigned'] = assignment;
        }
        ///
        ///

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
            //self.cache = null; //might cause problem for other components than pause because its removed by the same component
            self.index++;
            if(self.isPlay) {
                self.callchain('chain');
            }
        });
    }

    ChainWork.prototype.injectBefore = function(component) {
         this.chain.splice(this.index - 1, 0, component);
    }

    ChainWork.prototype.injectAfter = function(component) {
        this.chain.splice(this.index + 1, 0, component);
    }

    ChainWork.prototype.remove = function(index) {
        if(index === 'last') {
            index = this.chain.length - 1;
        }
        if(index === 'first') {
            index = 0;
        }
        this.chain.splice(index, 1);
    }

    ChainWork.prototype.play = function(caller) {
        var caller = caller || 'user';
        this.isPlay = true;
        this.isAbort = false;
        this.callchain(caller);
    }

    ChainWork.prototype.reset = function(index) {
        this.isAbort = true;
        this.collection = {};
        this.stamps.length = index || 0;
        this.index = index || 0;
    }

    ChainWork.prototype.seek = function(index) {
        this.reset(index);
    }

    ChainWork.prototype.next = function(caller) {
        var caller = caller || 'user';
        this.isPlay = false;
        this.isAbort = false;
        this.callchain(caller);
    }

    ChainWork.prototype.stop = function() {
        this.isPlay = false;
        this.isAbort = true;
    }

    /*
    *Add supports two syntax styles
    *chain.add(name, {})
    *chain.add({componentName: name, settings: {}})
    */
    ChainWork.prototype._add = function(args) {
        //this a base function for other methods that can add components to the chain e.g once and async
        var component;
        if(args.length > 1 || typeOf(args[0]) === 'string') {
            component = {
                componentName: args[0],
                settings: args[1] ? args[1] : {}
            }
        }
        else {
            component = args[0];
        }

        //Run init function on when components are added
        try {
            //inject chain as parent to access in init functions
            components[component.componentName]['parent'] = this;
            components[component.componentName]['init'](component);
        }
        catch(err) {
            //pass
        }
        return component;
    }

    ChainWork.prototype.add = function(name, settings) {
        var component = this._add(arguments);
        this.chain.push(component);
        this.initIndex++;
        return this;
    }

    //same as add except for the once property thats added to the component.
    //once makes component disposable. When compnent get's called first time the once property is set to true.
    ChainWork.prototype.once = function(name, settings) {
        var component = this._add(arguments);
        component['once'] = false;
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


    //Reset is now part of Chainwork and runs instantly like chain.play() but not as part of the chain
    // ChainWork.prototype.reset = function(args) {
    //     var args = args || {};
    //     //Dont be picky
    //     var index = args.toIndex || args.toindex || args.index || args.indexTo || args.indexto || 0;
    //     this.add({
    //         componentName: 'reset',
    //         settings: {
    //             index: index
    //         }
    //     });
    //     return this;
    // }

    ChainWork.prototype.if = function(fn, component) {
        this.add({
            componentName: 'if',
            settings: {
                ifCondition: fn, 
                component: component
            }
        });
        return this;
    }

    return ChainWork;
})();



 /*
---
*Component
*
*returns one compenent and runs it
*e.g Component.run('name', {someSettings: 'foo'});
*/
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

 /*
---
*Core components for ChainWork.
*
*Core components follows the component standard.
*They extend the chainwork methods and have short method defined in the Chainwork class
*e.g chain.call(Fn);
*/

var components = {

    callAsync: {
        name: 'callAsync',
        requirements: [],
        provides: {},
        settings: {
            call: null
        },
        job: function() {
            var self = this;
            //If provided function has name extend it to this component name for debug and clarity
            this.name = this.settings.call.name ? 'callAsync-' + this.settings.call.name : 'callAsync';
            this.settings.call();
            setTimeout(function() {
                self.parent.componentDone();
            });
        }
    },

    callSync: {
        name: 'callSync',
        requirements: [],
        provides: {},
        settings: {
            call: null
        },
        job: function() {
            var self = this;
            //If provided function has name extend it to this component name for debug and clarity
            this.name = this.settings.call.name ? 'callSync-' + this.settings.call.name : 'callAsync';
            var onComplete = function() {
                self.parent.componentDone();
            };
            this.settings.call(onComplete);
        }
    },

    /*
    * This component is wierd for a good reason.
    * Pause stops the chain and removes it self from the chain. So next component has a trusted event if needed e.g window popup
    * The removed component must be added again so the chain doesn't break if reseted.
    * so the component makes a clone of itself and assignToNext will replace the component.
    *
    * More on trusted events http://www.w3.org/TR/DOM-Level-3-Events/#trusted-events
    */
    pause: {
        name: 'pause',
        requirements: [],
        provides: {},
        settings: {
            delay: null
        },
        job: function() {
            var self = this;
            this.parent.stop();
            this.parent.cache = _.clone(this.parent.chain[this.parent.index]);  
            setTimeout(function() {
                self.parent.chain.splice(self.parent.index, 1);
            });
            if(this.settings.delay) {
                setTimeout(function() {
                    self.parent.play('chain');
                }, this.settings.delay);
            }
        },
        assignToNext: function() {
            this.index++;
            this.injectBefore(this.cache);
        }
    },

    reset: {
        name: 'reset',
        settings: {
            index: 0
        },
        job: function() {
            this.parent.isAbort = true;
            this.parent.collection = {};
            this.parent.stamps.length = this.settings.index;
            this.parent.index = this.settings.index;
            
        }
    },

    initIf: {
        name: 'if',
        settings: {
            ifCondition: null, //must return true or false
            component: null //this component will be added
        },
        init: function(me) {
            var self = this;
            if(me.settings.ifCondition()) {
                this.parent.add(me.settings.component);
            }
        },
        job: function() {
            this.parent.componentDone();
        }
    },

    if: {// the problem with this component is that it ads component afterwards so its always the last one in the chain
        name: 'if',
        settings: {
            ifCondition: function() {}, //must return true or false
            component: null //this component will be added
        },
        job: function() {
            if(this.settings.ifCondition()) {
                this.parent.add(this.settings.component);
            }
            this.parent.componentDone();
        }
    }
}