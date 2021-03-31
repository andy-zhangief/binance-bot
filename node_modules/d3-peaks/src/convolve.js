import ricker from "./ricker";

export default function() {
  var kernel = ricker();
  
  /**
   * y[n] = Sum_k{x[k] * h[n-k]}
   * y: output
   * x: input
   * h: smoother
   */
  var convolve = function(signal) {
    var size = signal.length,
        n = -1,
        convolution = new Array(size);
        
    while (++n < size) {
      var y = 0;
      
      var box = boundingBox(n, kernel.reach(), 0, size - 1);
      box.forEach(function(δ) {
        var k = n + δ;
        y += signal[k] * kernel(δ);
      });
      convolution[n] = y;
    }
    
    return convolution;
  };
  
  convolve.kernel = function(_) {
    return arguments.length ? (kernel = _, convolve) : kernel;
  }
  
  function range(reach) {
    reach = +reach;
    var i = -1,
        n = 2*reach + 1,
        range = new Array(n);
    while(++i < n) {
      range[i] = (-reach) + i;
    }
    return range;
  }
  
  function boundingBox(n, reach, lo, hi) {
    for (var i = 1; i <= reach; i++) {
      var left  = n - i,
          right = n + i;
      if (left >= lo && right <= hi) continue;
      return range(i - 1);
    }
    return range(reach);
  }
  
  return convolve;
};