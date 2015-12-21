//     Chainwork.js 0.5
//     webpage
//     (c) 2015 Andri Birgisson
//     Chainwork may be freely distributed under the MIT license.

//      Depends on lodash.

//TODO
//Load external scripts async
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
        this.isPlay = false;
        this.isAbort = false;
        this.initIndex = 0; //index for added components before chain is started
        this.index = 0;
        this.cycles = 0;
        //cache is not cleared by the chain, but can be overwritten by any component.
        this.cache = null;

        this.parallelsCount = 0;
        this.activeParallel = null;
        this.parallels = {};

        this.collection = {/*collected data by the chain DEPRICATED*/};
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

    ChainWork.prototype._setProperty = function(property, value) {
        components[this.chain[this.index].componentName][property] = value;
    }

    //take the information provided by component and store them
    ChainWork.prototype.extendGlobal = function() {
        var provides = this.getComponentProperty('provides')
        _.extend(this.collection, provides);
    }

    ChainWork.prototype._applySettings = function() {
        //this method might have a problem because it overrides the component settings so it doesn't have the same init settings for next run
        var settings = _.mapValues(this.getChainProperty('settings'), function(value, key) {
            //dont reveal function that start with on or call.
            if(key.slice(0,2) === 'on' || key.slice(0,4) === 'call')
                return value;
            //reveal functions values. this allows the chain to give settings as function to reveal values on chain runtime insted of being collected as static values onLoad
            if(typeOf(value) === 'function')
                return value();
            return value;
        });
        var compontentSettings = this.getComponentProperty('settings');

        _.assign(compontentSettings, settings);
    }
   
    ChainWork.prototype._checkForDependancies = function() {
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

    ChainWork.prototype._checkForOnce = function() {
        //If the component has property once and if it is true then skip it
        if(this.chainHasProperty('once')) {
            if(this.getChainProperty('once')) {
                this.componentDone();
                return true;
            }
        }
        //if the component has property once then mark it as true to prevent it from running again.
        if(this.chainHasProperty('once')) {
            this.chain[this.index].once = true;
        }
        return false;
    }

    ChainWork.prototype._checkForAssignment = function() {
        //if component has assignment to next component or this component has assignment from previous we take care of it here.
        //We must add the assigned function to "this" for binding and give the function access to this class
        //This occurs if the previous component have added the assignToNext property to the component

        if(this.chainHasProperty('assigned')) {
            this.assignment = this.getChainProperty('assigned');
            this.assignment();
            delete this.chain[this.index]['assigned'];
        }

        if(this.componentHasProperty('assignToNext')) {
            var assignment = this.getComponentProperty('assignToNext');
            this.chain[this.index + 1]['assigned'] = assignment;
        }
    }

    ChainWork.prototype._checkForOutOfRange = function() {
        //has chain reached the end?
        if(this.index >= this.chain.length) {
            // if(this.autoReset) {
            //     this.reset();
            // }

            if(this.debug) console.log('chain has reached the end');
            this.cycles++;
            if(this.cycles>50) {
                throw 'Chainwork is running an unexpected loop and was stoped after 50 cycles'
                return false;  
            } 
            //event triggered when chain has reached end
            this.onComplete(this.collection); 
            return true;
        }
        return false;
    }

    ChainWork.prototype.callchain = function (caller) {
        var self = this;
        if(this._checkForOutOfRange()) return false;
        if(this._checkForOnce()) return false;
        this._checkForAssignment();
        this.caller = caller || 'user'; // if caller is not defined we asume its a user action
       
        //if dependancies are listed run them before
        var depsErrorList = this._checkForDependancies();
        if(depsErrorList.length) {
            if(this.debug)
                console.warn(this.chain[this.index].componentName, 'might be missing dependancy, please add them before. Missing:'+ depsErrorList.toString());
        }
        this._applySettings();
        //inject the this class as parent of all components. so components can access it with this.parent
        this._setProperty('parent', this);

        if(this.componentHasProperty('pre')) {
            components[this.chain[this.index].componentName].pre();
        }
        //this gives pre function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        components[this.chain[this.index].componentName].job();
        //this gives job function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        this.componentStamp();
    }

    ChainWork.prototype.runSingle = function(componentRef, onDone) {
        var self = this;
        var component = _.cloneDeep(components[componentRef.componentName]);
        //apply settings
        //var refSettings = componentRef.settings;
         var refSettings = _.mapValues(componentRef.settings, function(value, key) {
            //dont reveal function that start with on or call.
            if(key.slice(0,2) === 'on' || key.slice(0,4) === 'call')
                return value;
            //reveal functions values. this allows the chain to give settings as function to reveal values on chain runtime insted of being collected as static values onLoad
            if(typeOf(value) === 'function')
                return value();
            return value;
        });
        var compontentSettings = component['settings'];
        _.assign(compontentSettings, refSettings);


        //set parent property to component. We dont want the parallel components to affect the rest of the chain so the get a fake parent
        var fakeParent = {
            componentDone: function() {
                onDone();
                self.extendGlobal();//DEPRICATED
                //We should collect componentDone calls to know when the par component is done and user could set it to whait for it
                //we must know how many par component is in the collection maybe we can do it in the component
            },
            caller: 'chain',//?
            stop: self.stop,
            debug: self.debug,

        }
        component['parent'] = fakeParent;

        //Check if component has pre function
        if(component ? hasOwnProperty.call('pre') : false) {
            component.pre();
        }
        //this gives pre function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        component.job();
        //this gives job function chance to abort if needed e.g force user action
        if(this.isAbort) {
            return false;
        }
        //set component stamp
        this.stamps.push(componentRef.componentName);
        if(this.debug) {
            var name = component['name'];
            console.log('running component: ' + name);
        }
    }

    ChainWork.prototype.componentDone = function() {
        var self = this;
        //Force this to the bottom of execution
        setTimeout(function() {
            //DEPRICATED. NO COMPONENT USES IT AND IT DOESN'T MAKE SENS
            if(self.getComponentProperty('post')) {
                components[self.chain[self.index].componentName].post();
            }
            //
            self.extendGlobal();//DEPRICATED
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
        return this;
    }

    ChainWork.prototype.reset = function(index) {
        if(!this._checkForOutOfRange()) {
            //if the chain is at the end the index is larger then the chain length at this point. so we cannot check for assignment on next component as it is not defined.
            this._checkForAssignment();
        }
        this.isAbort = true;
        this.collection = {};
        this.stamps.length = index || 0;
        this.index = index || 0;
    }

    ChainWork.prototype.seek = function(index) {
        //if index is string wee try to find a call functoin by that name and get the index value fom the match
        if(typeof(index) === 'string') {
            _.forEach(this.chain, function(ref, i) {
                if(_.findKey(ref, 'call') && ref.settings.call.name === index) {
                    index = i;
                    return;
                }
            });
        }

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

    ChainWork.prototype.add = function(name, settings, isParallel) {
        if(typeof(arguments[0]) === 'function') {
            //if first argument is a function we port that function in a call component with the injection type
            //call generates the call component and call this function back
            this.call(arguments[0], 'add');
            return this;
        }

        if(!isParallel) {
            this.activeParallel = null;
        } 
        var component = this._add(arguments);
        this.chain.push(component);
        this.initIndex++;
        return this;
    }

    ChainWork.prototype.once = function(name, settings, isParallel) {
        //same as add except for the once property thats added to the component.
        //once makes component disposable. When compnent get's called first time the once property is set to true.
        if(typeof(arguments[0]) === 'function') {
            //if first argument is a function we port that function in a call component with the injection type
            //call generates the call component and call this function back
            this.call(arguments[0], 'once');
            return this;
        }

        if(!isParallel) {
            this.activeParallel = null;
        }
        var component = this._add(arguments);
        component['once'] = false;
        this.chain.push(component);
        this.initIndex++;
        return this;
    }

    ChainWork.prototype._newParCollector = function() {
        this.parallels[++this.parallelsCount] = [];
        return this.parallelsCount;
    }

    //**********************
    // Shortcuts to core components
    // It gives more readable syntax but follows the component standard
    //**********************
    ChainWork.prototype.par = function(name, settings) {
        //par collects all par siblings in a par collection. and replace all these components with one parallel component
        //The parallel component has an id for the parallel collection and exetutes all components at "once"
        
        if(typeof(arguments[0]) === 'function') {
            //if first argument is a function we port that function in a call component with the injection type
            //call generates the call component and call this function back
            this.call(arguments[0], 'par');
            return this;
        }

        var component = this._add(arguments);
        if(!this.activeParallel) {
            this.activeParallel = this._newParCollector();

            this.add('parallel', {uid: this.activeParallel}, true);
        }
        this.parallels[this.activeParallel].push(component);
        return this;
    }

    ChainWork.prototype.call = function(fn, injectType) {
        var injectType = injectType || 'add';
        var componentName;
        _.contains(fn.toString(), 'sync') ? componentName = 'callSync' : componentName = 'callAsync';
        this[injectType]({// injectType can be add, once, par
            componentName: componentName,
            settings: {
                call: fn                    
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

    parallel: {
        name: 'parallel',
        settings: {
            uid: null
        },
        job: function() {
            var self = this;
            var collection = this.parent.parallels[this.settings.uid];
            var doneCounter = 0;
            for(var i = 0; i < collection.length; i++) {
                this.parent.runSingle(collection[i], function() {
                    if(++doneCounter === collection.length) {
                        self.parent.componentDone();
                    }
                });
            }
        }
    },

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
    }
}