ONE_SEC = 1000;
ONE_MIN = 60 * ONE_SEC;
DEFAULT_SYMBOL_PRICE_CHECK_TIME = 10 * 1000;
GOOD_BUY_SEED_MAX = 60;
module.exports = {
	// DO NOT CHANGE THESE
	ONE_SEC : ONE_SEC,
	ONE_MIN : ONE_MIN,
	APPROX_LOCAL_MIN_MAX_BUFFER_PCT : 0.069420,
	MIN_COIN_VAL_IN_BTC : 0.00000200,
	TERMINAL_HEIGHT_BUFFER : 4,
	TERMINAL_WIDTH_BUFFER : 18,
	SOCKETFILE : '/tmp/binance-bot.sock',

	// BE CAREFUL USING THIS. IT WILL USE A PERCENTAGE OF THE ACCOUNT'S ENTIRE BASE CURRENCY
	PCT_BUY : 0.01, // DOES NOT WORK IF OVERRIDE_BTC OR OVERRIDE_USDT IS > 0
	TAKE_PROFIT_MULTIPLIER : 1.04, // Only change for single coinpair trading, will be unset if prepump is enabled
	STOP_LOSS_MULTIPLIER : 0.98, // Only change for single coinpair trading, will be unset if prepump is enabled
	POLL_INTERVAL : 720,// roughly 1 second
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
	GOOD_BUYS_OPPORTUNITY_EXPIRE_WINDOW : 30 * ONE_MIN,
	BUY_LOCAL_MIN : true,
	BUY_SELL_INDICATOR_INC : 30 * ONE_SEC,
	TIME_TO_CHANGE_PROFIT_LOSS : 30 * ONE_MIN,
	TAKE_PROFIT_CHANGE_PCT : 1.0025,
	STOP_LOSS_CHANGE_PCT : 1.0025,
	PROFIT_LOSS_CHECK_TIME : 0.5 * ONE_MIN,
	SELL_RIDE_PROFITS : true,
	SELL_RIDE_PROFITS_PCT : 0.99,
	FOLLOW_BTC_MIN_BUY_MEDIAN : 0.66,

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
	PREPUMP_TAKE_PROFIT_MULTIPLIER : 1,
	PREPUMP_STOP_LOSS_MULTIPLIER : 0.5,
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
	RALLY_MIN_DELTA : 1.01,
	FUTURES_RALLY_MAX_DELTA : 1.05,
	RALLY_GREEN_RED_RATIO : 1.5,
	GOOD_BUY_MIN_GAIN : 1.03,
	GOOD_BUY_MAX_GAIN : 1.08,
	MIN_48H_BTC : 100,
	MIN_48H_USDT : 5000000,
	GOOD_BUY_SEED_MAX : GOOD_BUY_SEED_MAX,
	GOOD_BUY_SEED : Math.floor(Math.random() * GOOD_BUY_SEED_MAX),

	// DONT TOUCH THESE GLOBALS
	dump_count : 0,
	latestPrice : 0,
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
	BUY_TS : 0,
	SELL_TS : 0,
	auto : false,
	histogram : false,
	detection_mode : false,
	buy_good_buys : false,
	buy_rallys : true,
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
}
