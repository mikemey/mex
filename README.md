# mex

This is a trial balloon implementation of a crypto-currency exchange service. Uses 
websockets as service-to-service communication for improved performance (over http-requests).

#### Goals

How far does it go:
- get a simple exchange (btc/eth only) up and running, operating on test-networks, including:
    - deposit/withdrawals (via http interface)
    - exchange/trades (via websocket interface)
- hit it hard & repeatedly with a load testing tool (e.g. artillery) to find the breaking point(s)  

### Requirements

- Node.js v13.0 (or higher)
- MongoDB v4.0 (or higher)

Running the module-tests in `wallet-test` requires Mac OS X/Darwin (x64). To enable other OSs, 
2 lines in `wallet-test/chains/btc-node.orch.js` need to be changed: 
```
btcBinUrl: `https://bitcoincore.org/bin/bitcoin-core-${btcversion}/bitcoin-${btcversion}-osx64.tar.gz`

// and

if (os.platform() !== 'darwin') ...
```

During the first test run, `wallet-test` downloads, installs and
configures a Bitcoin regtest instance. 

### Running

Start all services: 

`browser-test/e2ehelper.sh start` or `npm run e2e start` (which is also executes `e2ehelper.sh start`)
 
Service `useraccount` is running and accessible at `localhost:13500/uac` 
A full configuration of all services is in `browser-test/orchestrator.e2e.js`.

### Testing

- `npm test` - run all tests
- `npm run module-test` or `./run_module_tests.sh` - run module tests only
- `npm run e2e` - run browser tests (command-line only)
- `npm run e2e open` - run browser tests with UI

### APIs

For details see `README.md`s in each module
