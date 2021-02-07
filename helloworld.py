#!/usr/bin/env python3

import pprint
import sys
from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException
import time
from datetime import datetime


api_key = ""
api_secret = ""
client = Client (api_key, api_secret)

client.API_URL = 'https://testnet.binance.vision/api'

BTC_CAP = 0.025
PCT_GAINS = 1.5
STOP_LOSS_MULITPLIER = 0.9


#advanced stratgies
# use 50% capital to buy at market
# use remainig to set buy limit at 25% below market price
#     cancel buy limit after 15s
# set sell order 50% at 50% higher than market

#helper functions
def sellAtProfit(order):
    ticker = order["symbol"]
    cost_tot = order["cummulativeQuoteQty"]
    num_coins = order["executedQty"]
    precision_len = len(order["fills"][0]["price"])
    sell_price = 1.*(float(cost_tot)/float(num_coins))*PCT_GAINS
    str_sell_price = str(sell_price)[0:precision_len]
    try:
        sell_order = client.order_limit_sell(symbol = ticker, quantity = num_coins, price = str_sell_price)
        return sell_order
    except BinanceAPIException as e:
        print (e)
    except BinanceOrderException as e:
        print (e)

server_time1 = client.get_server_time()
server_time2 = client.get_server_time()
coin = sys.argv[1].upper()
ticker = coin+ "BTC" #or USDT


#first get coin @ market price
buy_order = client.order_market_buy (symbol = ticker, quoteOrderQty = BTC_CAP)
#order = client.order_limit_buy (symbol = ticker, quantity = 1, price = 0.00231)
#time.sleep (1.0)
sell_order = sellAtProfit (buy_order)

#order = client.order_limit_sell (symbol = ticker, quantity = 10, price = 0.00231 )

print (buy_order)
print (sell_order)

print (datetime.fromtimestamp (server_time1["serverTime"]/1000))
print (datetime.fromtimestamp (server_time2["serverTime"]/1000))
print (datetime.fromtimestamp (buy_order["transactTime"]/1000))
print (datetime.fromtimestamp (sell_order["transactTime"]/1000))

#pp = pprint.PrettyPrinter(indent=2, compact=True)
#pp.pprint(client.get_account())
