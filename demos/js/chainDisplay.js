    var Cd = (function() {
        
        function Cd(chain) {
            this.chain = chain;

            this.line = $('.cd_line');
        }

        Cd.prototype.log = function() {
            var self = this;
            var chain = this.chain.chain;
            chain.forEach(function(item) {
                self._setLineHeight();
                var $circle = $('<div class="cd_circle animated bounce"></div>').appendTo('.chainDisplay');
                var $label = $('<p>'+item.componentName+'</p>').appendTo($circle);
            });
            this.setActive();
        }

        Cd.prototype.setActive = function() {
            $('.cd_circle').eq(this.chain.index).addClass('cd_active');
        }

        Cd.prototype._setLineHeight = function() {
            var circleHeight = 70;
            this.line.css({'height': circleHeight * this.chain.chain.length});

        }

        return Cd;

    })();
    var cd = new Cd(chain);
    cd.log();