#!/usr/bin/env bash

run_exit=0
count=0
id="$RANDOM"
while [[ $run_exit -eq 0 ]]; do
  let count=count+1
  logmsg="[$(date '+%Y-%m-%d %H:%M:%S')] ${id}> Run # ${count}"
  printf '%s ... ' "${logmsg}"

  output="$(script -q /dev/null npm run alltest -s)"
  run_exit="${?}"
  if [[ ${run_exit} -eq 0 ]]; then
    printf 'ok\n'
  else
    printf 'NOK\n'
    printf '%s\n' "${output}"
    printf '%s\n' "${logmsg}"
  fi
done
