1. When I reload the app I get a white blank screen and this error message:
```
[Error] WebSocket connection to 'ws://wails.localhost:34115/' failed: A server with the specified hostname could not be found.
[Error] [App] Error checking session: – TypeError: undefined is not an object (evaluating 'window['go']['main']')
TypeError: undefined is not an object (evaluating 'window['go']['main']')
	(anonymous function) (App.tsx:319)
[Info] [vite] Direct websocket connection fallback. Check out https://vitejs.dev/config/server-options.html#server-hmr to remove the previous connection error. (client, line 234)
[Debug] [vite] connected. (client, line 285)
[Log] [Ably] Setting up event listener for ably:message (useAblyRealtime.ts, line 279)
[Error] TypeError: undefined is not an object (evaluating 'window.runtime.EventsOnMultiple')
	reportError (runtime.js:40)
	defaultOnUncaughtError (react-dom_client.js:7091)
    ```

2. Sending messages in a channel doesn't show the new messages
3. I have to re-authenticate every time the app launches
4. I'm getting this in the console
``` 
WARNING  This darwin build contains the use of private APIs. This will not pass Apple's AppStore approval process. Please use it only as a test build for testing and debug purposes.
```
I don't plan on ever distibuting this explicitly in the App Store but I do want to allow users to use this app with as little friction on MacOS as possible. 
5. The icon in the Dock is the default icon from Wails, not the Logo in frontend's public/assets folder
6. Can we round the corners of the app like every other macos app
7. the app launches with a height that goes down past and behind the Dock instead of above it like every other app
8. The borders and placeholder text in the UI components is not inheriting correctly in the app. Copy any relevant styles from monopollis-ui css files into the Wails' React App css files
9. I am asked for my login password multiple times after authenticating, this should not be the case
10. The keychain confirmation message I get is `Pollis wants to use your confidential information stored in "" in your keychain` which seems erroneous and suspiscious
11. When a user signs up, we should get their email and phone number if possible and store that in the remote Turso DB as well
12. When the user is signed out, the messaging on the login screen should indicate they can either sign up or sign in the browser login  (but keep it succinct)
13. The pollis.com/auth-redirect process takes way too long for my liking, if there's anything we can do (compression, faster http protocol, edge runtime etc) let's figure it out