# Wallet service API

Wallet service (based on [WSSecureServer](../connectors#wssecureserver-in-ws-secure-serverjs)) 
provides requesting addresses and invoices (== transactions) and offers updates 
on new invoices and blocks.


### Configuration

Name             |        Description               | Example 
---------------- | -------------------------------- | ----------------
`wsserver`      | [WSServer configuration](../connectors#configuration) | see example
`sessionService` | Session service [WSClient configuration](../connectors#configuration-1) | see example
`chains.btcnode.client` | [Bitcoin-core client configuration](#https://github.com/ruimarinho/bitcoin-core#usage)  | see example
`chains.btcnode.zmq` | ZeroMQ port | see example
`db.url`    | MongoDB url         | `mongodb://127.0.0.1:27017`
`db.name`   | MongoDB name        | `testdb`


Bitcoin-node configuration contains 2 sections - `chains.btcnode.client` for requesting data (REST/RPC) 
and `chains.btcnode.zmq` for subscribing to transaction and block updates from the Bitcoin node.


##### Full example:
```javascript
const walletService = new WalletService({
    wsserver: { 
        port: 12006, 
        path: '/wallet', 
        authTokens: ['dGhpc2lzYXRlc3RrZXkK'] 
    },
    sessionService: {
        url: 'ws://localhost:12010/session',
        authToken: 'YW5vdGhlcnRlc3RrZXkK',
        timeout: 2000,
        pingInterval: 30000
    },
    chains: {
        btcnode: {
            client: {
                network: 'regtest',
                host: '127.0.0.1',
                port: 24842,
                username: 'regtester',
                password: 'regtester',
                wallet: 'wallet-name'
            },
            zmq: 'tcp://127.0.0.1:11590'
        }
    },
    db: { 
        url: 'mongodb://127.0.0.1:27017', 
        name: 'testdb' 
    }
})
```

## Messages

All request/response messages are objects, request messages require an `action` property. 

User data requests require a `jwt` property (passed to [session service](../session)
for validation).

Error responses for invalid requests contain the causing request and resolved
user object as `message` property (example for an invalid address request):
```javascript
{
  status: 'error',
  message: {
    action: 'address',
    symbol: 'NKN',
    user: { id: '5de363fbd0f61042035dc603', email: 'test_user@test.com' }
  }
}
```


Available messages:

- [Get user address](#get-user-address)
- [Get user invoices](#get-user-invoices)


#### Get user address

Returns a deposit address for a given asset and user. First time an address is created,
subsequent requests will receive the same address. 

##### Request

Property    |        Description               | Example 
------------ | -------------------------------- | ----------------
`action`     | `address` action                 | `address` 
`jwt`        |  User JWT                      |  see example
`symbol`     | Asset symbol                   | `btc`

Example:
```javascript
{
    action: 'address',
    jwt: 'a15c020c905a5d41606ccfe450d7b21b260b4d2b3882ec733d776f3dacb41ae6',
    symbol: 'btc'
}
```

##### Response
```javascript
{ 
    action: 'address',
    status: 'ok',
    address: 'testing-address'
}
```









#### Get user invoices

Returns all invoices for a given asset and user. 

##### Request

Property    |        Description               | Example 
------------ | -------------------------------- | ----------------
`action`     | `address` action                 | `address` 
`jwt`        |  User JWT                      |  see example
`symbol`     | Asset symbol                   | `btc`

Example:
```javascript
{
    action: 'address',
    jwt: 'a15c020c905a5d41606ccfe450d7b21b260b4d2b3882ec733d776f3dacb41ae6',
    symbol: 'btc'
}
```

##### Response

Property    |        Description             
------------ | -------------------------------- 
`action`     | `invoices` action                  
`status`     | `ok` response status                   
`invoices`   | Array of invoices 


Invoice properties:

Property      |        Description             
------------- | -------------------------------- 
`userId`      | User ID                  
`symbol`      | Invoice asset symbol                   
`invoiceId`   | Transaction ID
`date`        | Invoice received/updated date 
`amount`      | Amount in asset base-unit
`blockheight` | Block including the transaction or `null` for new transactions

```javascript
{
  action: 'invoices',
  status: 'ok',
  invoices: [
    {
      userId: '5de363fbd0f61042035dc603',
      symbol: 'btc',
      invoiceId: '47a307cfafab57381a8eb7a740efd35370c5212cfd404a8c8d41c2d9d63c92a7',
      date: '2019-12-19T13:59:55.163Z',
      amount: '12345000',
      blockheight: null
    },
    {
      userId: '5de363fbd0f61042035dc603',
      symbol: 'btc',
      invoiceId: 'c27712bb0c607336d5625bf2196ddab0217c9f1bd77fa68fc1c00f75067e8535',
      date: '2019-12-19T13:50:22.634Z',
      amount: '12345000',
      blockheight: 1965
    }
  ]
}
```







## Published topics

For details on how to subscribe to published topics see 
[WSClient in connectors module](../connectors#subscribe-topic-callback-topic-message-promise). 

Available topics:

- [Invoices update](#invoices-update) `invoices`
- [Block update](#block-update) `blocks`

#### Invoices update
##### Topic name: `invoices`

New/updated invoices are broadcasted only for transactions with a known user address. 
Invoice properties in broadcast messages are the same as in [Get user invoices](#get-user-invoices).

Message properties:

Property    |        Description                
------------- | -------------------------------
`blockheight` | Current blockheight 
`symbol`      | Asset symbol of update  
`invoices`    | Array of relevant invoices

New invoice example:
```javascript
{
  blockheight: 1057,
  symbol: 'btc',
  invoices: [
    {
      userId: '5de363fbd0f61042035dc603',
      symbol: 'btc',
      invoiceId: 'e3a6368d5271726244592613f8209c57f2fb776086d74cae902a65f2cb4490f1',
      date: '2020-01-03T05:49:48.205Z',
      amount: '987650000',
      blockheight: null
    }
  ]
}
```

Updated invoice example:
```javascript
{
  blockheight: 1058,
  symbol: 'btc',
  invoices: [
    {
      userId: '5de363fbd0f61042035dc603',
      symbol: 'btc',
      invoiceId: 'da72fc279760c295d7419bce156cb01784ee9059b595c4d277f1322ad80b3a8a',
      date: '2020-01-03T05:50:12.252Z',
      amount: '12345000',
      blockheight: 1058
    },
    {
      userId: '5de363fbd0f61042035dc603',
      symbol: 'btc',
      invoiceId: 'e3a6368d5271726244592613f8209c57f2fb776086d74cae902a65f2cb4490f1',
      date: '2020-01-03T05:49:49.959Z',
      amount: '987650000',
      blockheight: 1058
    }
  ]
}
```


#### Block update
##### Topic name: `blocks`

Sends updates when a new block was created for an asset

Message properties:

Property    |        Description                
------------- | -------------------------------
`symbol`      | Current blockheight 
`invoices`    | Array of relevant invoices

Example:
```javascript
{ symbol: 'btc', blockheight: 1058 }
```
