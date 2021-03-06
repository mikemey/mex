#!/usr/bin/env bash

test_dir="${BASH_SOURCE%/*}"

command="${1:-run}"

action=
cypress_cmd="invalid-state"
if [[ ${command} == "run" ]]; then
  action="fullrun"
  cypress_cmd="run"
fi
if [[ ${command} == "open" ]]; then
  action="fullrun"
  cypress_cmd="open"
fi
if [[ -z ${action} ]]; then
  action="${command}"
fi

e2e_output="$test_dir/tmp.out.e2e"
server_bin="node $test_dir/orchestrator.e2e.js start"
cypress_bin="npx cypress ${cypress_cmd}"

server_startup_retries=10
server_baseUrl=
exit_code=0

sed_any_group="\(.*\)"
sed_number_group="\([0-9]*\)"
server_baseurl_re="^baseurl=${sed_any_group}$"
server_pid_re="^pid=${sed_number_group}$"

function print_usage () {
  echo -e "\n usage: $(basename -- $0) [ start | stop | run | open ]"
  echo -e "\nCommands:"
  echo -e "  start           starts service"
  echo -e "  stop            stops service"
  echo -e "  run   (default) runs cypress tests (also executes start/stop commands)"
  echo -e "  open            opens cypress UI (also executes start/stop commands)"
  echo -e "\nConfigured binaries:"
  echo -e "  service binary: (${server_bin})"
  echo -e "  cypress binary: (${cypress_bin})"
  echo -e "All outputs are redirected to '${e2e_output}'"
}

function main () {
  case "$action" in
    "start" )
      start_e2e_infrastructure
    ;;
    "stop" )
      stop_e2e_infrastructure true
    ;;
    "fullrun" )
      start_e2e_infrastructure
      [[ ${exit_code} -eq 0 ]] && start_cypress
      stop_e2e_infrastructure
    ;;
    * )
      print_usage
      error_message "command not recognized: >$action< \nmust be either '$(basename $0) start' or '$(basename $0) stop'"
    ;;
  esac
}

function start_e2e_infrastructure () {
  [[ -f "$e2e_output" ]] && \
      echo "$(basename "$e2e_output") exists, shutting down existing e2e infrastructure..." && \
      stop_e2e_infrastructure true
  echo "new session $(date)" > "$e2e_output"
  start_server
  wait_for_server
}

function stop_e2e_infrastructure () {
  force_stop=$1
  if [[ ! -f "$e2e_output" ]]; then
    error_message "session log file not found: $e2e_output"
    return
  fi
  server_pid=($(extract_from_output "$server_pid_re"))
  echo "stopping process: $server_pid"
  kill ${server_pid}
  sleep 1
  echo "e2e infrastructure stopped."

  errors=`grep "Error" ${e2e_output}`
  if [[ -z ${errors} ]] || [[ -n ${force_stop} ]]; then
    rm "$e2e_output"
  else
    echo "found errors in log-file, keeping ${e2e_output}"
    echo "$errors"
  fi
}

function start_cypress () {
  if [[ ${server_baseUrl} ]]; then
    pushd . > /dev/null
    cd ${test_dir}
    CYPRESS_baseUrl="$server_baseUrl" ${cypress_bin}
    exit_code=$?
    popd > /dev/null
  else
    error_message "ERROR: baseUrl not set, aborting"
  fi
}

function start_server () {
  echo "starting server..."
  ${server_bin} >> "$e2e_output" 2>&1 &
}

function wait_for_server () {
  sleep 1
  server_baseUrl=$(extract_from_output "$server_baseurl_re")
  [[ ${exit_code} -ne 0 ]] && return

  printf "waiting for server hosting ${server_baseUrl} "
  while [[ ${server_startup_retries} > 0 && `curl -s -o /dev/null -w "%{http_code}" ${server_baseUrl}` == "000" ]]; do
    sleep 0.3
    printf "$server_startup_retries "
    server_startup_retries=`expr ${server_startup_retries} - 1`
  done

  if [[ ${server_startup_retries} > 0 ]]; then
    echo "... started"
  else
    error_message "server NOT running!"
  fi
}

function extract_from_output () {
  echo `sed -n -e 's/'"$1"'/\1/p' "$e2e_output"`
}

function check_is_number () {
  ! [[ "$1" =~ ^[0-9]+$ ]] && error_message "$2"
}

function error_message () {
  printf "${FG_LIGHT_RED}\n$*${FG_DEFAULT}\n"
  exit_code=1
}

main
exit "$exit_code"