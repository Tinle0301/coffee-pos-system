***
- One index.html as a blank canvas — this is a Single Page App (SPA). Instead of a separate HTML file per screen (menu.html, confirm.html...), there's one page with an empty <div id="app">, and JavaScript swaps its contents depending on which "screen" is active. That's why main.js has a navigate() function instead of the browser doing normal page navigation — it's faster (no full page reload between screens) and keeps shared state (like the current order) alive in memory as the user moves around.
- Vite : it's the dev server + bundler. During development it serves your files instantly with no wait (native ES modules, no compile step you notice), and for production (npm run build) it bundles everything into a few optimized files. Without it you'd need to manually manage script loading order and there'd be no npm run dev hot-reload.

***
* package.json : Lists the project's name, dependencies (vite,vitest,jsdom) and scripts 
* vitest.config.js : Tells Vitest to simulate a browser( environment:jsdom) . Without jsdom, any test touching document (like logout.test.js) throws window is not defined.
* index.html: The one real HTML page the browser actually requests, everything else is pulled in by JavaScript imports from here.
* main.js: The app's router/shell. Builds the layout (content area + logout button). Call by index.html, and calls menu.js,confirm.js,logout.js and style.js
* style.css: visual styling, none of the screen files contain any styling themselves, they only return HTML structure.
* menu.test.js,confirm.test.js, logout.test.js are unit tests for menu.js, confirm.js and logout.js.
* menu.stub.js: Fake listMenuItems(): returning hardcoded, standing in for the real backend until it's ready.
* orders.js: Placeholder createOrder() — currently fakes a successful order ID rather than hitting Supabase
* auth.js: Placeholder signOut(), directly mocked by name in logout.test.js

