/*
---
name: components-core
description: Contains handy components for chainwork.js 
license: MIT-style license.
requires: ChainWork
(c) 2015 Andri Birgisson
...
*/


//get element from id, class or jquery object
var normalizeElement = function(element) {
    var type = typeOf(element);
    if(type === 'element')
        return element;
    if(element instanceof jQuery)
        return element[0];
    if(type === 'string') {
        return document.querySelector(element) || document.querySelector('#' + element) || document.querySelector('.' + element);
    }
};

components.facebookInit =  {
    name: 'facebookInit',
    requirements: [],
    provides: {},
    settings: {
        callNext: true,
        appId: null,
        facebook: null,
    },
    job: function() {
        var self = this;
        //add fbroot if not present
        if (typeOf(document.getElementById('fb-root')) !== 'element') {
            var fbroot = document.createElement('div');
            fbroot.id = 'fb-root';
            document.body.insertBefore(fbroot, document.body.firstChild);
        }

        window.fbAsyncInit = function() {
            FB.init({
                appId: self.settings.appId,
                xfbml: true,
                version: 'v2.2'
            });
            //maybe this should be optional
            FB.Canvas.setAutoGrow();
            self.parent.componentDone();
        };

        (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) {
                return;
            }
            js = d.createElement(s);
            js.id = id;
            js.src = "//connect.facebook.net/en_US/sdk.js";
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    },
};

components.fbRemoveToken = {
    name: 'fbRemoveToken',
    job: function() {
        var self = this;
        FB.api("/me/permissions", "DELETE", function(rsp) {
            self.parent.componentDone();
        });
    }
};

components.test = {
    name: 'test',
    job: function() {
        var self = this;
        console.log('test component');
        setTimeout(function() {
            self.parent.componentDone();
        },1000);
    }
};

components.fbLogin = {
    name: 'fbLogin',
    dependsOn: ['facebookInit'],//Dependancy on any component to run before
    provides: {fbLogin: {}},
    settings: {
        scope: null,
        forceRun: null,
        stopChainOnCancel: false,
        onCancel: function() {},
        onComplete: function(data) {}
    },
    pre: function() {
        if(this.parent.caller !== 'user' && !this.settings.forceRun) {
            this.parent.stop();
            console.warn('CHAIN WARNING: Facebook login must be triggered by user action to prevent popupblock. Its best practice to put pause before');
            return false;
        }    
    },
    job: function() {
        var self = this;
        var scope = this.settings.scope || '';
        
        FB.login(function(response) {
            if(response.authResponse) {
                _.extend(self.provides.fbLogin, response);
                self.settings.onComplete(response);
                self.parent.componentDone();
            } else {
                self.settings.onCancel();
                if(!self.settings.stopChainOnCancel) {
                    self.parent.componentDone();
                }
                if(self.parent.debug) {
                    console.log('User cancelled login or did not fully authorize.');
                }
            }
        }, {
            scope: self.settings.scope
        });
    },
    post: function() {
        //console.log('post function'); this must be documented so lets keep this comment
    }
};


components.fbUserInfo = {
    //TODO check if user is connected before geting info
    name: 'fbUserInfo',
    dependsOn: ['facebookInit', 'fbLogin'],
    provides: {fbUserInfo: {}},
    settings: {
        url: null,
        onComplete: function(data) {}
    },
    job: function() {
        var self = this;
        if(typeOf(this.settings.url) === 'function') {
            this.settings.url = this.settings.url();
        }
        var url = this.settings.url || '/me';
        FB.api(url, function(response) {
            if(!response.error) {
                _.extend(self.provides.fbUserInfo, response);
                self.settings.onComplete(response)
            }
            ////////##################            
            //TODO Give user an option if facebook info is not available
            ////////##################
            self.parent.componentDone();
        });
    }
};

components.fbFeed = {
    //TODO Vantar whait component wait method hér vegna þess að userinn getur tafið respons um X tíma
    name: 'fbFeed',
    dependsOn: ['facebookInit'],
    provides: {},
    settings: {
        params: {
            method: 'feed',
            name: null,
            caption: null,
            link: null,
            picture: null,
            description: null,
        },
        onPublished: null,
        onDeclined: null,
        forceRun: null
    },
     pre: function() {
        if(this.parent.caller !== 'user' && !this.settings.forceRun) {
            this.parent.stop();
            console.warn('CHAIN WARNING: Facebook login must be triggered by user action to prevent popupblock');
            return false;
        }    
    },
    job: function() {
        var self = this;
        var callback = function(response) {
            if (response && response.post_id) {
                self.provides.fbFeed = {hasPosted: true};
                self.settings.onPublished(response);
                self.parent.componentDone();
            } 
            else {
                self.provides.fbFeed = {hasPosted: false};
                self.settings.onDeclined(response);
                self.parent.componentDone();
            }
        };
        FB.ui(this.settings.params, callback);
    },
};

components.fbInvite = {
    //Note that the facebook app has to be in the category "Game" for invite to work (configured on developers.facebook.com)
    name: 'fbInvite',
    dependsOn : ['facebookInit'],
    provides: {},
    settings: {
        params: {
            method: 'apprequests',
            message: 'Invite message'
        },
        onInvited: null,
        onDeclined: null,
        stopChainOnCancel: false,
        forceRun: null
    },
    pre: function(){
        if(this.parent.caller !== 'user' && !this.settings.forceRun) {
            this.parent.stop();
            console.warn('CHAIN WARNING: Must be triggered by user action to prevent popupblock');
            return false;
        }
    },
    job: function(){
        var self = this;
        var callback = function(response) {
            if (response.to) {
                self.provides.fbInvite = {hasInvited: true};
                self.settings.onInvited(response);
                self.parent.componentDone();
            } 
            else {
                self.provides.fbInvite = {hasInvited: false};
                self.settings.onDeclined(response);
                if(!self.settings.stopChainOnCancel) {
                    self.parent.componentDone();
                }
                if(self.parent.debug) {
                    console.log('User did not invite anyone.');
                }
            }
        };
        FB.ui(this.settings.params, callback);
    }
};

// chain.add({
//     componentName: 'sendMail',
//     settings: {
//         apiKey: '4cV-y5Bk1O_7I8AcvyVlqQ',
//         sender: 'sender@sender.com',
//         subject: 'ÓB-vision',
//         recivers: function() {
//             return $('input[name="email"]').val();
               //return 'person1@email.com, person2@email.com';  
//         },
//         htmlBody: function() {
//             var html = $('.value').eq(0).html();
//             return html; 
//         }
//     },
// });

components.sendMail = {
    name: 'sendMail',
    provides: null,
    settings: {
        apiKey: null,
        sender: null,
        subject: null,
        reciver: null,
        htmlBody: null
    },

    job: function() {
        var self = this;
        
        var resolveRecivers = function() {
            var emailsStr = self.settings.reciver;
            console.log(emailsStr);
            var emailList = emailsStr.split(',');
            return _.map(emailList, function(item) {
                return {'email': item};
            });
        };

        var m = new mandrill.Mandrill(this.settings.apiKey);//4cV-y5Bk1O_7I8AcvyVlqQ
        var sender = this.settings.sender;
        var subject = this.settings.subject;
        var recivers = resolveRecivers();
        var htmlBody = this.settings.htmlBody;
        var isDone = false;

        var params = {
            "message": {
                "from_email": sender,
                "to": recivers,
                "subject": subject,
                "html": htmlBody,
                "autotext": true, //turns html content to plaintext if mailclient does not support html
                "track_opens": true,
                "track_clicks": true,
            }
        };

        m.messages.send(params, function(rsp) {
            for(var i = 0; i<rsp.length; i++) {
                var mailRsp = rsp[i];
                if(mailRsp.status !== 'sent') {
                    console.warn('email failed. Reject reason: '+ rsp.reject_reason);
                }
                else {
                    if(!isDone) {
                        self.parent.componentDone();
                        isDone = true;
                    }
                }
            }
        }, function(err) {
            console.warn(err);
        });
    }
};

//Example usage
// chain.add({
//     componentName: 'firebaseSave',
//     settings: {
//         dataRefUrl: 'https://YOURAPP.firebaseio.com/',
//         prefix: 'firebaseProject',
//         //customCollection: {foo: 'bar'} //NOTE this overrides the global collection
//     }
// });

components.firebaseSave = {
    name: 'firebaseSave',
    dependsOn: [],
    provides: {},
    settings: {
        dataRefUrl: null, //new Firebase('https://chater.firebaseio.com/');
        prefix: null,
        suffix: '/entries',
        customCollection: null,
        customId: null,
        customChildName: null
    },
    job: function() {
        var self = this;
        if(!this.settings.prefix) {
            throw 'firebase must have a prefix';
            return;
        }

        var dataRef = new Firebase(this.settings.dataRefUrl + this.settings.prefix + this.settings.suffix);
        var counterRef = new Firebase(this.settings.dataRefUrl + this.settings.prefix + '/counter');
       
        ////////##################            
        //TODO clean collection before trying to save so firebase wont throw error
        ////////##################
        var instanceId;
        if(this.settings.customCollection) {
            //instanceId = dataRef.push(this.settings.customCollection);
            instanceId = dataRef.child(this.settings.customId);
            instanceId.child(this.settings.customChildName).set(this.settings.customCollection);
        }
        else {
            instanceId = dataRef.push(this.parent.collection);
        }
        //This is a counter. Counts records
        counterRef.transaction(function (current_value) {
            return (current_value || 0) + 1;
        });
        instanceId.child('timestamp').set(Firebase.ServerValue.TIMESTAMP);
        this.parent.componentDone();  
    }
};

//BETA
components.firebaseIsAuth = {
    name: 'firebaseIsAuth',
    dependsOn: [],
    provides: {},
    settings: {
        dataRefUrl: null,
        onComplete: function() {}
    },
    job: function() {
        var self = this;
        var fire = new Firebase(this.settings.dataRefUrl);
        fire.onAuth(function(authData) {
            if (authData) {
                self.settings.onComplete(authData)
                self.parent.componentDone();
                return false;
            }
            else {
                self.settings.onComplete('not authenticated');
            }
        });
    }
};


//BETA
/*
.add({
    componentName: 'firebaseAuth',
    settings: {
        dataRefUrl: 'https://elma.firebaseio.com/',
        email: function() {return userData.email},
        password: function() {return userData.password},
    }
})
*/
components.firebaseAuth = {
    name: 'firebaseAuth',
    dependsOn: [],
    provides: {},
    settings: {
        dataRefUrl: null, 
        email: function(){},//TODO this needs to be fixed according to settings changes in ChainWork
        password: function(){},//TODO this needs to be fixed according to settings changes in ChainWork
        authType: 'authWithPassword',
        //authType: 'authAnonymously',
        //more types shall be added
        rememberMe: true,
        onError: function() {}
    },
    job: function() {
        var self = this;
        var fire = new Firebase(this.settings.dataRefUrl);
        
        if(this.settings.authType === 'authWithPassword') {
            fire.authWithPassword({
                email: this.settings.email(), 
                password: this.settings.password(),
                rememberMe: this.settings.rememberMe
            }, function(error, authData) {
                if(error){
                    self.settings.onError(error);
                }
                else {
                    self.parent.componentDone();  
                }
            });
        }
        else if(this.settings.authType === 'authAnonymously') {
            fire.authAnonymously(function(error, authData) {
                if (error) {
                    self.settings.onError(error);
                } 
                else {
                    console.log("Authenticated successfully with payload:", authData);
                }
            });
        }
        else {
            throw 'Firebase Auth is missing authtype';
        }
        
    }
};

components.collectForm = {
    /*
    DOCS
        validation is automatic. but certain names of the input elements can request certain validation rules.
        special names are listed bellow
            socialId -> checks length 10
            email
        its possible to override validation in settings.validation
    */
    name: 'collectForm',
    dependsOn: [],
    provides: {},
    settings: {
        formElement: null,
        errorClass: 'error',
        validations: {
            socialId: function(val) {
                var val = val.replace(/\s/g, '');
                val = val.split(/ /)[0].replace(/[^\d]/g, '');
                var yearBorn = val.substring(4, 6);
                var monthBorn = val.substring(2, 4);
                var dayBorn = val.substring(0, 2);
                var yearNow = parseInt(new Date().getFullYear().toString().substring(2,4));
                if (val.length < 10) {
                    return false;
                }
                if (yearBorn > 01 && yearBorn < yearNow){
                    return false;      
                }
                if (monthBorn > 12){
                    return false;
                }
                if (dayBorn > 31){
                    return false;
                }
                return true;
            },
            email: function(email){
                var re = /\S+@\S+\.\S+/;
                if(re.test(email)) {
                    return true;
                }
                else {
                    return false;
                }
            }
        },
        onError: function() {},
        onComplete: function() {}
    },
    job: function() {
        var self = this;
        var normalizeElement = function(element) {
            var type = typeOf(element);
            if(type === 'element')
                return element;
            if(element instanceof jQuery)
                return element[0];
            if(type === 'string') {
                return document.querySelector(element) || document.querySelector('#' + element) || document.querySelector('.' + element);
            }
        };
        var formElm = normalizeElement(this.settings.formElement);
        var ins = formElm.querySelectorAll('input');
        var errors = [];
        var collection = {};
        var validateKey = function(key) {
            if(!key) {
                throw 'Error in collectForm. Name attribute of input is missing or not valid';
            }
        };

        var validateValue = function(key, val, obj, isRequired) {
            if(!val && isRequired) {
                errors.push(obj);
             }
            //check for special validation and if it does not pass shout about it
            try {
                if(!self.settings.validations[key](val)) {
                    errors.push(obj);
                }
            }
            catch(err) {
                //pass
            }
        };
        var showErrors = function() {
            self.settings.onError();
            for(var i = 0; i<errors.length; i++) {
                for (key in errors[i]) {
                    var element = formElm.querySelector('input[name='+key+']');
                    element.className += ' ' + self.settings.errorClass;
                    element.addEventListener('focus', function() {
                        //Very unreadable way to remove class from classlist. but it has compatability way back.
                        this.className = this.className.replace(new RegExp('(^|\\b)' + self.settings.errorClass.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
                    }, false);
                }
            }
        };
        for(var i = 0; i < ins.length; i++) {
            var inputObj = {}
            var isRequired = ins[i].getAttribute('required') === 'required'
            validateKey(ins[i].name);
            inputObj[ins[i].name] = ins[i].value;
            validateValue(ins[i].name, ins[i].value, inputObj, isRequired);
            collection[ins[i].name] = ins[i].value;
        }
        if(errors.length) {
             showErrors();                 
             this.parent.stop();
             return false;
        }
        this.provides.collectForm = collection;
        this.settings.onComplete(collection);
        this.parent.componentDone();
    },

};

components.spriteAnimation = {
    name: 'spriteAnimation',
    provides: null,
    settings: {
        viewPort: null,
        addPolyfills: true,
        framesPerSecond: 13,
        framesPerImage: 4,
        idleFrames: [0, 8, 5], //from, to, loops
        mainFrames: [0, 58, 1],
        totalLoops: 1
    },
    init: function() {
        //Experimental function to run on startup. maybe its better to inject them before and put stop
        //between the auto injected and the rest. sprite animation needs this to initialize onload
        //and maybe the whole class should be here and only the controlls in job.
    },
    job: function() {
        if(this.settings.addPolyfills) {
            // Polyfill
            var cancelRequestAnimationFrame = (function() {
                return window.cancelAnimationFrame ||
                    window.webkitCancelRequestAnimationFrame ||
                    window.mozCancelRequestAnimationFrame ||
                    window.oCancelRequestAnimationFrame ||
                    window.msCancelRequestAnimationFrame ||
                    clearTimeout;
            })();

            // Polyfill
            var requestAnimationFrame = (function() {
                return window.requestAnimationFrame ||
                    window.webkitRequestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.oRequestAnimationFrame ||
                    window.msRequestAnimationFrame ||
                    function(/* function */ callback, /* DOMElement */ element) {
                        return window.setTimeout(callback, 1000 / 60);
                    };
            })();
        }

        var Animloop = (function() {
            function Animloop(viewPort, options) {
                var self = this;
                this.options = _.extend({
                    framesPerSecond: 13,
                    framesPerImage: 4,
                    idleFrames: [0, 8, 5], //from, to, loops
                    mainFrames: [0, 58, 1],
                    totalLoops: 1
                }, options);

                //vars
                this.viewPort = viewPort;
                this.startFrame = 0;
                this.loopCounter = 0;
                this.state = null;
                this.isStop = false;
                //this.startTime = this.getTimeNow(); //must be set before play
                //Methods
                this.buildConveyor();
                this.idleAnimation();
                this.totalLoopsCounter = 0;

                this.preloadImages(function() {
                    self.play();
                });
            }

            Animloop.prototype.preloadImages = function(done) {
                var images = this.viewPort[0].querySelectorAll('img');
                var total = images.length;
                var counter = 0;
                for(var i = 0; i<images.length; i++) {
                    var img = new Image();
                    img.src = images[i].src;
                    img.onload = function() {
                        counter++;
                        if(counter === total) {
                            if(done)
                                done();
                        }
                    }
                }
                
            }

            Animloop.prototype.buildConveyor = function() {
                var self = this;
                this.conveyor = this.viewPort.children();
                this.conveyor.css('position', 'relative');

                var images = this.conveyor.children();

                images
                    .show()
                    .each(function(i) {
                        $(this).css({
                            left: (i * self.options.framesPerImage * 100) + '%',
                            width: (self.options.framesPerImage * 100) + '%',
                            position: 'absolute'
                        });
                    });
            }

            Animloop.prototype.idleAnimation = function() {
                this.state = 'idle';
                this.endFrame = (this.options.idleFrames[1] - this.options.idleFrames[0]) * this.options.idleFrames[2];
                this.loopEnd = this.options.idleFrames[1] - this.options.idleFrames[0]; //
                this.startFrame = this.options.idleFrames[0];
                this.totalFrames = this.options.idleFrames[1] - this.options.idleFrames[0];
                this.startTime = this.getTimeNow();
                this.goToFrame(this.startFrame);
            }

            Animloop.prototype.mainAnimation = function() {
                this.state = 'main';
                this.endFrame = (this.options.mainFrames[1] - this.options.mainFrames[0]) * this.options.mainFrames[2];
                this.startFrame = this.options.mainFrames[0];
                this.totalFrames = this.options.mainFrames[1] - this.options.mainFrames[0];
                this.startTime = this.getTimeNow();
                this.goToFrame(this.startFrame);
            }

            Animloop.prototype.getTimeNow = function() {
                 return new Date().getTime();
            }

            Animloop.prototype.play = function() {
                var self = this;
                this.isStop = false;
                var time = (this.getTimeNow() - this.startTime) / 1000;
                var frame = Math.floor(time * this.options.framesPerSecond);

                if (frame >= this.endFrame) {
                    this.switchState();
                    this.totalLoopsCounter = this.totalLoopsCounter + 0.5;
                    if(this.totalLoopsCounter === this.options.totalLoops) {
                        this.isStop = true;
                    }

                } else {
                    this.goToFrame(frame % this.totalFrames + this.startFrame);
                }

                this.requestId = requestAnimationFrame(function() {
                    if(self.isStop)
                        self.stop()
                    else
                        self.play();
                });
            }

            Animloop.prototype.checkLoopStatus = function(frame) {
                this.loopCounter++;
                if (this.loopCounter >= this.loops) {
                    this.switchState();
                }
            }

            Animloop.prototype.switchState = function() {
                if (this.state === 'idle') {
                    this.mainAnimation();
                }
                else {
                    this.idleAnimation();
                }
            }

            Animloop.prototype.goToFrame = function(frame){
                //this.conveyor.css('left', -frame * this.options.frameWidth)
                this.conveyor.css('left', -frame * 100 + '%');
            }

            Animloop.prototype.stop = function() {
                cancelAnimationFrame(this.requestId);
            }

            return Animloop;
        })();

        new Animloop( this.settings.viewPort, this.settings );
    }
};


/*
---
name: imagePreload
description: Simple image preloader designed to keep running no matter what
license: MIT-style license.

example:
chain.add({
    componentName: 'imagePreload',
    settings: {
        images: ['shadow.png', 'pizza1.png', 'pizza2.png', 'pizza3.png', , 'pizza4.png'],
        prefix: 'images/menu'
        each: function(counter, percent) {
            console.log(counter, percent+'%');
        }
    }

});

notes: prefix can optionaly have tailings slash, its added anyway
...
*/
components.imagePreload = {
    name: 'imagePreload',
    settings: {
        images: null,
        prefix: null,
        onEach: function(counter) {},
        onComplete: function(){},
    },
    job: function() {
        var self = this;
        var images = this.settings.images;
        var total = images.length;
        var counter = 0;
        var percent = 0;
        for(var i = 0; i<images.length; i++) {
            try {
                var img = new Image();
                if(this.settings.prefix) {
                    //add trailing slash if doesn't exists
                    var prefix = this.settings.prefix.replace(/\/?$/, '/');
                }
                else {
                    prefix = '';
                }
                img.src = prefix + images[i];
                img.onload = function() {
                    counter++;
                    percent = (counter/total)*100;
                    if(self.parent.debug) {
                        console.log('imagePreload loading: ', this);
                    }
                    self.settings.onEach(counter, percent);
                    if(counter === total) {
                        self.settings.onComplete();
                        self.parent.componentDone(); 
                    }
                }
                img.onerror = function(err) {
                    //prevent component from stoping if last image is not found
                    counter++
                    if(total === counter) {
                        self.settings.onEach(counter, 100);
                        self.parent.componentDone();
                    }
                }
            } catch(err) {
                console.log(err);
                //pass
            }
        }
    }
};

/*
---
name: Dialog
description: Dialog based on bootstrap. Runs standalone, no js or css implementation needed

example:
.add('dialog', {
    title: 'Look ma',
    message: $('.dialog').html(),//can also just be string '<p>content</p>'
    onClose: function() {
        console.log('dialog closed');
    }
})

TODO
- Add data-close attributes
- Fine tune animations
...
*/
components.dialog = {
    name: 'dialog',
    settings: {
        title: '',
        message: '',
        size: 'normal',//large small
        onClose: function() {},
    },
    job: function(){
        var self = this;
        var sizeMap = {
            'small': 'chain_modal-sm',
            'normal': '',
            'large': 'chain_modal-lg'
        }
        var sizeClass = sizeMap[this.settings.size];
        var template =  '<div class="modal-backdrop"></div>' +
                        '<div class="chain_modal"><div class="chain_dialog '+ sizeClass + '">' +
                            '<div class="modal-content">' +
                                '<div class="modal-header">' +
                                    '<button type="button" class="close" aria-label="Close"><span aria-hidden="true">×</span></button>' +
                                    '<h4 class="modal-title" id="myModalLabel">'+ this.settings.title +'</h4>' +
                                '</div>' +
                                '<div class="modal-body">' +
                                    '<p>' + this.settings.message + '</p>' +
                                '</div>' +
                            '</div>' +
                        '</div></div>';

        var styles = '<style>.modal-body,.modal-title{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;line-height:1.42857143;color:#333}.chain_modal,.modal-backdrop{position:fixed;top:0;right:0;bottom:0;left:0}.modal-backdrop{z-index:1040;background-color:#000;opacity:.5}@-webkit-keyframes fadeInHalf{0%{opacity:0}100%{opacity:.5}}@keyframes fadeInHalf{0%{opacity:0}100%{opacity:.5}}.fadeInHalf{-webkit-animation-name:fadeInHalf;animation-name:fadeInHalf}.fadeInDownBig,.fadeInHalf{-webkit-animation-fill-mode:both;-webkit-animation-duration:.5s}.fadeInDownBig,.fadeInHalf,.fadeOutHalf{animation-duration:.5s;animation-fill-mode:both}@-webkit-keyframes fadeInDownBig{0%{opacity:0;-webkit-transform:translate3d(0,-500px,0);transform:translate3d(0,-500px,0)}100%{opacity:1;-webkit-transform:none;transform:none}}@keyframes fadeInDownBig{0%{opacity:0;-webkit-transform:translate3d(0,-500px,0);transform:translate3d(0,-500px,0)}100%{opacity:1;-webkit-transform:none;transform:none}}.fadeInDownBig{-webkit-animation-name:fadeInDownBig;animation-name:fadeInDownBig}@-webkit-keyframes fadeOutHalf{0%{opacity:.5}100%{opacity:0}}@keyframes fadeOutHalf{0%{opacity:.5}100%{opacity:0}}.fadeOutHalf{-webkit-animation-name:fadeOutHalf;animation-name:fadeOutHalf}.fadeOutDownBig,.fadeOutHalf{-webkit-animation-fill-mode:both;-webkit-animation-duration:.5s}@-webkit-keyframes fadeOutDownBig{0%{opacity:1;-webkit-transform:none;transform:none}100%{opacity:0;-webkit-transform:translate3d(0,-500px,0);transform:translate3d(0,-500px,0)}}@keyframes fadeOutDownBig{0%{opacity:1;-webkit-transform:none;transform:none}100%{opacity:0;-webkit-transform:translate3d(0,-500px,0);transform:translate3d(0,-500px,0)}}.fadeOutDownBig{-webkit-animation-name:fadeOutDownBig;animation-name:fadeOutDownBig;-webkit-animation-duration:1s;animation-duration:1s;-webkit-animation-fill-mode:both;animation-fill-mode:both}.chain_modal{z-index:1050;overflow:hidden;-webkit-overflow-scrolling:touch;outline:0}.chain_dialog{position:relative;width:auto;margin:10px}.modal-header .close{margin-top:-2px;position:static}.modal-title{margin:0;font-size:18px;font-weight:500}button.close{-webkit-appearance:none;padding:0;cursor:pointer;background:0 0;border:0}.modal-content{position:relative;background-color:#fff;background-clip:padding-box;border:1px solid #999;border:1px solid rgba(0,0,0,.2);border-radius:6px;outline:0;box-shadow:0 3px 9px rgba(0,0,0,.5)}.modal-header{min-height:16.43px;padding:15px;border-bottom:1px solid #e5e5e5}.modal-body{position:relative;padding:15px;font-size:14px}.close{float:right;font-size:21px;font-weight:700;line-height:1;color:#000;text-shadow:0 1px 0 #fff;opacity:.2}@media (min-width:768px){.chain_dialog{width:600px;margin:30px auto}.modal-content{box-shadow:0 5px 15px rgba(0,0,0,.5)}.chain_modal-sm{width:300px}}@media (min-width:992px){.chain_modal-lg{width:900px}}</style>';
        var close = function() {
            $('.modal-backdrop').addClass('fadeOutHalf');
            $('.chain_dialog').addClass('fadeOutDownBig');
            $('.modal-backdrop, .chain_modal').css({'pointer-events': 'none'});
            setTimeout(function() {
                $elements.remove();
                $styles.remove();
                self.settings.onClose();
            }, 500);
        }
        var stylesCompiler =  _.template(styles);
        var $styles = $(stylesCompiler());
        $('body').append($styles);

        var compiler = _.template(template);
        var $elements = $(compiler());
        
        $elements.find('.close').on('click', function() {
            close();
        });

        $(document).on('click', function(e) {
            if($(e.target).hasClass('chain_modal')) {
                close();
            }
        });
        $('body').append($elements);
        //animate dialog in
        $('.modal-backdrop').addClass('fadeInHalf').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){
            $(this).removeClass('fadeInHalf');
        });

        $('.chain_dialog').addClass('fadeInDownBig').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function(){
            $(this).removeClass('fadeInDownBig');
        });

        this.parent.componentDone();
    }
};

//simple solution to close dialogs in the chain
components.dialogsClose = {
    name: 'dialogsClose',
    job: function() {
        $('.chain_modal').trigger('click');
        this.parent.componentDone();
    }
};

//Kanon canvas componets
/*
---
name: Kanon 
description: Components for drawing images on canvas and retriving dataURL

example:
.once('kanonInit', {canvas: '#myCanvas'})
.add('kanonDrawImage',{imageURL: 'images/feedbg.png'})
.add('kanonDrawImage', {imageURL:'http://graph.facebook.com/791558995/picture?width=270&height=270', x: 20, y: 20})
.add('kanonGetDataURL', {onComplete: function(data) {feedChainData.dataURL = data}})


TODO
- Add data-close attributes
- Fine tune animations
...
*/


components.kanonInit =  {
    name: 'kanonInit',
    settings: {
       canvas: null,
       width: null,
       height: null,
    },
    job: function() {
        (function (bindTo) {
            var Kanon = (function() {
                function Kanon(args) {
                    if(!args.canvas) {
                        throw 'KanonInit: no canvas provided';
                    }
                    this.canvas = normalizeElement(args.canvas);
                    this.context = this.canvas.getContext('2d');
                    this.canvas.width = args.width || this.canvas.width;
                    this.canvas.height = args.height || this.canvas.height;
                }

                Kanon.prototype.drawImage = function(img, x, y, width, height) {
                    console.log(img);
                    var width = width || img.width;
                    var height = height || img.height;
                    this.context.drawImage(img, x, y, width, height);
                }

                Kanon.prototype.getDataURL = function() {
                    return this.canvas.toDataURL("image/png");
                }

                return Kanon

            })();
            bindTo.Kanon = Kanon;
        })(window);

        window.kanon = new Kanon(this.settings);
        this.parent.componentDone();
    }
};


components.kanonDrawImage = {
    name: 'kanonDrawImage',
    dependsOn: ['kanonInit'],
    settings: {
        imageURL: null,
        x: null,
        y: null,
        width: null,
        height: null
    },
    job: function() {
        var self = this;
        var draw = function() {
            var width = self.settings.width || self.settings.image.width;
            var height = self.settings.height || self.settings.image.height;
            kanon.context.drawImage(self.settings.image, self.settings.x, self.settings.y, width, height);
        };

        Component.run('imagePreload', {
            images: [this.settings.imageURL],
            onComplete: function(list) {
                self.settings.image = list[0];
                draw();
                self.parent.componentDone();
            },
        });
       
    }
};

components.kanonGetDataURL = {
    name: 'kanonGetDataURL',
    dependsOn: ['kanonInit'],
    settings: {
        onComplete: function() {}
    },
    job: function() {
        this.settings.onComplete(kanon.getDataURL());
        this.parent.componentDone();
    }
};