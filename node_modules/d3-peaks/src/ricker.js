/**
 * See https://en.wikipedia.org/wiki/Mexican_hat_wavelet
 */
export default function() {
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
