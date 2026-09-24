import { gaussianRandom, humanDelay } from '../src/utils/humanize.js';

console.log('Testing Gaussian Random generator (Box-Muller)...');
const samples: number[] = [];
for (let i = 0; i < 1000; i++) {
  samples.push(gaussianRandom(1000, 200, 500, 1500));
}

const min = Math.min(...samples);
const max = Math.max(...samples);
const sum = samples.reduce((a, b) => a + b, 0);
const mean = sum / samples.length;

console.log(`Samples count: ${samples.length}`);
console.log(`Min: ${min} (expected >= 500)`);
console.log(`Max: ${max} (expected <= 1500)`);
console.log(`Empirical Mean: ${mean.toFixed(2)} (expected ~1000)`);

if (min >= 500 && max <= 1500 && Math.abs(mean - 1000) < 50) {
  console.log('✔ Box-Muller Gaussian test PASSED!');
} else {
  console.error('✖ Box-Muller Gaussian test FAILED');
  process.exit(1);
}

// Test quick delay
console.log('Testing humanDelay (100-200ms)...');
const start = Date.now();
await humanDelay(100, 200);
const elapsed = Date.now() - start;
console.log(`Elapsed time: ${elapsed}ms`);
if (elapsed >= 90 && elapsed <= 250) {
  console.log('✔ humanDelay test PASSED!');
} else {
  console.error('✖ humanDelay test FAILED');
  process.exit(1);
}
