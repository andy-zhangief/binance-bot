# d3-peaks

Find peaks in an array based on "Improved peak detection" \[1\]

\[1\] Du, Pan, Warren A. Kibbe, and Simon M. Lin. "Improved peak detection in mass spectrum by incorporating continuous wavelet transform-based pattern matching." Bioinformatics 22.17 (2006): 2059-2065.

For examples, please see:
*  [Find Peaks](https://bl.ocks.org/efekarakus/cc7303456841523f37dd)
*  [Convolution](http://bl.ocks.org/efekarakus/9e5d933195dee8b4a882)
*  [Ricker Wavelet](http://bl.ocks.org/efekarakus/3c30061ef9e56c2328c6)

## Installing

If you use NPM, `npm install d3-peaks`. Otherwise, download the [latest release](https://github.com/d3/d3-peaks/releases/latest).

## API Reference

### Find Peaks

<a href="#findpeaks" name="findpeaks">#</a> d3_peaks.<b>findPeaks</b>([<i>signal</i>])

If specified, returns an array of points that represents the peaks in the signal. Otherwise, returns a function to find peaks.
An example point returned is:
```js
[{
  index: 10,
  width: 2,
  snr: 1.5
}]
```
Where <i>index</i> represents the index of the peak in the original <i>signal</i>, <i>width</i> is the width of the peak, and <i>snr</i> is the signal to noise ratio.

<a href="#findpeaks-widths" name="#findpeaks-widths">#</a> <b>widths</b>(<i>[w]</i>)

If specified, <i>[w]</i> is an array of expected peak widths that the algorithm should find. Otherwise, returns the current values.
```js
var findPeaks = d3_peaks.findPeaks().widths([1, 2, 10]);
```

<a href="#findpeaks-kernel" name="#findpeaks-kernel">#</a> <b>kernel</b>(<i>kernel</i>)

If specified, changes the kernel function or "smoother". Otherwise, returns the current value.
```js
var ricker = d3_peaks.ricker;
var findPeaks = d3_peaks.findPeaks().kernel(ricker);
```

<a href="#findpeaks-gapthreshold" name="#findpeaks-gapthreshold">#</a> <b>gapThreshold</b>(<i>gap</i>)

If specified, <i>gap</i> represents the maximum allowed number of gaps in the ridgeline. The higher is this number the more connected peaks we will find. Otherwise, returns the current value.
```js
var findPeaks = d3_peaks.findPeaks().gapThreshold(3);
```

<a href="#findpeaks-minlinelength" name="#findpeaks-minlinelength">#</a> <b>minLineLength</b>(<i>length</i>)

If specified, <i>length</i> represents the minimum ridgeline length. The higher is this number the more constrained are the lines and we will find fewer peaks. Otherwise, returns the current value.
```js
var findPeaks = d3_peaks.findPeaks().minLineLength(2);
```

<a href="#findpeaks-minsnr" name="#findpeaks-minsnr">#</a> <b>minSNR</b>(<i>snr</i>)

If specified, <i>snr</i> represents the minimum signal to noise ratio the ridge lines should have. Otherwise, returns the current value.
By default the minimum <i>snr</i> is 1.0 for peaks of width 1. This number should be higher for bigger widths.
```js
var findPeaks = d3_peaks.findPeaks().minSNR(1.5);
```

### Convolution

<a href="#convolve" name="convolve">#</a> d3_peaks.<b>convolve</b>([<i>signal</i>])

If specified, convolve the <i>signal</i> array with the smoother. Otherwise, returns a function to convolve a signal with the smoother.

<a href="#convolve-kernel" name="convolve-kernel">#</a> <b>kernel</b>(<i>kernel</i>)

If specified, changes the kernel function or "smoother". Otherwise, returns the current kernel.
```js
var convolve = d3_peaks.convolve()
                        .kernel(ricker);
var signal = convolve([1,2,3,2.5,0,1,4,5,3,-1,-2]);
```

### Kernels

<a href="#ricker" name="ricker">#</a> d3_peaks.<b>ricker</b>(<i>x</i>)

If specified , it returns φ(<i>x</i>). Otherwise, returns a function to compute the ricker wavelet with default standard deviation 1.0.

<a href="#ricker-std" name="ricker-std">#</a> <b>std</b>(<i>value</i>)

If specified, it sets the standard deviation of the curve to <i>value</i>. Otherwise, returns the "width" or standard deviation of the wavelet.

<a href="#ricker-reach" name="ricker-reach">#</a> <b>reach</b>()

Returns the range value <i>reach</i> such that φ(reach) ~ 0.

```js
var y = d3_peaks.ricker()
  .std(2);
var output = y(3.5);
var reach = y.reach();
```
