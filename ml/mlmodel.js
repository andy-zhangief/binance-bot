/**
 * @class MLModel
 *
 * @author: darryl.west@roundpeg.com
 * @created: 6/21/14 7:28 PM
 */

const tf = require('@tensorflow/tfjs-node');

const MLModel = function(options) {
	'use strict';

	const model = this;
	const path = options.path;
	const threshold = options.threshold;
	let tfmodel = null;

	this.makeBatchPredictions = function(data) {
		data.forEach(d => {
			d.highs = model.normalizeArray(d.highs);
			d.lows = model.normalizeArray(d.lows);
			d.gains = model.normalizeArray(d.gains);
			d.volumes = model.normalizeArray(d.volumes);
		});
		let predictionData = [];
		for (let x = 0; x < data.length; x++) {
			let testcase = data[x];
			let t2 = [];
			for (let i = 0; i < 48; i++) {
				t2.push([testcase.highs[i], testcase.lows[i], testcase.volumes[i], testcase.gains[i]])
			}
			predictionData.push(t2);
		}
		tf.tidy(() => {
			let predictionTensor = tf.tensor3d(predictionData);
			let predictions = tfmodel.predict(predictionTensor).dataSync().slice();
			for (let i = 0; i < data.length; i++) {
				data[i].prediction = predictions[i * 2];
			}
		});
		return data.filter(d => d.prediction > threshold);
	};

	this.normalizeArray = function(data) {
		let maxVal = Math.max(...data);
		let minVal = Math.min(...data);
		return data.map(x => maxVal == minVal ? 0 : (x-minVal)/(maxVal-minVal));
	};

	this.cleanMemory = function() {
		tf.disposeVariables();
	};

	this.loadModelFromFile = async function () {
		tfmodel = await tf.loadLayersModel(path);
	};

}

module.exports = MLModel;