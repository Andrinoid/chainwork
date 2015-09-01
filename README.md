ChainWork.js
========
ChainWork allows you easily to create reusable components and construct your code in a maintainable and readable way. Consider the example below.
[![flowchart](http://apps.tweecode.com/custom/chainwork/flowchart2.png)](http://apps.tweecode.com/custom/chainwork/flowchart.png)  

In short this code sets up Facebook SDK on page load and pauses the chain. Useraction calls chain.play() to resume. Now we authenticate the user and do three request to facebook api in parallel, notice the par method is used here instead of add. We use the data from previous components to generate the next url to facebook's api, process the data and compile a template.

### Components
It's easy to create chain components. All chainWork components live in a object called components.  
In this example we create a component that console logs "Hello component" after 1 second and then calls the chain.
```javascript
components.test = {
    name: 'test',
    job: function() {
        var self = this;
        setTimeout(function() {
            console.log('test component');
            self.parent.componentDone();
        }, 1000);
    }
};
```
we can improve our component by adding settings to it. It would be useful to be able to adjust the delay time we harcoded to 1 second.
```javascript
components.test = {
    name: 'test',
    settings: {
        delay: 1000
    },
    job: function() {
        var self = this;
        setTimeout(function() {
            console.log('test component');
            self.parent.componentDone();
        }, this.settings.delay);
    }
};
```
The settings property is an object were we define the options and default values for our component. We can override them when we add the component to our chain.  

We now have a pretty useless but functional component. To add it to our chain we use the add or par methods. Use add to run component in serial and par to run components in parallel. In the example below we test both methods.
```javascript
var chain = new ChainWork()
    .add('test', {delay: 500})
    .par('test')
    .par('test', {delay: 3000})
    .call(function() {
        console.log('the end');
    });

chain.play();
//output
//> test component (1sec)
//> (2)test component (3sec)
//> the end
```

### Custom functions
If your logic is not reusable, it doesn't make sense to wrap it in a component right? ChainWork has a core component to deal with custom functions. In the example below we mix our test component with custom function that does the same.
```javascript
var chain = new ChainWork()
    .add('test')
    .call(function(sync) {
        setTimeout(function() {
            console.log('custom function');
            sync();
        }, 1000);
    })
    .add('test');

chain.play();
//output
//> test component (1sec)
//> custom function (1sec)
//> test component (1sec)
```

### Don't need a chain?
You can run components standalone with Component.run
```javascript
Component.run('test');
//output
//> test component
```
This simply creates a new instance of ChainWork, adds the component and runs the chain. This equals to
```javascript
var chain = new ChainWork();
chain.add('test');
chain.play();
//output
//> test component
```

### Controls


### Usage
Download the library and include it in your html. It depends on loDash.js so don't forget to include that as well
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/lodash.js/3.3.1/lodash.js"></script>
<script src="js/chainWork.js"></script>
<script>
var chain = new ChainWork()
    .add('test')
    .call(function() {
        
    });
    .add('test');
</script>
```
