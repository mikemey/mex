#!/usr/bin/env bash

ex=0
count=0
id="$RANDOM"
while [[ $ex -eq 0 ]]; do
  let count=count+1
  output="$(script -q /dev/null npm run alltest -s)"
  ex=$?
  [[ $ex -eq 0 ]] && status="ok" || status="fail"
  echo "==================== <$id> run # $count: $status ===================="
  [[ $ex -eq 0 ]] || printf '%s\n' "${output}"
done
