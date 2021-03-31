(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.d3_peaks = global.d3_peaks || {})));
}(this, function (exports) { 'use strict';

  /**
   * See https://en.wikipedia.org/wiki/Mexican_hat_wavelet
   */
  function ricker() {
    var σ = 1;
    
    var ricker = function(t) {
      var t2 = t*t,
          variance = σ*σ;
      
      var C = 2.0 / ( Math.sqrt(3 * σ) * (Math.pow(Math.PI, 0.25)) );
      var norm = (1.0 - (t2)/(variance));
      var gauss = Math.exp( -(t2) / (2*variance) );
      
      return C*norm*gauss;
    }
    
    ricker.std = function(_) {
      return arguments.length ? (σ = _, ricker) : σ;
    }
    
    /**
     * Range of points to sample from the wavelet. [-reach, reach]
     */
    ricker.reach = function() {
      return 5 * σ;
    }
    
    return ricker;
  };

  function convolve() {
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

  function isLocalMaxima(arr, index) {
    var current = arr[index],
        left = arr[index - 1],
        right = arr[index + 1];
        
    if (left !== undefined && right !== undefined) {
      if (current > left && current > right) { return true; }
      else if (current >= left && current > right) { return true; }
      else if (current > left && current >= right) { return true; }
    }
    else if (left !== undefined && current > left) { return true; }
    else if (right !== undefined && current > right) { return true; }
    
    return false;
  }

  /**
   * @param {arr} row in the CWT matrix.
   * @return Array of indices with relative maximas.
   */
  function maximas(arr) {
    var maximas = [];
    arr.forEach(function(value, index) {
      if (isLocalMaxima(arr, index)) maximas.push({x: index, y: value});
    });
    return maximas;
  };

  function nearestNeighbor(line, maximas, window) {
    var cache = {};
    maximas.forEach(function(d) {
      cache[d.x] = d.y;
    });
    
    var point = line.top();
    for (var i = 0; i <= window; i++) {
      var left = point.x + i;
      var right = point.x - i;
      
      if ( (left in cache) && (right in cache) ) {
        if (cache[left] > cache[right]) {
          return left;
        }
        return right;
      }
      else if (left in cache) {
        return left;
      }
      else if (right in cache) {
        return right;
      }
    }
    return null;
  }

  function percentile(arr, perc) {
    var length = arr.length;
    var index = Math.min(length - 1, Math.ceil(perc * length));
    
    arr.sort(function(a, b) { return a - b; });
    return arr[index];
  }

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

  function findPeaks() {
    var kernel = ricker,
        gapThreshold = 1,
        minLineLength = 1,
        minSNR = 1.0,
        widths = [1];
    
    var findPeaks = function(signal) {
      var M = CWT(signal);
      
      var ridgeLines = initializeRidgeLines(M);
      ridgeLines = connectRidgeLines(M, ridgeLines);
      ridgeLines = filterRidgeLines(signal, ridgeLines);
      
      return peaks(signal, ridgeLines);
    };
    
    /**
     * Smoothing function.
     */
    findPeaks.kernel = function(_) {
      return arguments.length ? (kernel = _, findPeaks) : kernel;
    }
    
    /**
     * Expected widths of the peaks.
     */
    findPeaks.widths = function(_) {
      _.sort(function(a, b) { return a - b; });
      return arguments.length ? (widths = _, findPeaks) : widths;
    }
    
    /**
     * Number of gaps that we allow in the ridge lines.
     */
    findPeaks.gapThreshold = function(_) {
      return arguments.length ? (gapThreshold = _, findPeaks) : gapThreshold;
    }
    
    /**
     * Minimum ridge line length.
     */
    findPeaks.minLineLength = function(_) {
      return arguments.length ? (minLineLength = _, findPeaks) : minLineLength;
    }
    
    /**
     * Minimum signal to noise ratio for the peaks.
     */
    findPeaks.minSNR = function(_) {
      return arguments.length ? (minSNR = _, findPeaks) : minSNR;
    }
    
    var CWT = function(signal) {
      var M = new Array(widths.length);
      widths.forEach(function(width, i) {
        var smoother = kernel()
          .std(width);
        var transform = convolve()
          .kernel(smoother);
        
        var convolution = transform(signal);
        M[i] = convolution;
      });
      return M;
    }
    
    
    var initializeRidgeLines = function(M) {
      var n = widths.length;
      var locals = maximas(M[n - 1], widths[n - 1]);
      var ridgeLines = [];
      locals.forEach(function(d) {
        var point = new Point(d.x, d.y, widths[n - 1]);
        var line = new RidgeLine();
        line.add(point);
        ridgeLines.push(line);
      });
      return ridgeLines;
    }
    
    var connectRidgeLines = function(M, ridgeLines) {
      var n = widths.length;
      for (var row = n - 2; row >= 0; row--) {
        var locals = maximas(M[row], widths[row]);
        var addedLocals = [];
        
        // Find nearest neighbor at next scale and add to the line
        ridgeLines.forEach(function(line, i) {
          var x = nearestNeighbor(line, locals, widths[row]);
          line.add(x === null ? null : new Point(x, M[row][x], widths[row]));
          
          if (x !== null) {
            addedLocals.push(x);
          }
        });
        
        // Remove lines that has exceeded the gap threshold
        ridgeLines = ridgeLines.filter(function(line) {
          return !line.isDisconnected(gapThreshold);
        });
        
        // Add all the unitialized ridge lines
        locals.forEach(function(d) {
          if (addedLocals.indexOf(d.x) !== -1) return;
          
          var point = new Point(d.x, d.y, widths[row]);
          var ridgeLine = new RidgeLine();
          ridgeLine.add(point);
          ridgeLines.push(ridgeLine);
        });
      }
      return ridgeLines;
    }
    
    var filterRidgeLines = function(signal, ridgeLines) {
      var smoother = kernel()
          .std(1.0);
      var transform = convolve()
        .kernel(smoother);
      var convolution = transform(signal);
        
      ridgeLines = ridgeLines.filter(function(line) {
        var snr = line.SNR(convolution);
        return (snr >= minSNR) && (line.length() >= minLineLength);
      });
      return ridgeLines
    }
    
    /**
     * Pick the point with the highest y value within that range.
     */
    var peaks = function(signal, ridgeLines) {
      var peaks = ridgeLines.map(function(line) {
        var points = line.points;
        var maxValue = Number.NEGATIVE_INFINITY,
            maxPoint = undefined;
        points.forEach(function(point) {
          var y = signal[point.x];
          if (y > maxValue) {
            maxPoint = point;
            maxValue = y;
          }
        });
        return maxPoint.serialize();
      });
      return peaks;
    }
    
    return findPeaks;
  };

  var version = "0.0.1";

  exports.version = version;
  exports.ricker = ricker;
  exports.convolve = convolve;
  exports.findPeaks = findPeaks;

}));