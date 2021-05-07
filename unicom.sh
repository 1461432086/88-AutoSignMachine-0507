#!/bin/bash

start(){
    node index.js unicom --config default.json
}

get(){
    node index.js unicom --config default.json --tasks dailyGetGameflow,todayDailyTask
}

# See how we were called.
case "$1" in
    start)
        start
        ;;
    get)
        get
        ;;
    *)
        echo $"Usage: {start|get}"
        exit 1
esac
