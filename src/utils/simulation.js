'use strict';

/**
 * src/utils/simulation.js
 * 
 * Shared utilities for simulating real-world conditions in our mocks.
 */

/**
 * Simple delay helper.
 * @param {number} ms 
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulates network round-trip time.
 * @param {number} ms 
 */
async function simulateNetwork(ms) {
  return sleep(ms);
}

/**
 * Simulates database query latency.
 * @param {number} ms 
 */
async function simulateDbLatency(ms) {
  return sleep(ms);
}

module.exports = { sleep, simulateNetwork, simulateDbLatency };
