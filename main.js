const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

//https://github.com/jaggedsoft/node-binance-api
const Binance = require('node-binance-api');
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET
});

balances = {}


async function main() {
	await binance.useServerTime();
	let coinpair = process.argv[2]
	let coin = getCoin(coinpair);
	await getBalanceAsync();
	while (Object.keys(balances).length == 0) {
		console.log(balances);
		await sleep(100);
	}

	console.log(await getLatestPrice(coinpair));
	console.log(getBalance(coin));
}

async function getLatestPrice(coinpair) {
	let ticker = await binance.prices();
	return ticker[coinpair];
}

async function getBalanceAsync(coin) {
	binance.balance((error, b) => {
	  if ( error ) return console.error(error);
	  balances = b;
	});
}

// HELPER FUNCTIONS
function getBalance(coin) {
	return balances[coin].available
}

function getCoin(coinpair) {
	return coinpair.split("BTC").join("").split("USDT").join("")
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
} 

main();
