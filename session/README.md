# Session service


Session service (based on [WSServer](../connectors#wsserver-in-wsserverjs)); deals
with registering users, issuing (login user), verifying and revoking JWTs.


### Configuration

Name         |        Description               | Example 
------------ | -------------------------------- | ----------------
`wsserver`  | [Websocket server configuration](../connectors#configuration) | see example below
`jwtkey`    | JWT secret to sign tokens          | `ZCdvaCwganVzdCBhIHRlc3RrZXkK`
`db.url`    | MongoDB url         | `mongodb://127.0.0.1:27017`
`db.name`   | MongoDB name        | `testdb`

Currently, JWT token expiration is hardcoded to 2 hours.

```javascript
const sessionService = new SessionService({
    jwtkey: 'ZCdvaCwganVzdCBhIHRlc3RrZXkK',
    wsserver: { 
        port: 12015, 
        path: '/session-service', 
        authTokens: [ 'c2Vzc2lvbi1zZXJ2aWNlLXRva2VuCg==' ]
    },
    db: {
        url: 'mongodb://127.0.0.1:27017', 
        name: 'testdb' 
    }
})
```

### Messages

All messages are JSON objects, request messages require an `action` parameter.

Available messages:

- [Register user](#register-user)
- [Login user](#login-user)
- [Verify JWT](#verify-jwt)
- [Revoke JWT](#revoke-jwt)

If an `action` parameter is not recognized (must be one of `register`, `login`, `verify`, `revoke`), 
service responds with:
```javascript
{ status: 'error', message: 'invalid request' }
```

#### Register user

##### Request

Parameter       |        Description               | Example 
------------ | -------------------------------- | ----------------
`action`          | `register` action                | `register` 
`email`    | User email <br> (details: [@hapi/joi](https://hapi.dev/family/joi/?v=16.1.8#stringemailoptions), 2 domain segments required) | `test_user@email.com`
`password`      | User password <br> (sha256 digest of plain password, hex encoded, length === 64 chars) | `a15c020c905a5d41606ccfe450d7b` `21b260b4d2b3882ec733d776f3dacb41ae6`

Example:
```javascript
{
  action: 'register',
  email: 'test_user@email.com',
  password: 'a15c020c905a5d41606ccfe450d7b21b260b4d2b3882ec733d776f3dacb41ae6'
}
```

##### Responses

###### Successful registration
```javascript
{ status: 'ok', action: 'register' }
```

###### Invalid email
```javascript
{ message: 'email invalid', status: 'nok', action: 'register' }
```

###### Email exists already
```javascript
{
  message: 'duplicate email [test_user@email.com]',
  status: 'nok',
  action: 'register'
}
```

###### Any other error

- missing `action`, `email`, `password` parameter
- Password not 64 characters
- additional, unrecognized parameter

```javascript
{ status: 'error', message: 'invalid request' }
```




#### Login user

##### Request

Parameter       |        Description               | Example 
------------ | -------------------------------- | ----------------
`action`          | `login` action                | `login` 
`email`    | User email <br> (details: [@hapi/joi](https://hapi.dev/family/joi/?v=16.1.8#stringemailoptions), 2 domain segments required) | `test_user@email.com`
`password`      | User password <br> (sha256 digest of plain password, hex encoded, length === 64 chars) | `a15c020c905a5d41606ccfe450d7b21b` `260b4d2b3882ec733d776f3dacb41ae6`

Example:
```javascript
{
  action: 'login',
  email: 'test_user@email.com',
  password: 'a15c020c905a5d41606ccfe450d7b21b260b4d2b3882ec733d776f3dacb41ae6'
}
```

##### Responses

###### Successful login

Parameter       |        Description               | Example 
------------ | -------------------------------- | ----------------
`action`      | `login` action                  | `login` 
`status`      | `ok` response status                  | `ok` 
`jwt`        | JWT token for current session | see example
`id`          | User ID               | `5de363fbd0f61042035dc603`
`email`      | User email from request | `test_user@email.com`

```javascript
{
  id: '5de363fbd0f61042035dc603',
  email: 'test_user@email.com',
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkZTM2M2ZiZDBmNjEwNDIwMzVkYzYwMyIsImVtYWlsIjoidGVzdF91c2VyQHRlc3QuY29tIiwiaWF0IjoxNTc3OTc4Mjk5LCJleHAiOjE1Nzc5ODU0OTl9.asAuDfUp4wrRPKUw0hKY4F6PeQ0mPUA-h_Y-py5yHdc',
  status: 'ok',
  action: 'login'
}
```

###### Login failed
```javascript
{
  message: 'login failed [test_user@test.com]: Password or username is incorrect',
  status: 'nok',
  action: 'login'
}
```

###### Invalid email
```javascript
{ message: 'email invalid', status: 'nok', action: 'login' }
```

###### Any other error

- missing `action`, `email`, `password` parameter
- Password not 64 characters
- additional, unrecognized parameter

```javascript
{ status: 'error', message: 'invalid request' }
```






#### Verify JWT

##### Request

Parameter       |        Description             
------------ | -------------------------------- 
`action`          | `verify` action                
`jwt`        | JWT token to verify
Example:
```javascript
{ 
    action: 'verify', 
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkZTM2M2ZiZDBmNjEwNDIwMzVkYzYwMyIsImVtYWlsIjoidGVzdF91c2VyQHRlc3QuY29tIiwiaWF0IjoxNTc3OTc4Mjk5LCJleHAiOjE1Nzc5ODU0OTl9.asAuDfUp4wrRPKUw0hKY4F6PeQ0mPUA-h_Y-py5yHdc', 
}
```

##### Responses

###### Successful verification

Parameter       |        Description             
------------ | -------------------------------- 
`action`      | `verify` action                  
`status`      | `ok` response status                   
`user`        | User object (including JWT payload) 

```javascript
{
  user: {
    id: '5de363fbd0f61042035dc603',
    email: 'test_user@test.com',
    iat: 1577979116,
    exp: 1577986316
  },
  status: 'ok',
  action: 'verify'
}
```


###### JWT expired
```javascript
{ message: 'jwt expired', status: 'nok', action: 'verify' }
```

###### JWT verification failed
```javascript
{ status: 'nok', action: 'verify' }
```

###### Any other error

- missing `action` or `jwt` parameter
- invalid JWT format
- additional, unrecognized parameter

```javascript
{ status: 'error', message: 'invalid request' }
```





#### Revoke JWT

##### Request

Parameter       |        Description             
------------ | -------------------------------- 
`action`          | `revoke` action               
`jwt`        | JWT token to revoke  

Example:
```javascript
{ 
    action: 'revoke', 
    jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjVkZTM2M2ZiZDBmNjEwNDIwMzVkYzYwMyIsImVtYWlsIjoidGVzdF91c2VyQHRlc3QuY29tIiwiaWF0IjoxNTc3OTc4Mjk5LCJleHAiOjE1Nzc5ODU0OTl9.asAuDfUp4wrRPKUw0hKY4F6PeQ0mPUA-h_Y-py5yHdc', 
}
```

##### Responses

###### Successful revocation (also for unknown or already expired JWTs)

```javascript
{ status: 'ok', action: 'revoke' }
```

###### Any other error

- missing `action` or `jwt` parameter
- invalid JWT format
- additional, unrecognized parameter

```javascript
{ status: 'error', message: 'invalid request' }
```
