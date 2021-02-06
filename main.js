const {
	API_KEY,
	API_SECRET
} = require("./secrets.js")

const Binance = require('node-binance-api');
const binance = new Binance().options({
  APIKEY: API_KEY,
  APISECRET: API_SECRET
});


async function main() {
	coin = process.argv[2]
	let ticker = await binance.prices();
	console.info(`Price of ${coin}: ${ticker[coin]}`);
}

main();
