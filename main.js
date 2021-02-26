const {
	API_KEY,
	API_SECRET,
	MAX_OVERRIDE_BTC,
	MAX_OVERRIDE_USDT
} = require("./secrets.js")

const fs = require('fs');
const _ = require('lodash');
const tty = require('tty');
const asciichart = require ('asciichart');
const SocketModel = require('socket-model');
//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const readline = require('readline');

const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET,
  recvWindow: ONE_MIN
  //test: true // comment out when running for real
});

////////////////////////////// GLOBALS ///////////////////////////////

var {
	// DO NOT CHANGE THESE
	ONE_MIN,
	APPROX_LOCAL_MIN_MAX_BUFFER_PCT,
	MIN_COIN_VAL_IN_BTC,
	TERMINAL_HEIGHT_BUFFER,
	TERMINAL_WIDTH_BUFFER,
	SOCKETFILE,

	// NOT SURE WHAT I SHOULD LABEL THIS AS. TODO: CHANGE THIS LABEL
	PCT_BUY,
	TAKE_PROFIT_MULTIPLIER,
	STOP_LOSS_MULTIPLIER,
	RUNTIME,
	USE_TIMEOUT,
	POLL_INTERVAL,
	LOOP,
	DEFAULT_BASE_CURRENCY,
	FETCH_BALANCE_INTERVAL,

	// GRAPH SETTINGS
	SHOW_GRAPH,
	AUTO_ADJUST_GRAPH,
	GRAPH_PADDING,
	GRAPH_HEIGHT,
	PLOT_DATA_POINTS, 

	// BUY SELL SETTINGS
	BUY_SELL_STRATEGY,
	TIME_BEFORE_NEW_BUY,
	BUFFER_AFTER_FAIL,
	OPPORTUNITY_EXPIRE_WINDOW,
	MIN_OPPORTUNITY_EXPIRE_WINDOW,
	MAX_OPPORTUNITY_EXPIRE_WINDOW,
	BUY_LOCAL_MIN,
	BUY_INDICATOR_INC,
	TIME_TO_CHANGE_PROFIT_LOSS,
	TAKE_PROFIT_CHANGE_PCT,
	STOP_LOSS_CHANGE_PCT,
	PROFIT_LOSS_CHECK_TIME,

	// ANALYSIS SETTINS
	ANALYSIS_TIME,
	ANALYSIS_BUFFER,
	BUY_SELL_INC,
	MIN_BUY_SELL_BUF,
	MAX_BUY_SELL_BUF,

	// QUEUE SETTINGS
	QUEUE_SIZE,
	MIN_QUEUE_SIZE,
	LOOKBACK_SIZE,
	LOOKBACK_TREND_LIMIT,
	MIN_TREND_STDEV_MULTIPLIER,
	OUTLIER_STDEV_MULTIPLIER,
	OUTLIER_INC,
	BB_SELL,
	BB_BUY,

	// PRICE CHECK SETTINGS (BEFORE BUY GRAPH)
	DEFAULT_SYMBOL_PRICE_CHECK_TIME,
	SYMBOLS_PRICE_CHECK_TIME,
	PREPUMP_TAKE_PROFIT_MULTIPLIER,
	PREPUMP_STOP_LOSS_MULTIPLIER,
	PREPUMP_BULL_PROFIT_MULTIPLIER,
	PREPUMP_BEAR_PROFIT_MULTIPLIER,
	PREPUMP_BULL_LOSS_MULTIPLIER,
	PREPUMP_BEAR_LOSS_MULTIPLIER,
	PREPUMP_BULL_RALLY_TIME,
	PREPUMP_BEAR_RALLY_TIME,
	PRICES_HISTORY_LENGTH,
	RALLY_TIME,
	MIN_RALLY_TIME,
	MAX_RALLY_TIME,
	RALLY_MAX_DELTA,
	FUTURES_RALLY_MAX_DELTA,
	RALLY_MIN_DELTA,
	RALLY_GREEN_RED_RATIO,

	// DONT TOUCH THESE GLOBALS
	dump_count,
	latestPrice,
	q,
	lowstd,
	highstd,
	lookback,
	means,
	mabuy,
	masell,
	fetchMarketDataTime,
	lastBuy,
	lastSell,
	supports,
	resistances,
	lastBuyReason,
	lastSellReason,
	lastSellLocalMax,
	BUY_TS,
	SELL_TS,
	auto,
	histogram,
	detection_mode,
	last_keypress,
	lastTrend,
	lastDepth,
	fail_counter,
	dont_buy_before,
	prepump,
	pnl,
	purchases,
	opportunity_expired_time,
	fetch_balance_time,
	prices_data_points_count,
	SELL_FINISHED,
	priceFetch,
	time_elapsed_since_rally,
	prices,
	prevDay,
	serverPrices,
	blacklist,
	balances,
	coinInfo,
	manual_buy,
	manual_sell,
	quit_buy,
	yolo,
	futures,
	silent,
	server,
	client,
	price_data_received,
	fetching_prices_from_graph_mode,
	coinpair,
	coin
} = require("./const.js");

///////////////////////// INITIALIZATION ///////////////////////////////////

async function init() {
	checkValidArgs();
	if (binance.getOption("test")) {
		console.log("testing");
	}
	initArgumentVariables();
	initKeybindings();
	await binance.useServerTime();
	loopGetBalanceAndPrevDayAsync();
	if (coinpair == "PREPUMP") {
		waitUntilPrepump();
		return;
	}
	coin = getCoin(coinpair);
	baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";
	readCoinInfo();
	while (coinInfo == null) {
		await sleep(100);
	}
	pump();
}

function checkValidArgs() {
	if (!process.argv[2]
		|| !(process.argv[2].trim().toUpperCase() == "PREPUMP" 
		|| process.argv[2].toUpperCase().endsWith("USDT") 
		|| process.argv[2].toUpperCase().endsWith("BTC"))) {
		console.log("Usage: node main prepump POLL_INTERVAL_IN_SECONDS or node main YOUR_COIN_PAIR (Not recommended)");
		console.log("Optional parameters:");
		console.log("--base=BTC|USDT to select base trading currency");
		console.log("--detect to only detect rallying coins");
		console.log("--server to initialize a server. Only initialize one server at a time");
		console.log("--client to initialize a client. Clients will sync price data and blacklist with the server");
		console.log("--yolo to buy immediately after detecting a rally");
		console.log("--no-plot to skip displaying the graph on the buy/sell screen");
		console.log("--silent for no noise indicator when buying or selling");
		process.exit(1);
	}
}

function initArgumentVariables() {
	coinpair = process.argv[2].toUpperCase();
	yolo = process.argv.includes("--yolo");
	futures = process.argv.includes("--futures");
	SYMBOLS_PRICE_CHECK_TIME = !!parseFloat(process.argv[3]) ? parseFloat(process.argv[3]) * 1000 : SYMBOLS_PRICE_CHECK_TIME;
	DEFAULT_BASE_CURRENCY = process.argv.includes("--base=BTC") ? "BTC" : process.argv.includes("--base=USDT") ? "USDT" : DEFAULT_BASE_CURRENCY;
	detection_mode = process.argv.includes("--detect") ? true : false;
	SHOW_GRAPH = !process.argv.includes("--no-plot");
	silent = process.argv.includes("--silent");
	// TODO: Check if server is already started
	process.argv.includes("--server") && !process.argv.includes("--client") && initServer();
	if (server && SYMBOLS_PRICE_CHECK_TIME != DEFAULT_SYMBOL_PRICE_CHECK_TIME) {
		console.warn("Servers must have default symbol price check time. Configure this in const.js");
		SYMBOLS_PRICE_CHECK_TIME = DEFAULT_SYMBOL_PRICE_CHECK_TIME;
	}
	!process.argv.includes("--server") && process.argv.includes("--client") && initClient();
}

function initKeybindings() {
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on('keypress', (str, key) => {
		if (key.ctrl && key.name === 'c') {
			// I should write log data to file for analytics
			process.exit(0); // eslint-disable-line no-process-exit
		}
		switch (str) {
			case "a":
				// a is to toggle auto
				auto = !auto;
				break;
			case "b":
				// b is for buy
				manual_buy = true;
				break;
			case "c":
				// c is to clear blacklist
				if (server) {
					blacklist = [];
					updateBlacklistFromBalance();
				}
				break;
			case "e":
				// e to extend the opportunity window
				opportunity_expired_time += 5 * ONE_MIN;
				break;
			case "q":
				// q to quit early when looking for prepumps
				quit_buy = true;
				break;
			case "s":
				// s is for sell
				manual_sell = true;
				break;
			case "p":
				SHOW_GRAPH = !SHOW_GRAPH;
				break;
			default:
				break;
		}
	});
}

function initServer() {
	// TODO: listen for client DC message and sell coin if client is holding
	server = SocketModel.createServer( { socketFile: SOCKETFILE} );
	server.onMessage(function(obj) {
		if (obj.message) {
			message = JSON.parse(obj.message)
			if (message.blacklist) {
				if (Math.abs(message.blacklist.length - blacklist.length) == 1) {
					blacklist = message.blacklist;
				} else {
					blacklist.push(...message.blacklist);
					blacklist = _.uniq(blacklist);
				}
				synchronizeBlacklist();
			}
			
		}
	});
	server.onClientConnection((socket) => {
		server.getWriter().send(JSON.stringify({historicalPrices: prices}), socket);
	});
	server.start();
	getExchangeInfo();
}

function initClient() {
	client = SocketModel.createClient( { socketFile: SOCKETFILE } );
	client.onMessage(function(obj) {
		if (obj.message) {
			message = JSON.parse(obj.message)
			if (message.prices && message.timestamp && message.interval) {
				if (!fetchMarketDataTime || parseInt(message.timestamp) >= fetchMarketDataTime) {
					serverPrices = message.prices;
					price_data_received = true;
				}
			}
			if (message.blacklist) {
				if (!_.isEqual(message.blacklist.sort(), blacklist.sort())) {
					if (!blacklist.includes(coin) && message.blacklist.includes(coin) && auto && !SELL_FINISHED) {
						quit_buy = true;
					}
					blacklist = message.blacklist;
					console.log(`Updated Blacklist: ${blacklist}`);
					
				}
			}
			if (message.historicalPrices) {
				prices = message.historicalPrices.filter((_, i) => i % (SYMBOLS_PRICE_CHECK_TIME/DEFAULT_SYMBOL_PRICE_CHECK_TIME) == 0);
				prices_data_points_count = prices.length;
			}
		}
	});
	client.start();
}

///////////////////////////// BEFORE BUY ////////////////////////////////////////

async function waitUntilPrepump() {
	LOOP = true;
	auto = true;
	prepump = true;
	BUFFER_AFTER_FAIL = true;
	coinpair = "";

	if (futures) {
		RALLY_MAX_DELTA = FUTURES_RALLY_MAX_DELTA;
	}

	while (true) {
		await waitUntilFetchPricesAsync();
		if (!detection_mode) {
			console.clear();
			console.log(`Waiting for rallies, Data points: ${prices_data_points_count}`);
			console.log("Your Base currency is " + DEFAULT_BASE_CURRENCY);
			console.log("BTCUSDT is : " + colorText(prevDay["BTCUSDT"] > 0 ? "green" : "red", prevDay["BTCUSDT"] + "%"));
			console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}`);
			console.log(`Rally Time: ${msToTime(RALLY_TIME * SYMBOLS_PRICE_CHECK_TIME)}, Profit Multiplier: ${colorText("green", PREPUMP_TAKE_PROFIT_MULTIPLIER)}, Rally Stop Loss Multiplier: ${colorText("red", PREPUMP_STOP_LOSS_MULTIPLIER)}`);
			console.log(`Blacklist: ${blacklist}`);
			//console.log(lastSellReason);
			console.log(`You have made ${purchases.length} purchases`);
			recent_purchases = purchases.slice(-(process.stdout.rows - 9)/ 9);
			console.log(`Last ${recent_purchases.length} Purchases: ${JSON.stringify(recent_purchases, null, 4)}`);
		}
		rallies = detectCoinRallies();
		if (detection_mode) {
			rallies && rallies.length && console.log(`Rallies: ${JSON.stringify(rallies, null, 4)}`);
			continue;
		}
		if (prices_data_points_count < PRICES_HISTORY_LENGTH) {
			continue;
		}
		rally = null;
		
		while (rallies.length) {
			rally = rallies.shift();
			if (getBalance(getCoin(rally.sym)) > 0 || blacklist.includes(getCoin(rally.sym)) || coinpair == rally.sym || rally.fail) {
				rally = null;
			}
		}

		if (rally != null && Date.now() > dont_buy_before) {
			if (!yolo) {
				// This avoids the race condition if we're waiting to buy anyways
				await sleep(10000 * Math.random() + 2000);
			}
			if (getPricesForCoin(rally.sym).length < PRICES_HISTORY_LENGTH) {
				continue;
			}
			if (blacklist.includes(getCoin(rally.sym))) {
				continue;
			}
			coinpair = rally.sym;
			coin = getCoin(coinpair);
			baseCurrency = coinpair.includes("USDT") ? "USDT" : "BTC";
			SELL_FINISHED = false;
			lookback = [];
			q = [];
			blacklist.push(coin);
			synchronizeBlacklist();
			readCoinInfo();
			while (coinInfo == null) {
				await sleep(100);
			}
			opportunity_expired_time = Date.now() + OPPORTUNITY_EXPIRE_WINDOW;
			rally_inc_pct = rally.gain - 1;
			TAKE_PROFIT_MULTIPLIER = (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1;
			STOP_LOSS_MULTIPLIER = 1/((rally_inc_pct * PREPUMP_STOP_LOSS_MULTIPLIER) + 1);
			time_elapsed_since_rally = 0;
			latestPrice = rally.last;
			pump();
			while (!SELL_FINISHED) {
				await sleep(ONE_MIN * 0.5);
			}
			analyzeDecisionForPrepump(rally.sym, rally_inc_pct, time_elapsed_since_rally, purchases.slice(-1).pop(), TAKE_PROFIT_MULTIPLIER);
		}
	}
}

function detectCoinRallies() {
	lastX = prices.slice(-RALLY_TIME);
	rallies = [];
	for (const sym of Object.keys(lastX[0])) {
		green = 0;
		red = 0;
		last = lastX[0][sym];
		min = last;
		max = last;
		last_x_values = [last];
		for (i = 1; i < lastX.length; i++) {
			current = lastX[i][sym];
			if (!current) {
				break;
			}
			if (current > last) {
				green++;
			} else {
				red++;
			}
			min = Math.min(min, current);
			max = Math.max(max, current);
			last = current;
			last_x_values.push(current)
		}
		if (green + red != RALLY_TIME - 1) {
			break;
		}
		// TODO: Rethink where start/end values should be in comparison to sorted historical
		gain = max/min;
		first = lastX[0][sym];
		last = lastX[lastX.length-1][sym];
		historical_vals = getPricesForCoin(sym, PRICES_HISTORY_LENGTH).slice(0, -RALLY_TIME);
		recent_historical_vals = historical_vals.slice(-3 * RALLY_TIME, -RALLY_TIME);
		sorted_historical_vals = recent_historical_vals.sort();
		recent_sorted_historical_vals = recent_historical_vals.sort();
		max_historical = recent_sorted_historical_vals.pop();
		high_median = sorted_historical_vals.slice(-0.05 * sorted_historical_vals.length).shift();
		low_median = sorted_historical_vals.slice(0, -0.2 * sorted_historical_vals.length).pop();
		min_historical = recent_sorted_historical_vals.shift();
		is_uptrend = isUptrend(last_x_values, 1, true);
		// Testing
		test_count = 0;
		fail_reasons = ""
		if(red == 0 || green/red >= RALLY_GREEN_RED_RATIO) {
			test_count++;
		} else {
			fail_reasons += "ratio " + green/red + " ";
		}
		if (gain < RALLY_MAX_DELTA) {
			test_count++;
		} else {
			fail_reasons += "maxDelta " + gain + " ";
		}
		if (gain > RALLY_MIN_DELTA) {
			test_count++;
		} else {
			fail_reasons += "minDelta " + gain + " ";
		}
		if (last > first) {
			test_count++;
		} else {
			fail_reasons += "last<first " + last + '>' + first + " ";
		}
		if (high_median > first) {
			test_count++;
		} else {
			fail_reasons += "highMed<first " + high_median + '<' + first + " ";
		}
		if (low_median < first) {
			test_count++;
		} else {
			fail_reasons += "lowMed>first " + low_median + '>' + first + " ";
		}
		// Rethink this in particular
		if (max_historical < last) {
			test_count++;
		} else {
			fail_reasons += "highest>last " + max_historical + '>' + last + " ";
		}
		if (max_historical/min_historical < gain) {
			test_count++;
		} else {
			fail_reasons += "historicalgain>gain " + max_historical/min_historical + '>' + gain + " ";
		}
		// if (is_uptrend) {
		// 	test_count++;
		// } else {
		// 	fail_reasons += "no uptrend? ";
		// }
		if ((red == 0
			|| green/red >= RALLY_GREEN_RED_RATIO)
			&& gain < RALLY_MAX_DELTA
			&& gain > RALLY_MIN_DELTA
			&& last > first
			&& high_median > first
			&& max_historical < last
			&& max_historical/min_historical < gain
			&& low_median < first
			//&& is_uptrend
			) {
			rallies.push({
				sym: sym,
				min: min,
				max: max,
				gain: gain,
				first: first,
				last: last
			});
		} else if (test_count > 6 && detection_mode) {
			rallies.push({sym: sym, first: first, last: last, gain: gain , fail: fail_reasons});
		}
	}
	return rallies.sort((a, b) => a.gain - b.gain);
}

////////////////////////////////////// BUY ///////////////////////////////////////////////

async function pump() {
	//buy code here
	console.log("pump");
	if (BUY_LOCAL_MIN && !yolo) {
		manual_buy = false;
		quit_buy = false;
		latestPrice = await waitUntilTimeToBuy();
		manual_buy = false;
		quit_buy = false;
	} else {
		latestPrice = await getLatestPriceAsync(coinpair);
	}
	if (latestPrice == 0) {
		SELL_FINISHED = true; // never bought
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
		if (!LOOP) {
			console.log("Quitting");
			process.exit(0);
		}
		console.log("BUY WINDOW EXPIRED");
		lastBuy = 0;
		lastSell = 0;
		dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
		return;
	}
	console.log(`last price for ${coinpair} is : ${latestPrice}`);
	override = baseCurrency == "USDT" ? MAX_OVERRIDE_USDT : MAX_OVERRIDE_BTC
	let quantity = ((override > 0 ? override : PCT_BUY * getBalance(baseCurrency)) / latestPrice).toFixed(4);
	quantity = quantity - quantity % coinInfo.stepSize
	quantity = parseFloat(quantity.toPrecision(4));
	console.log(`Buying ${quantity} ${coin}`);
	binance.marketBuy(coinpair, quantity, async (error, response) => {
		if (error) {
			console.log(`PUMP ERROR: ${error.body}`);
			process.exit(1);
		}
		beep();
		console.log("pump is successful")
		console.info("Market Buy response", response);
		console.info("order id: " + response.orderId);
		BUY_TS = 0;
		buy_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		lastBuy = buy_price * response.executedQty;
		actualquantity = response.executedQty // replace with bought quantity
		ndump((buy_price * TAKE_PROFIT_MULTIPLIER).toPrecision(4), buy_price, (buy_price * STOP_LOSS_MULTIPLIER).toPrecision(4), actualquantity);
	});
}

async function waitUntilTimeToBuy() {
	//TODO: clean this up
	count = 0;
	meanRev = false;
	meanBounce = false;
	meanRevStart = 0;
	outlierReversion = 0;
	localMin = Infinity;
	localMinTicks = 0;
	ready = false;
	previousTrend = "None"
	starting_price = 0;
	buy_indicator_reached = false;
	buy_indicator_check_time = 0;
	fetching_prices_from_graph_mode = false;
	btcHistorical = getPricesForCoin("BTCUSDT", PRICES_HISTORY_LENGTH);
	follows_btc = false;
	follows_btc_history = new Array(10).fill(0.5);
	lastBTC = [];
	while (true) {
		if (prepump && !fetching_prices_from_graph_mode) {
			fetching_prices_from_graph_mode = true;
			fetchAllPricesAsyncIfReady().catch().finally(() => { 
				fetching_prices_from_graph_mode = false;
				btcHistorical = getPricesForCoin("BTCUSDT", PRICES_HISTORY_LENGTH);
				lastBTC = btcHistorical.slice(-3);
				last_btc_q_index = q.length - 1 - Math.floor(2 * SYMBOLS_PRICE_CHECK_TIME/1000);
				if ((q[last_btc_q_index] < q[q.length-1] && lastBTC[0] < lastBTC[lastBTC.length-1]) || (q[last_btc_q_index] > q[q.length-1] && lastBTC[0] > lastBTC[lastBTC.length-1])) {
					follows_btc_history.push(1);
				} else {
					follows_btc_history.push(0);
				}
				follows_btc_history.shift();
				follows_btc = average(follows_btc_history) >= 0.7;
			});
		}
		var [mean, stdev] = await tick(true);
		console.clear();
		if (manual_buy) {
			return latestPrice;
		}
		if (quit_buy) {
			return 0;
		}
		if(starting_price == 0) {
			starting_price = latestPrice;
		}
		
		meanTrend = isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO"): colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText("green", latestPrice)},${prepump ? ` Following BTC: ${follows_btc},` : ''} Buy Window: ${buy_indicator_reached ? colorText("green", msToTime(buy_indicator_check_time - Date.now())) : colorText("red", "N/A")}, Opportunity Expires: ${colorText(buy_indicator_reached ? "green" : "red", msToTime(opportunity_expired_time - Date.now()))} ${!ready ? colorText("red", "GATHERING DATA") : ""}`);
		if (Date.now() > dont_buy_before && auto) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (lookback.length < QUEUE_SIZE) {
						break; // dont buy before we populate some values first
					} 
					ready = true;
					if (latestPrice < lowstd[lowstd.length-1]) {
						if (!meanRev) {
							meanRev = true;
							meanRevStart = Date.now();
						} else if (meanRevStart < Date.now() - ONE_MIN){
							// not sure about this
							// dont_buy_before = Date.now() + 0.5 * ONE_MIN; // wait until things calm down a bit
							//meanRevStart = dont_buy_before;
						}
					}
					if (lastBuy <= lastSell 
						&& Math.abs(mean - latestPrice) < 0.2 * stdev 
						&& isDowntrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						meanBounce = true;
						meanBounceExpired = Date.now() + ONE_MIN;
					}
					if (outlierReversion > 0 && --outlierReversion > 0) {
						break;
					}
					if (lastValueIsOutlier()) {
						outlierReversion += OUTLIER_INC; // We want to buy before the outlier happens, not after
						break;
					}
					if (meanBounce && Date.now() > meanBounceExpired) {
						meanBounce = false;
					}
					if (latestPrice < highstd[highstd.length-1]
						&& latestPrice > lowstd[lowstd.length-1]
						&& meanRev
						&& isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastBuyReason = "boulingerbounce"
						return latestPrice
					}
					if (latestPrice > mean + 0.2*stdev 
						&& meanBounce 
						&& isUptrend(mabuy.slice(-BB_BUY), BB_BUY * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastBuyReason = "meanbounce"
						return latestPrice
					}
					if (latestPrice < mean - 0.5*stdev) {
						meanBounce = false;
					}
					break;
				case 6:
					if (prepump && Date.now() > opportunity_expired_time) {
						return 0;
					}
 					if (lookback.length < BB_BUY) {
						break;
					}
					if (!ready && meanTrend.includes("Up")) {
						//Leave this commented. It loses too much money
						//return latestPrice;
					}
					ready = true;
					maBuyPrice = mabuy.slice(-1).pop();
					if (previousTrend.includes("Down") && meanTrend.includes("Up") && maBuyPrice < mean) {
						// TODO: Optimize this value
						if (!follows_btc || btcHistorical.slice(-1).pop() > btcHistorical.sort().slice(-0.5 * btcHistorical.length).shift()) {
							buy_indicator_reached = true;
							buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
						}
					}
					if (buy_indicator_reached && Date.now() > buy_indicator_check_time) {
						if (maBuyPrice > mean && maBuyPrice < mean + stdev) {
							lastBuyReason = "DUMP BOUNCE";
							return latestPrice;
						} else if (meanTrend.includes("Down")) {
							buy_indicator_reached = false;
						} else {
							buy_indicator_check_time = Date.now() + BUY_INDICATOR_INC;
						}
					}
					break;
				default:
					break;
			}
		}
		if (SHOW_GRAPH) {
			plot(true);
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
}

///////////////////////// SELL ///////////////////////////////////////////////

async function ndump(take_profit, buy_price, stop_loss, quantity) {
	waiting = true;
	lastSellLocalMax = 0;
	latestPrice = await waitUntilTimeToSell(parseFloat(take_profit), parseFloat(stop_loss), parseFloat(buy_price));
	manual_sell = false;
	console.log((latestPrice > take_profit || Math.abs(1-take_profit/latestPrice) < 0.005) ? "taking profit" : "stopping loss");
	binance.marketSell(coinpair, quantity, (error, response) => {
		if (error) {
			console.log(`MARKET DUMP ERROR: ${error.body}`);
			console.log("Market sell error, please sell on Binance.com manually");
			return;
		}
		sell_price = response.fills.reduce(function(acc, fill) { return acc + fill.price * fill.qty; }, 0)/response.executedQty
		console.log("market dump is successful")
		console.info("Market sell response", response);
		console.info("order id: " + response.orderId);
		SELL_TS = 0;
		SELL_FINISHED = true;
		lastSell = sell_price * response.executedQty;
		pnl += lastSell - lastBuy;
		pnl = Math.round(pnl*10000000)/10000000;
		if (LOOP) {
			beep();
			purchases.push({
				sym: coinpair,
				buy: lastBuy,
				buyPrice: buy_price,
				sell: lastSell,
				sellPrice: sell_price,
				maxPrice: lastSellLocalMax,
				gain: lastSell/lastBuy
			});
			lastSellLocalMax = 0;
			if (BUFFER_AFTER_FAIL) {
				dont_buy_before = Date.now() + TIME_BEFORE_NEW_BUY;
			}
			if (prepump) {
				removeFromBlacklistLater(coin);
				return;
			}
			pump()
			return;
		}
		process.exit(0); // kill kill kill
	});
	return;
}

async function waitUntilTimeToSell(take_profit, stop_loss, buy_price) {
	start = Date.now();
	end = Date.now() + RUNTIME;
	count = 0;
	meanRev = false;
	meanRevStart = 0;
	outlierReversion = 0;
	previousTrend = "None";
	meanTrend = "None";
	timeBeforeSale = Date.now() + ONE_MIN; // Believe in yourself!
	stop_loss_check = 0;
	timeout_count = 0;
	mean = 0;
	stdev = 0;
	ride_profits = false;
	take_profit_check_time = 0;
	while (!auto || (latestPrice > stop_loss && latestPrice < take_profit) || ride_profits) {
		if (prepump && !fetching_prices_from_graph_mode) {
			fetching_prices_from_graph_mode = true;
			fetchAllPricesAsyncIfReady().catch().finally(() => { 
				fetching_prices_from_graph_mode = false;
			});
		}
		[mean, stdev] = await tick(false);
		console.clear();
		if (manual_sell) {
			return latestPrice;
		}
		lastSellLocalMax = Math.max(latestPrice, lastSellLocalMax);
		meanTrend = isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "down") && colorText("red", "Down") 
			: isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT) ? (lastTrend = "up") && colorText("green", "Up") 
			: "None";
		autoText = auto ? colorText("green", "AUTO") : colorText("red", "MANUAL");
		console.log(`PNL: ${colorText(pnl >= 0 ? "green" : "red", pnl)}, ${coinpair}, ${autoText}, Current: ${colorText(latestPrice > buy_price ? "green" : "red", latestPrice)} Profit: ${colorText("green", take_profit + " (" + ((take_profit/buy_price - 1) * 100).toFixed(3) + "%)")}, Buy: ${colorText("yellow", buy_price.toPrecision(4))} Stop Loss: ${colorText("red", stop_loss + " (" + ((1-stop_loss/buy_price) * -100).toFixed(3) + "%)")}`);
		if (auto && Date.now() > timeBeforeSale) {
			switch (BUY_SELL_STRATEGY) {
				case 3:
					if (latestPrice > highstd[highstd.length-1]) {
						if (!meanRev) {
							meanRev = true;
							meanRevStart = Date.now();
						} else if (meanRevStart < Date.now() - ONE_MIN){
							// This is a good thing
							// return latestPrice;
						}
					}
					if (outlierReversion > 0 && --outlierReversion > 0) {
						break;
					}
					if (lastValueIsOutlier()) {
						outlierReversion += OUTLIER_INC; // We want to buy before the outlier happens, not after
						break;
					}
					if (Math.abs(latestPrice - buy_price) < 0.3 * stdev) {
						// don't buy or sell too small amounts
						break;
					}
					if (latestPrice > mean
						&& meanRev
						&& !isUptrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastSellReason = "Sold bcuz after bb not uptrend";
						return latestPrice;
					} else if ((latestPrice < mean || Math.abs(buy_price - mean) < 0.2 * stdev)
						&& isDowntrend(masell.slice(-BB_SELL), BB_SELL * APPROX_LOCAL_MIN_MAX_BUFFER_PCT)) {
						lastSellReason = "Sold bcuz mean is down";
						return latestPrice;
					}
					break;
				case 6:
					if (Math.floor((Date.now() - start) / TIME_TO_CHANGE_PROFIT_LOSS) > timeout_count) {
						timeout_count++;
						take_profit = Math.round(take_profit * TAKE_PROFIT_CHANGE_PCT * 10000)/10000;
						stop_loss = Math.round(stop_loss * STOP_LOSS_CHANGE_PCT * 10000)/10000;
					}
					if (latestPrice > take_profit && !ride_profits) {
						ride_profits = true;
					}
					if ((ride_profits || prevDay["BTCUSDT"] < -1) && latestPrice < lastSellLocalMax * 0.99) {
						lastSellReason = "Sold bcuz price is 1% lower than max"
						return latestPrice;
					}
					// do nothing for now
					break;
				default:
					// do nothing
					break;

			}
			// This code block catches the edge case where a massive price drop happens after a steep incline once we reach take profit. 
			// This way we take the maximum profit while avoiding holding the bag if the price ever drops below take_profit
			// if (latestPrice > take_profit && !take_profit_reached) {
			// 	take_profit_reached = true;
			// 	take_profit_check_time = Date.now() + PROFIT_LOSS_CHECK_TIME;
			// } else if (take_profit_reached && Date.now() > take_profit_check_time && latestPrice < take_profit) {
			// 	return latestPrice;
			// }
			// This code is to prevent people from barely breaking your stop loss with a big sell/buy. May result in bigger losses
			// if (latestPrice < stop_loss && stop_loss_check == 0) {
			// 	stop_loss_check = Date.now() + PROFIT_LOSS_CHECK_TIME;
			// } else if (latestPrice > stop_loss) {
			// 	stop_loss_check = 0;
			// }
		}
		if (SHOW_GRAPH) {
			plot(false);
		}
		previousTrend = (meanTrend.includes("Up") || meanTrend.includes("Down")) ? meanTrend : previousTrend;
	}
	lastSellReason = "Sold bcuz take profit or stop loss hit";
	return latestPrice
}

///////////////////////// AFTER SELL //////////////////////////////////////

function analyzeDecisionForPrepump(sym, rally_inc_pct, time_elapsed, purchase, old_profit_multiplier) {
	if (!purchase || !purchase.sym ||  !purchase.sym == sym) {
		return;
	}
	return new Promise((_) => {
		setTimeout(() => {
			historical_prices = getPricesForCoin(coinpair, time_elapsed);
			max_historical = Math.max(purchase.maxPrice, ...historical_prices);
			historical_profit = max_historical/purchase.buyPrice;
			new_take_profit = Math.max(average([old_profit_multiplier, historical_profit]), 1.01);
			//TAKE_PROFIT_MULTIPLIER = (rally_inc_pct * PREPUMP_TAKE_PROFIT_MULTIPLIER) + 1;
			PREPUMP_TAKE_PROFIT_MULTIPLIER = Math.max(0.75, Math.min(3, ((new_take_profit - 1)/rally_inc_pct).toFixed(4)));
			PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_TAKE_PROFIT_MULTIPLIER/2;
			// TODO: Find index of max historical, if before or near purchase, shorten opportunity time, if after then make it longer
			RALLY_TIME = purchase.gain > 1 ? Math.max(MIN_RALLY_TIME, RALLY_TIME - 1) : Math.min(MAX_RALLY_TIME, RALLY_TIME + 1);
		}, 3 * ONE_MIN);
	});
}

/////////////////////////// HELPER FUNCTIONS DURING BUY/SELL ///////////////////////////

function initializeQs() {
	if (q.length == 0) {
		// small digits is to prevent bug in asciichart library if all values are the same
		q = new Array(QUEUE_SIZE).fill(latestPrice); // for graph visualization
		means = new Array(QUEUE_SIZE).fill(latestPrice + 0.0000000001);
		lowstd = new Array(QUEUE_SIZE).fill(latestPrice - 0.0001);
		highstd = new Array(QUEUE_SIZE).fill(latestPrice + 0.0001);
		mabuy = new Array(QUEUE_SIZE).fill(latestPrice + 0.00000001);
		masell = new Array(QUEUE_SIZE).fill(latestPrice - 0.0000001);
	}
}

async function tick(buying) {
	await sleep(POLL_INTERVAL);
	//lastDepth = await getMarketDepth(coinpair);
	bidask = await getBidAsk(coinpair);
	latestPrice = buying ? parseFloat(bidask.askPrice) : parseFloat(bidask.bidPrice); //await getLatestPriceAsync(coinpair);
	pushToLookback(latestPrice);
	initializeQs();
	BUY_TS++;
	SELL_TS++;
	q.push(latestPrice);
	stdev = getStandardDeviation(q.slice(-lookback.length));
	mean = average(q.slice(-lookback.length));
	means.push(mean);
	lowstd.push(mean - 2*stdev);
	highstd.push(mean + 2*stdev);
	mabuy.push(average(lookback.slice(-BB_BUY)));
	masell.push(average(lookback.slice(-BB_SELL)));
	q.shift() != 0 && lowstd.shift() != 0 && highstd.shift() != 0 && means.shift() != 0 && mabuy.shift() != 0 && masell.shift() != 0;
	return [mean, stdev]
}

function pushToLookback(latestPrice) {
	lookback.push(latestPrice);
	if (lookback.length > LOOKBACK_SIZE) {
		lookback.shift();
	}
}

function isUptrend(q2, buffer = 0, kinda = true, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v > q2[q2.length-1]).length < buffer
		&& q2.slice(1-q2.length).filter(v => v < q2[0]).length < buffer * (kinda ? 3 : 1)
		&& q2[q2.length-1] - q2[0] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

function isDowntrend(q2, buffer = 0, kinda = true, stdev = 0) {
	// if (stdev == 0) {
	// 	stdev = getLastStdev();
	// }
	return q2.slice(0, q2.length-1).filter(v => v < q2[q2.length-1]).length <= buffer
		&& q2.slice(1-q2.length).filter(v => v > q2[0]).length <= buffer * (kinda ? 3 : 1)
		&& q2[0] - q2[q2.length-1] > MIN_TREND_STDEV_MULTIPLIER * stdev;
}

////////////////////// BALANCE AND BLACKLISTS AND EXCHANGE STUFF //////////////////////////////////////
async function waitUntilFetchPricesAsync() {
	while(Date.now() < fetchMarketDataTime) {
		await sleep(100);
	}
	if (!client) {
		await fetchAllPricesAsync();
	} else {
		while (!price_data_received) {
			await sleep(100);
		}
		price_data_received = false;
	}
	if (server) {
		server.broadcast(JSON.stringify({prices: serverPrices, timestamp: Date.now(), interval: SYMBOLS_PRICE_CHECK_TIME}));
	}
	parseServerPrices();
	++prices_data_points_count;
	++time_elapsed_since_rally;
	fetchMarketDataTime = Date.now() + SYMBOLS_PRICE_CHECK_TIME;
	if (client) {
		fetchMarketDataTime -= 1000;
	}
}

function parseServerPrices() {
	while (prices.length >= PRICES_HISTORY_LENGTH) {
		prices.shift();
	}
	newPrices = {};
	serverPrices.forEach(v => {
		if (!v || !v.symbol || !v.symbol.endsWith(DEFAULT_BASE_CURRENCY)) {
			return;
		}
		if (v.symbol.endsWith("BTC") && v.askPrice < MIN_COIN_VAL_IN_BTC) {
			return;
		}
		if (!detection_mode) {
			if (!futures && (v.symbol.includes("DOWNUSDT") || v.symbol.includes("UPUSDT"))) {
				return;
			}
			if (futures && !v.symbol.includes("DOWNUSDT") && !v.symbol.includes("UPUSDT")) {
				return;
			}
		}
		newPrices[v.symbol] = v.askPrice;
	});
	prices.push(newPrices);
}

function getPricesForCoin(sym, timeframe) {
	recent_prices = prices.slice(-timeframe);
	res = [];
	for (i = 0; i < recent_prices.length; i++) {
		res.push(parseFloat(recent_prices[i][sym]));
	}
	return res.filter(a => a);
}

async function fetchAllPricesAsyncIfReady() {
	return new Promise(async (resolve) => {
		await waitUntilFetchPricesAsync();
		resolve();
	});
}

async function fetchAllPricesAsync() {
	priceFetch = 0;
	await getAllPrices();
	while (priceFetch < 1) {
		await sleep(100);
	}
}

async function getAllPrices() {
	binance.bookTickers((error, ticker) => {
		if (error) {
			while (++fail_counter >= 100) {
				console.log("TOO MANY FAILS GETTING PRICES");
				process.exit(1);
			}
			return;
		}
		fail_counter = 0;
		priceFetch++;
		serverPrices = ticker;
	});
}

async function getPrevDay() {
	binance.prevDay(false, (error, pd) => {
		if (error || !pd) {
			// TODO: Better error handling
			return;
		}
  	// console.info(prevDay); // view all data
		for ( let obj of pd ) {
		    let symbol = obj.symbol;
		    prevDay[symbol] = obj.priceChangePercent;
		}
		setMultiplersFromPreviousDayBTCPrices();
	});
}

function setMultiplersFromPreviousDayBTCPrices() {
	if (prevDay['BTCUSDT']) {
		prevDayBTC = prevDay['BTCUSDT'];
		if (parseFloat(prevDayBTC) > 0) {
			if (PREPUMP_TAKE_PROFIT_MULTIPLIER == PREPUMP_BEAR_PROFIT_MULTIPLIER) {
				PREPUMP_TAKE_PROFIT_MULTIPLIER = PREPUMP_BULL_PROFIT_MULTIPLIER;
			}
			if (PREPUMP_STOP_LOSS_MULTIPLIER == PREPUMP_BEAR_LOSS_MULTIPLIER) {
				PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_BULL_LOSS_MULTIPLIER;
			}
			if (RALLY_TIME == PREPUMP_BEAR_RALLY_TIME) {
				RALLY_TIME = PREPUMP_BULL_RALLY_TIME;
			}
		} else {
			if (PREPUMP_TAKE_PROFIT_MULTIPLIER == PREPUMP_BULL_PROFIT_MULTIPLIER) {
				PREPUMP_TAKE_PROFIT_MULTIPLIER = PREPUMP_BEAR_PROFIT_MULTIPLIER;
			}
			if (PREPUMP_STOP_LOSS_MULTIPLIER == PREPUMP_BULL_LOSS_MULTIPLIER) {
				PREPUMP_STOP_LOSS_MULTIPLIER = PREPUMP_BEAR_LOSS_MULTIPLIER;
			}
			if (RALLY_TIME == PREPUMP_BULL_RALLY_TIME) {
				RALLY_TIME = PREPUMP_BEAR_RALLY_TIME;
			}
		}
	}
}

// DEPRECATED
async function getLatestPriceAsync(coinpair) {
	try {
		let ticker = await binance.prices(coinpair);
		fail_counter = 0;
		return ticker[coinpair];
	} catch (e) {
		if (++fail_counter >= 100) {
			console.log(`Too many fails fetching price of ${coinpair}, exiting`);
			process.exit(1);
		}
		await sleep(100);
		return await getLatestPriceAsync(coinpair);
	}
}

async function getBidAsk(coinpair) {
	try {
		bidask = await binance.bookTickers(coinpair);
		fail_counter = 0;
		return bidask
	} catch (e) {
		console.log(e);
		if (++fail_counter >= 100) {
			console.log(`Too many fails fetching bid/ask prices of ${coinpair}, exiting`);
			process.exit(1);
		}
		return await getBidAsk(coinpair);
	}
}

//TODO: reimplement this + the related functions, fail_counter was set to 1.
async function getMarketDepth(coinpair) {
	try {
		depth = await binance.depth(coinpair);
		parseDepth(depth);
		fail_counter = 0;
		return depth;
	} catch (e) {
		if (++fail_counter >= 100) {
			console.log(e);
			console.log(`Too many fails fetching market depth of ${coinpair},`);
			process.exit(1);
		}
		return await getMarketDepth(coinpair);
	}
	
}

function parseDepth(depth) {
	resistances = {};
	supports = {};
	Object.entries(depth.bids).forEach(([k,v], count) => {
		price = parseFloat(parseFloat(k).toPrecision(4));
		supports[price] = (supports[price] == null ? 0 : supports[price]) + v
	});
	Object.entries(depth.asks).forEach(([k,v], count) => {
		price = parseFloat(parseFloat(k).toPrecision(4));
		resistances[price] = (resistances[price] == null ? 0 : resistances[price]) + v
	});
}

// this never resolves
async function loopGetBalanceAndPrevDayAsync() {
	return new Promise(async (resolve) => {
		while (true) {
			while (Date.now() < fetch_balance_time) {
				await sleep(ONE_MIN);
			}
			getPrevDay();
			fetching_balance = true;
			binance.balance((error, b) => {
				if ( error ) {
					fetching_balance = false;
					fetch_balance_time = Date.now() + ONE_MIN;
					console.log(error);
					return;
				}
				balances = b;
				updateBlacklistFromBalance();
				fetching_balance = false;
				fetch_balance_time = Date.now() + FETCH_BALANCE_INTERVAL;
			});
			while (fetching_balance) {
				await sleep(ONE_MIN);
			}
		}
		
	});
}

function updateBlacklistFromBalance() {
	Object.keys(balances).forEach(key => {
		if (key != "USDT" && parseFloat(balances[key].available) > 0 && !blacklist.includes(key)) {
			blacklist.push(key)
		}
	});
	if (server) {
		synchronizeBlacklist();
	}
}

function removeFromBlacklistLater(coin) {
	setTimeout(() => {
		blacklist = blacklist.filter(i => i !== coin);
		synchronizeBlacklist();
	}, 5 * ONE_MIN);
}

function synchronizeBlacklist() {
	if (server) {
		server.broadcast(JSON.stringify({blacklist: blacklist}));
	}
	if (client) {
		client.send(JSON.stringify({blacklist: blacklist}));
	}
}


function getBalance(coin) {
	if (!balances[coin]) {
		return 0;
	}
	return balances[coin].available
}

function getCoin(coinpair) {
	if (coinpair.endsWith("USDT")) {
		return coinpair.slice(0,-4);
	}
	// assume BTC
	return coinpair.slice(0, -3);
}

function readCoinInfo() {
	fs.readFile("minimums.json", function(err, data){
		if (err) {
			getExchangeInfo();
			console.log("minimums.json read error, fetching data");
			return;
		}
		coinInfo = JSON.parse(data)[coinpair]
		if (coinInfo != null) {
			console.log(coinInfo);
		}
	});
}

async function getExchangeInfo() {
	await binance.exchangeInfo(function(error, data) {
		let minimums = {};
		for ( let obj of data.symbols ) {
			let filters = {status: obj.status};
			for ( let filter of obj.filters ) {
				if ( filter.filterType == "MIN_NOTIONAL" ) {
					filters.minNotional = filter.minNotional;
				} else if ( filter.filterType == "PRICE_FILTER" ) {
					filters.minPrice = filter.minPrice;
					filters.maxPrice = filter.maxPrice;
					filters.tickSize = filter.tickSize;
				} else if ( filter.filterType == "LOT_SIZE" ) {
					filters.stepSize = filter.stepSize;
					filters.minQty = filter.minQty;
					filters.maxQty = filter.maxQty;
				}
			}
			//filters.baseAssetPrecision = obj.baseAssetPrecision;
			//filters.quoteAssetPrecision = obj.quoteAssetPrecision;
			filters.orderTypes = obj.orderTypes;
			filters.icebergAllowed = obj.icebergAllowed;
			minimums[obj.symbol] = filters;
		}
		fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), function(err){});
	});
}

/////////////////////////////// MATH /////////////////////////////////////////////////

function lastValueIsOutlier() {
	stdev = getLastStdev();
	value = q[q.length-1];
	previous = average(q.slice(-5, -2));
	return (Math.abs(value - previous) >= OUTLIER_STDEV_MULTIPLIER*stdev); // I have no idea why, but I'm using 0.5 stdev to determine if val is outlier
}

function getLastStdev() {
	return (highstd[highstd.length-1] - means[means.length-1])/2;
}

function getStandardDeviation(values){
  var avg = average(values);
  
  var squareDiffs = values.map(function(value){
    var diff = value - avg;
    var sqrDiff = diff * diff;
    return sqrDiff;
  });
  
  var avgSquareDiff = average(squareDiffs);

  var stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

function average(data){
  var sum = data.reduce(function(sum, value){
    return sum + parseFloat(value);
  }, 0);

  var avg = sum / data.length;
  return avg;
}

/////////////////////////////// GRAPHING /////////////////////////////////////////////////

function formatGraph(x, i) {
	return ("" + x + GRAPH_PADDING).slice (0, GRAPH_PADDING.length);
}

function plot(buying) {
	if (AUTO_ADJUST_GRAPH) {
		GRAPH_HEIGHT = process.stdout.rows - TERMINAL_HEIGHT_BUFFER;
		PLOT_DATA_POINTS = process.stdout.columns - TERMINAL_WIDTH_BUFFER;
	}
	num_points_to_plot = Math.min(lookback.length + 1, PLOT_DATA_POINTS);
	if (GRAPH_HEIGHT < 5 || num_points_to_plot < 5) {
		return;
	}
	points = [highstd.slice(-num_points_to_plot), lowstd.slice(-num_points_to_plot), means.slice(-num_points_to_plot), (buying ? mabuy : masell).slice(-num_points_to_plot), q.slice(-num_points_to_plot)];
	console.log (
	asciichart.plot(points, 
	{
		format: formatGraph, 
		colors: [
	        asciichart.red,
	        asciichart.green,
	        asciichart.yellow,
	        asciichart.lightmagenta,
	        asciichart.default,
	    ],
		padding: GRAPH_PADDING, 
		height: GRAPH_HEIGHT
	}));
}

function getHistogramData() {
	histogramRed = Object.values(resistances);
	histogramGreen = Object.values(supports).reverse();
	firstRed = histogramRed[0];
	firstGreen = histogramGreen[histogramGreen.length-1];
	histogramRed = (histogramRed.map(x => [x,x])).flat();
	histogramGreen = (histogramGreen.map(x => [x,x])).flat();
	blankGreen = new Array(parseInt(PLOT_DATA_POINTS/5)).fill(0);
	blankRed = new Array(parseInt(PLOT_DATA_POINTS/5 + histogramGreen.length)).fill(0);
	return [blankGreen.concat(histogramGreen), blankRed.concat(histogramRed), firstGreen, firstRed];
}

/////////////////////////////// MISC /////////////////////////////////////////////////

function colorText(color, str) {
	return asciichart[color] + str + asciichart.reset;
}

function msToTime(duration) {
	if (duration < 0) {
		return 0;
	}
	var seconds = Math.floor((duration / 1000) % 60), minutes = Math.floor((duration / (1000 * 60))),
	seconds = (seconds < 10) ? "0" + seconds : seconds;
	return minutes + ":" + seconds;
}

function beep() {
	if (!silent) {
		console.log("\007");
	}
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
} 

init();
