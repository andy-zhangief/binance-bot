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
export function maximas(arr) {
  var maximas = [];
  arr.forEach(function(value, index) {
    if (isLocalMaxima(arr, index)) maximas.push({x: index, y: value});
  });
  return maximas;
};

export function nearestNeighbor(line, maximas, window) {
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

export function percentile(arr, perc) {
  var length = arr.length;
  var index = Math.min(length - 1, Math.ceil(perc * length));
  
  arr.sort(function(a, b) { return a - b; });
  return arr[index];
}
