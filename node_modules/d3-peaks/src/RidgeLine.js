function RidgeLine() {
  this.points = [];
  this.gap = 0;
}

/**
 * If the point is valid append it to the ridgeline, and reset the gap.
 * Otherwise, increment the gap and do nothing.
 * 
 * @param {point} Point object.
 */
RidgeLine.prototype.add = function(point) {
  if (point === null || point === undefined) {
    this.gap += 1;
    return;
  } else {
    this.points.push(point);
    this.gap = 0;
  }
}

/**
 * @return {Point} Last point added into the ridgeline.
 */
RidgeLine.prototype.top = function() {
  return this.points[this.points.length - 1];
}

/**
 * @return {number} Length of points on the ridgeline.
 */
RidgeLine.prototype.length = function() {
  return this.points.length;
}

/**
 * @return {boolean} True if the gap in the line is above a threshold. False otherwise.
 */
RidgeLine.prototype.isDisconnected = function (threshold) {
  return this.gap > threshold;
}

/**
 * @param {Array} Smallest scale in the convolution matrix
 */
RidgeLine.prototype.SNR = function(conv) {
  var maxSnr = Number.NEGATIVE_INFINITY;
  this.points.forEach(function(point) {
    var snr = point.SNR(conv);
    if (snr > maxSnr) maxSnr = snr;
  });
  return maxSnr;
}

export default RidgeLine;