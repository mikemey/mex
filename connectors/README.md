## connectors

Available implementations:
- [WSServer](#wsserver-in-wsserverjs)
- [WSClient](#wsclient-in-wsclientjs)
- [WSSecureServer](#wssecureserver-in-ws-secure-serverjs)
- [HttpServer](#httpserver-in-httpserverjs)



### `WSServer` in `wsserver.js`

Base server implementation using [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js).
Acts as REQ/REP server (see [`received (request)`](#received-request)) 
and PUB server (see [`offerTopics (...topics)`](#offerTopics-topics-void) and 
[`broadcast (topic, message)`](#broadcast-topic-message-Promise)).

Configured with constructor call. Request/response/broadcast messages are expected to 
be objects (`JSON.parse`/`JSON.stringify` used for serialization).

Clients connecting need to send an authentication header `X-AUTH-TOKEN: 'auth-token-string'`.

#### Usage

Extend `WSServer` class and pass a configuration object in constructor call:

```javascript
class ExampleWSServer extends WSServer {
    constructor (config) {
        super(config)
        ...
    }
}
```

##### `start (): Promise`
Starts server using configuration passed into constructor. Returns a resolved promise
when server is listening, or rejects with error.

##### `stop (): void`
Stops server.
    
##### `received (request)`

Implement `received (request) {}` function to receive requests. For an 
incoming request `WSServer` passes the parsed request object to `received` and 
expects either an object or a `Promise` resolving to an object as return value,
which is sent back to client: 

```javascript
received (request) {
    return Promise.resolve({ server: 'response' })  
}
```

##### `offerTopics (...topics): void`
Creates topics to which clients can subscribe. Topic names can be any value valid
for Node's `Map` implementation - with the exception of curly braces `{}`, which 
are prohibited. 

##### `broadcast (topic, message): Promise`
Broadcasts `message` to all clients subscribed to `topic`. As with the return value of `received`,
`message` is expected to be an object (serializable with `JSON.stringify`).

Returns a resolved `Promise` when all client-websockets have scheduled the `message` to be sent.

#### Configuration

Name        | Description               | Example 
----------- | ----------------      | ----------------
`port`        | TCP port (number: 0 - 65535)                         | `1200`
`path`        | WS endpoint path <br> (matching `/^\/[a-zA-Z0-9-]{2,30}$/`) | `/example-endpoint`
`authTokens`  | Array of allowed authentication tokens <br> (base64 encoded, >= 20 chars long) | `[ 'dGhpc2lzYXRlc3RrZXkK' ]`

```javascript
const server = new ExampleWSServer({ 
    port: 12000, 
    path: '/example-endpoint', 
    authTokens: [ 'dGhpc2lzYXRlc3RrZXkK' ]
})
```






### `WSClient` in `wsclient.js`

Websocket client implementation for `WSServer` (using Node.js `'ws'` package). Sends 
requests/receives server responses and can subscribe to broadcast messages.

When a connection is established, ping requests are regularly sent
(see configuration `pingInterval`) to keep the server connection alive.

Configuration set in constructor call. Request/response/broadcast messages are expected to 
be objects (`JSON.parse`/`JSON.stringify` used for serialization).

All public functions `send`, `subscribe` and `unsubscribe` return a rejected Promise for 
connecting/sending timeouts (`TimeoutError`) or a generic `Error('disconnected')` for
any other failure case. In these cases the connection will be closed quietly.

#### Usage

Create an instance with a configuration object and a name for logging:

```javascript
const config = { 
    url: 'ws://localhost:1200/example-endpoint', 
    authToken: 'dGhpc2lzYXRlc3RrZXkK', 
    timeout: 2000, 
    pingInterval: 30000 
}
const wsclient =  new WSClient(config), 'logger-name')
```

##### `send (request): Promise`

Attempts to connect to the configured `url` (if not connected) and sends 
the `request` object. On success a `Promise` which resolves to the server response
is returned.

##### `stop (): void`
Closes connection to server.

##### `subscribe (topic, callback = (topic, message) => { }): Promise`

Attempts to subscribe to `topic` and registers the given `callback` for it. Returns
a `Promise` resolving to a subscription result when send/receive cycle was successful.
A NOK subscription results indicates that the server isn't offering the requested `topic`.

OK/NOK subscription results:
```javascript
{ status: 'ok', action: 'subscribe' }
// or
{ status: 'nok', action: 'subscribe' }
```

When a broadcast message is received the given `callback` is called with the broadcasted
`topic` and `message` object.


##### `unsubscribe (...topics): Promise`

Unsubscribes from `topics`. Always returns an array of OK responses (if send/receive cycle was successful)
for each topic:
```javascript
[ { status: 'ok', action: 'unsubscribe' } ]
```

#### Configuration

Name         |        Description               | Example 
------------ | -------------------------------- | ----------------
`url`          | Websocket URL of server                | `ws://localhost:1200/example-endpoint`
`authToken`    | Authentication token <br> (base64 encoded, >= 20 chars long) | `dGhpc2lzYXRlc3RrZXkK`
`timeout`      | Timeout (ms) for connecting/waiting for response <br> (20 <= `timeout` <= 60000) | `2000`
`pingInterval` | Interval (ms) between pings <br> (20 <= `timeout` <= 100000) | `30000`









### `WSSecureServer` in `ws-secure-server.js`

Extension of [`WSServer`](#wsserver-in-wsserverjs), adds additional JWT check for incoming requests.
All requests are checked for a JWT token and sent to a `session` service for verification before 
they are passed on to function `secureReceived`. Adds the `session` user object to the request
if successful verification.

Requires additional configuration for connecting to `session` service.


#### Usage

Similarly to `WSServer`, extend `WSSecureServer` class and pass a configuration object in constructor call:

```javascript
class ExampleWSSecureServer extends WSSecureServer {
    constructor (config) {
        super(config)
        ...
    }
}
```

Public functions of [`WSServer`](#wsserver-in-wsserverjs): `start`, `stop`, `offerTopics` 
and `broadcast` work exactly as in parent class. **DO NOT** implement `received` function
(this would disable the JWT check), instead use `secureReceived (request)`:

```javascript
secureReceived (request) {
    return Promise.resolve({ server: 'response' })  
}
```

For successful verification checks, the request object has an additional property `user` from 
`session` service verification response.

If the incoming `request` can't be verified, an error response is returned without calling `secureReceived`:

- when request to `session` service failed:
```javascript
{ status: 'error', message: 'session-service unavailable' }
``` 
- when JWT verification failed in `session` service:
```javascript
{ status: 'nok', action: 'verify' }
``` 
- when verification response from `session` service doesn't include user data 
(shouldn't happen, indicates an implementation issue here):
```javascript
{ status: 'error', message: 'session-service user unavailable' }
``` 

#### Configuration

Name              | Description               
----------------- | ---------------- 
`wsserver`        | WSServer configuration (see [`WSServer` configuration](#configuration))
`sessionService`  | WSClient configuration for `session` service (see [`WSClient` configuration](#configuration-1))

```javascript
const securedServer = new ExampleWSSecureServer({
    wsserver: { port: 12005, path: '/jwt-secured', authTokens: ['dGhpc2lzYXRlc3RrZXkK'] },
    sessionService: {
        url: 'ws://localhost:12010/session',
        authToken: 'YW5vdGhlcnRlc3RrZXkK',
        timeout: 200,
        pingInterval: 30000
    }
})
```







### `HttpServer` in `httpserver.js`

Base http server implementation using [Express](http://expressjs.com/).

Setup:
- adds request- and error-logger
- adds cookie session middleware
- adds csrf protection middleware
- creates parent `path` router (using [configured](#configuration-3) `path`)
- creates `${path}/version` route responding with `${version} (server-start-date)`
(see [configuration](#configuration-3))

#### Usage

Extend `HttpServer` class and pass a configuration object in constructor call. Implement

```javascript
class HttpServerImpl extends HttpServer {
    constructor () {
        super(config)
        ...
    }
}
```

##### `setupApp (app)`
(Optional) Implement `setupApp` to customize express app. 

##### `addRoutes (pathRouter)`
(Required) Implement `addRoutes` to add endpoint-routes to parent `path` router (see [configuration](#configuration-3)). 

##### `start (): Promise`
Creates server (calling [`setupApp (app)`](#setupApp-app) + [`addRoutes (pathRouter)`](#addroutes-pathrouter))
and starts listening on configured `interface`/`port`. Returns `Promise` resolving to `server` instance or rejects with error.

##### `stop (): Promise`
Stops server.

#### Configuration

Name                 | Description                      | Example 
-------------------- | -------------------------------- | --------------------------------
`secret`             | secret used for cookie session <br> (base64 encoded, >= 20 chars long) | `ZHVkZSwganVzdCBmb3IgdGhlIGRvY3MK`
`version`            | server version (used in `${path}/version` response)    | `1.0.1`
`interface`          | server binding interface <br> (valid IP address)        | `127.0.0.1`
`port`               | server port (number:  0 - 65535)                | `12020`
`path`               | base path used for all routes <br> (must match `/^\/[a-zA-Z0-9-]{2,30}$/`) | `/server-path`
`suppressRequestLog` | (array) disable request logs for specified routes <br> (`path` is prefixed automatically) | `[ '/version' ]`

```javascript
const server = new HttpServerImpl({ 
    secret: 'ZHVkZSwganVzdCBmb3IgdGhlIGRvY3MK',
    version: '1.0.1',
    path: '/server-path',
    port: 12020,
    interface: '127.0.0.1',
    suppressRequestLog: [ '/version' ]
})
```

