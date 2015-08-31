ChainWork.js
========
ChainWork allows you easily to create reusable components and construct your code in a maintainable and readable way.  
Consider the example below.
[![flowchart](http://apps.tweecode.com/custom/chainwork/flowchart.png)](http://apps.tweecode.com/custom/chainwork/flowchart.png)
In short this code sets up Facebook SDK on page load and pauses the chain. Useraction calls chain.play() to resume. Now we authenticate the user and do three request to facebook api in parallel, notice the par method is used here instead of add. We use the data from previous components to generate the next url to facebook's api, process the data and compile a template.

### Components ###
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
### Custom functions ### 
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
//> test component (1sek)
//> custom function (1sek)
//> test component (1sek)
```

### Don't need a chain? ###
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

### Usage ###
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
