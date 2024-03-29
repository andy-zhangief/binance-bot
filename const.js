ONE_SEC = 1000;
ONE_MIN = 60 * ONE_SEC;
ONE_HOUR = 60 * ONE_MIN;
ONE_DAY = 24 * ONE_HOUR;
DEFAULT_SYMBOL_PRICE_CHECK_TIME = 10 * 1000;
GOOD_BUY_SEED_MAX = 30;
module.exports = {
	// DO NOT CHANGE THESE
	ONE_SEC : ONE_SEC,
	ONE_MIN : ONE_MIN,
	ONE_HOUR : ONE_HOUR,
	ONE_DAY : ONE_DAY,
	APPROX_LOCAL_MIN_MAX_BUFFER_PCT : 0.069420,
	MIN_COIN_VAL_IN_BTC : 0.00000150,
	TERMINAL_HEIGHT_BUFFER : 4,
	TERMINAL_WIDTH_BUFFER : 18,
	SOCKETFILE : '/tmp/binance-bot.sock',

	// BE CAREFUL USING THIS. IT WILL USE A PERCENTAGE OF THE ACCOUNT'S ENTIRE BASE CURRENCY
	PCT_BUY : 0.01, // DOES NOT WORK IF OVERRIDE_BTC OR OVERRIDE_USDT IS > 0
	TAKE_PROFIT_MULTIPLIER : 1.04, // Only change for single coinpair trading, will be unset if prepump is enabled
	STOP_LOSS_MULTIPLIER : 0.98, // Only change for single coinpair trading, will be unset if prepump is enabled
	POLL_INTERVAL : ONE_SEC,
	LOOP : true, // false for single buy and quit
	DEFAULT_BASE_CURRENCY : "USDT",
	FETCH_BALANCE_INTERVAL : 60 * ONE_MIN,
	CLIENT_DISCONNECT_SELL_TIMEOUT : 5 * ONE_MIN,

	// GRAPH SETTINGS
	SHOW_GRAPH : true,
	AUTO_ADJUST_GRAPH : true,
	GRAPH_PADDING : '0000000000', // don't ask
	GRAPH_HEIGHT : 32,
	PLOT_DATA_POINTS : 120, // Play around with this value. It can be as high as QUEUE_SIZE

	// BUY SELL SETTINGS
	BUY_SELL_STRATEGY : 7, // 3 : buy boulinger bounce, 6 is wait until min and buy bounce
	TIME_BEFORE_NEW_BUY : 5 * ONE_MIN,
	AFTER_SELL_WAIT_BEFORE_BUYING : true,
	OPPORTUNITY_EXPIRE_WINDOW : 15 * ONE_MIN,
	MIN_OPPORTUNITY_EXPIRE_WINDOW : 3 * ONE_MIN,
	MAX_OPPORTUNITY_EXPIRE_WINDOW : 15 * ONE_MIN,
	PRICE_DROP_NEW_OPPORTUNITY_MULTIPLER : 0.98,
	GOOD_BUYS_OPPORTUNITY_EXPIRE_WINDOW : 60 * ONE_MIN,
	BUY_LOCAL_MIN : true,
	BUY_INDICATOR_INC : 30 * ONE_SEC,
	SELL_INDICATOR_INC_BASE : 10 * ONE_MIN,
	SELL_INDICATOR_INC_MULTIPLIER : 1.2,
	TIME_TO_CHANGE_PROFIT_LOSS : 30 * ONE_MIN,
	TAKE_PROFIT_CHANGE_PCT : 1.0025,
	STOP_LOSS_CHANGE_PCT : 1.0025,
	PROFIT_LOSS_CHECK_TIME : 0.5 * ONE_MIN,
	SELL_RIDE_PROFITS : true,
	SELL_RIDE_PROFITS_PCT : 0.05,
	SELL_PREVENT_TRIP_STOP_LOSS : true,
	SELL_STOP_LOSS_BUFFER_TIME : ONE_MIN,
	FOLLOW_BTC_MIN_BUY_MEDIAN : 0.66,
	BUFFER_ADD : ONE_MIN,
	BUFFER_SUBTRACT: ONE_MIN,

	// ANALYSIS SETTINS
	ANALYSIS_TIME : 60, //Seconds
	ANALYSIS_BUFFER : 5,
	BUY_SELL_INC : 2,
	MIN_BUY_SELL_BUF : 10,
	MAX_BUY_SELL_BUF : 60,

	// QUEUE SETTINGS
	QUEUE_SIZE : 20 /*mins*/ * 60,
	MIN_QUEUE_SIZE : 50,
	LOOKBACK_SIZE : 10000,
	LOOKBACK_TREND_LIMIT : 500,
	MIN_TREND_STDEV_MULTIPLIER : 0.2,
	OUTLIER_STDEV_MULTIPLIER : 0.5,
	OUTLIER_INC : 5,
	BB_SELL : 10,
	BB_BUY : 20,
	UPPER_BB_PCT : 2,
	LOWER_BB_PCT : -2,
	MAX_BB_PCT : 2.2,
	MIN_BB_PCT: 1.7,

	// PRICE CHECK SETTINGS (BEFORE BUY GRAPH)
	DEFAULT_SYMBOL_PRICE_CHECK_TIME : DEFAULT_SYMBOL_PRICE_CHECK_TIME,
	SYMBOLS_PRICE_CHECK_TIME : DEFAULT_SYMBOL_PRICE_CHECK_TIME,
	PREPUMP_TAKE_PROFIT_MULTIPLIER : 1.5,
	PREPUMP_STOP_LOSS_MULTIPLIER : 0.75,
	PREPUMP_BULL_PROFIT_MULTIPLIER : 1.5,
	PREPUMP_BEAR_PROFIT_MULTIPLIER : 1,
	PREPUMP_BULL_LOSS_MULTIPLIER : 0.75,
	PREPUMP_BEAR_LOSS_MULTIPLIER : 0.5,
	PREPUMP_BULL_RALLY_TIME : 18,
	PREPUMP_BEAR_RALLY_TIME : 24,
	PREPUMP_MAX_UPPER_BB_PCT : 0.5,
	PREPUMP_MIN_UPPER_BB_PCT : 0.5,
	PREPUMP_MAX_LOWER_BB_PCT : -0.5,
	PREPUMP_MIN_LOWER_BB_PCT : -0.5,
	PREPUMP_MAX_PROFIT_MULTIPLIER : 1.1,
	PREPUMP_MIN_PROFIT_MULTIPLIER : 1.02,
	PREPUMP_MAX_LOSS_MULTIPLIER : 0.99,
	PREPUMP_MIN_LOSS_MULTIPLIER : 0.95,
	PRICES_HISTORY_LENGTH : 180, // * SYMBOLS_PRICE_CHECK_TIME
	RALLY_TIME : 22, // * SYMBOLS_PRICE_CHECK_TIME
	MIN_RALLY_TIME: 12,
	MAX_RALLY_TIME: 60,
	RALLY_MAX_DELTA : 1.04, // don't go for something thats too steep
	RALLY_MIN_DELTA : 1.015,
	FUTURES_RALLY_MAX_DELTA : 1.05,
	RALLY_GREEN_RED_RATIO : 1.5,
	GOOD_BUY_MIN_GAIN : 1.05,
	GOOD_BUY_MAX_GAIN : 1.1,
	ML_MAX_GAIN : 1.2,
	MIN_24H_BTC : 50,
	MIN_24H_USDT : 2500000,
	GOOD_BUY_SEED_MAX : GOOD_BUY_SEED_MAX,
	GOOD_BUY_SEED : Math.floor(Math.random() * GOOD_BUY_SEED_MAX),
	GOOD_BUY_PROFIT_MULTIPLIER: 1,
	GOOD_BUY_LOSS_MULTIPLIER: 0.5,
	GOOD_BUY_BUFFER_ADD: 3 * ONE_MIN,
	GOOD_BUY_BUFFER_SUBTRACT: 0 * ONE_MIN,
	REMOVE_FROM_BLACKLIST_TIMER : ONE_DAY ,
	NUMBER_OF_CLUSTERS : 5,
	NUMBER_OF_CLUSTER_ITERATIONS : 15,
	CLUSTER_SUPPORT_BUY_LEVEL: 1, // leave this at 1
	CLUSTER_RESISTANCE_SELL_LEVEL_INC: 1, // ideally this is 1 also

	// ML SETTINGS

	ML_MODEL_USDT_PATH : 'file://ml/v3/usdt/model.json',
	ML_MODEL_BTC_PATH : 'file://ml/v3/btc/model.json',

	buy_ml : true,
	ml_buy_usdt_threshold : 0.99,
	ml_buy_btc_threshold: 0.99,
	ml_model : null,

	// DONT TOUCH THESE GLOBALS
	dump_count : 0,
	latestPrice : 0,
	websocketTicker : {},
	q : [],
	lowstd : [],
	highstd : [],
	lookback : [],
	means : [],
	mabuy : [],
	masell : [],
	fetchMarketDataTime : 0,
	lastBuy : 0,
	lastSell : 0,
	supports : {},
	resistances : {},
	lastBuyReason : "",
	lastSellReason : "",
	lastSellLocalMax: 0,
	auto : false,
	histogram : false,
	detection_mode : false,
	buy_good_buys : false,
	buy_clusters : false,
	buy_rallys : false,
	buy_new_method: false,
	buy_linear_reg : false,
	last_keypress : "",
	lastTrend : "",
	lastDepth : {},
	fail_counter : 0,
	dont_buy_before : 0,
	prepump : false,
	pnl : 0,
	purchases : [],
	opportunity_expired_time : 0,
	fetch_balance_time : 0,
	prices_data_points_count : 0,
	TRANSACTION_COMPLETE : true,
	prices : [],
	prevDay : {},
	serverPrices : [],
	blacklist : [],
	candlestickCache: {},
	balances : {},
	coinInfo : null,
	coinsInfo : null,
	manual_buy : false,
	manual_sell : false,
	quit_buy : false,
	yolo : false,
	futures : false,
	silent : false,
	server : null,
	client : null,
	price_data_received : false,
	fetching_prices_from_graph_mode : false,
	coinpair : "",
	coin : "",
	follows_btc : false,
	follows_btc_history : new Array(10).fill(0.5),
	init_complete : false,
	test_and_quit : false,
}
