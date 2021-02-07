#!/usr/bin/env python3
import sys
from binance.client import Client
from binance.exceptions import BinanceAPIException, BinanceOrderException


api_key = ""
api_secret = ""
client = Client (api_key, api_secret)

#client.API_URL = 'https://testnet.binance.vision/api'

MAX_SPEND = 0.01
PCT_GAINS = 1.5
STOP_LOSS_MULITPLIER = 0.9
COIN2 = "BTC"

ticker = "UNDEFINED"
#advanced stratgies
# use 50% capital to buy at market
# use remainig to set buy limit at 25% below market price
#     cancel buy limit after 15s
# set sell order 50% at 50% higher than market

#helper functions

def entryPoint ():
    coin1 = sys.argv[1].upper()
    global ticker
    ticker = coin1 + COIN2 
    buy_order = yoloBuy()
    sell_order = yoloSell (buy_order)

    printStats (ticker = ticker, buy_order = buy_order, sell_order = sell_order)

def printAcct():
    import pprint
    pp = pprint.PrettyPrinter(indent=2, compact=True)
    pp.pprint(client.get_account())

def printStats(ticker, buy_order, sell_order):
    from datetime import datetime
    print (ticker)
    print (buy_order)
    print (sell_order)

    print ("buy time :")
    print ( datetime.fromtimestamp(buy_order["transactTime"]/1000))
    print ("sell time :")
    print ( datetime.fromtimestamp(sell_order["transactTime"]/1000))

def printTime ():
    from datetime import datetime
    print (datetime.fromtimestamp(client.get_server_time()["serverTime"]/1000))

def findPrecision (str_val):
    #finds the precision from given string
    str_len = len (str_val)
    counter = 1
    for c in str_val:
        if c == ".": break
        counter+=1
    return (str_len - counter)
def sellHigh(order):
    #OCO sell
    #stoploss orders not supported by testnet. TODO: TEST LIVE.
    global ticker
    cost_tot = order["cummulativeQuoteQty"]
    num_coins = order["executedQty"]
    precision_len = findPrecision(order["fills"][0]["price"])

    sell_price = 1.*(float(cost_tot)/float(num_coins))*PCT_GAINS
    stop_loss = 1.*(float(cost_tot)/float(num_coins))*STOP_LOSS_MULITPLIER #big sad
    f_sell_price = format(sell_price, '.10f')
    f_stop_loss = format (stop_loss, '.10f')
    #convert sell_price to decimal string (TODO: kinda janky)

    str_sell_price = str(f_sell_price)[0:precision_len]
    str_stop_loss = str(f_stop_loss)[0:precision_len]

    print (str_sell_price)
    print (str_stop_loss)

    try:
        sell_order = client.order_oco_sell(symbol = ticker, quantity = num_coins, price = str_sell_price, stopPrice = str_stop_loss, stopLimitPrice = str_stop_loss, )
        return sell_order
    except BinanceAPIException as e:
        print (e)
    except BinanceOrderException as e:
        print (e)

def yoloSell (order):
    #limit sell
    global ticker
    cost_tot = order["cummulativeQuoteQty"]
    num_coins = order["executedQty"]
    precision_len = findPrecision(order["fills"][0]["price"])
    sell_price = 1.*(float(cost_tot)/float(num_coins))*PCT_GAINS

    #convert sell_price to decimal string (TODO: kinda janky)
    f_sell_price = format(sell_price, '.10f')
    str_sell_price = str(f_sell_price)[0:precision_len]

    try:
        sell_order = client.order_limit_sell(symbol = ticker, quantity = num_coins, price = str_sell_price)
        return sell_order
    except BinanceAPIException as e:
        print (e)
    except BinanceOrderException as e:
        print (e)
    
def buyLow (buy_lim = 0):
    #creates buy limit based on current price * multiplier
    return 0

def yoloBuy ():
    global ticker
    buy_order = client.order_market_buy (symbol = ticker, quoteOrderQty = MAX_SPEND)
    # buy_order = client.create_order(
    #     symbol = ticker,
    #     side = "BUY",
    #     type = "MARKET",
    #     quoteOrderQty = BTC_CAP)
    return buy_order

entryPoint()