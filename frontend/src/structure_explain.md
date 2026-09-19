* package.json : Lists the project's name, dependencies (vite,vitest,jsdom) and scripts 
* vitest.config.js : Tells Vitest to simulate a browser( environment:jsdom) . Without jsdom, any test touching document (like logout.test.js) throws window is not defined.
* index.html: The one real HTML page the browser actually requests, everything else is pulled in by JavaScript imports from here.
* main.js: The app's router/shell. Builds the layout (content area + logout button). Call by index.html, and calls menu.js,confirm.js,logout.js and style.js
* style.css: visual styling, none of the screen files contain any styling themselves, they only return HTML structure.
* menu.test.js,confirm.test.js, logout.test.js are unit tests for menu.js, confirm.js and logout.js.
* menu.stub.js: Fake listMenuItems(): returning hardcoded, standing in for the real backend until it's ready.
* orders.js: Placeholder createOrder() — currently fakes a successful order ID rather than hitting Supabase
* auth.js: Placeholder signOut(), directly mocked by name in logout.test.js
  
* 
