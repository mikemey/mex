#!/usr/bin/env bash

export LOG_LEVEL=none
npm run connectors-test -s &&
npm run session-test -s &&
npm run useraccount-test -s &&
npm run wallet-test -s &&
npm run utils-test -s