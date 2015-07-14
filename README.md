ChainWork.js
========
ChainWork allows you easily to create reusable components and mix them in a chain with your custom code. A chain in javascript usually executes functions in sequential order. This is also the case with ChainWork but it gives you a tighter control of the chain.

### Components ###
ChainWork provides a standard for components. The core logic in chainwork is simple and it builds upon itself. Meaning that some of it's core functionality are built with components just like the ones you will build. So in a way Chainwork eats its own dog food.<br><br>
Components:
1.   Should solve "one" problem.
2.   Can depend on other components and if so, it should have a list of dependencies.
3.   If the component contains asynchronous code it calls the chain on task completed.
4.   Have a name and settings object.

### Why? ###
it drastically speeds up development and provides a healthy separation of concerns.

### Usage ###
Download the library and include it in your html.
```html
<script src="js/chainWork.js"></script>
```

Lets look at some flow recipes to dempstrate how easely we can change the flow of our code and extend it at any point of our chain.

```html
<script>
var chain = new ChainWork({ debug: true, autoPlay: true });
chain.once('facebookInit', {appId: 'YOURAPPID'});
chain.pause();
chain.add('fbLogin', {stopChainOnCancel: true});
chain.add('fbUserInfo', {
    onComplete: function(data) {
        window.data.first_name = data.first_name;
    }
});
chain.call(function alertUsername(sync) {
    alert('hi ',data.first_name);
    sync();
});
chain.call(function() {
    alert('I'm not synchronous');
});

</script>
```
In the above example we define a new chain with debug mode on(see documentation) and autoPlay set to true. This will make the chain run on page load. The chain will keep running down the chain until it hits the pause component. To run the chain again we must trigger the play method again. We do this with ```chain.play()```. <br><br>In this chain we:
1.  setup facebook sdk on page load.
2.  Authenticate the user with facebook.
3.  Fetch the profile information for that user and store it in a global variable.
4.  Call custom code that alerts the user.
5.  Call another custom function thats asynchrounus.
