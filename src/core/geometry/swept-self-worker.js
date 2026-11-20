import { createSweptSelfTest } from './swept-self.js';

let test;
self.onmessage = ({ data }) => {
  try {
    if (data.index) {
      const { index, position, canonical } = data;
      test = createSweptSelfTest({ index: { array: index }, attributes: { position: { array: position } } },
        id => canonical[id]);
      self.postMessage({ result: null });
      return;
    }
    self.postMessage({ result: test(data.previous, data.next) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
