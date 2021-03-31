import {percentile} from "./search";

function Point(x, y, width) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.snr = undefined;
}

Point.prototype.SNR = function(conv) {
  var smoothingFactor = 0.00001;
  var signal = this.y;
  
  var lowerBound = Math.max(0, this.x - this.width);
  var upperBound = Math.min(conv.length, this.x + this.width + 1);
  var neighbors = conv.slice(lowerBound, upperBound);
  var noise = percentile(neighbors, 0.95);
  
  signal += smoothingFactor;
  noise += smoothingFactor;
  this.snr = signal/noise;
  return this.snr;
}

Point.prototype.serialize = function() {
  return {index: this.x, width: this.width, snr: this.snr};
}

export default Point;