/*
---
name: components-core
description: Contains essential components for chainwork.js
license: MIT-style license.
requires: ChainWork
(c) 2015 Andri Birgisson
...
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
            var onComplete = function() {
                self.parent.componentDone();
            };
            this.settings.call(onComplete);
        }
    },

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
            setTimeout(function() {
                self.parent.chain.splice(self.parent.index, 1);
            });
            if(this.settings.delay) {
                setTimeout(function() {
                    self.parent.play('chain');
                }, this.settings.delay);
            }
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
            if(me.settings.ifCondition) {
                this.parent.add(me.settings.component);
            }
        },
        job: function() {
            this.parent.componentDone();
        }
    },

    if: {
        name: 'if',
        settings: {
            ifCondition: function() {}, //must return true or false
            component: null //this component will be added
        },
        job: function() {
            if(this.settings.ifCondition) {
                this.parent.add(this.settings.component);
            }
            this.parent.componentDone();
        }
    },
}