#!/bin/bash
args=("$@")
if [ "${args[1]}" = "BTC" ]; then base="BTC"; else base="USDT"; fi
echo "BASE CURRENCY IS ${base}"
screen -dmS server
screen -S server -X exec node main prepump --server
for (( c=1; c<=$((args[0]+0)); c++ ))
do
	sleep 5 
	client="c${c}"
	screen -dmS ${client}
	screen -S ${client} -X exec node main prepump --client --ml --base=${base} ${client}
done
