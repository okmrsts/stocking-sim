import { createSweptSelfTest } from './swept-self.js';

export async function createSweptSelfClient(geometry, canonicalVertex) {
  function local() {
    return { firstContact: createSweptSelfTest(geometry, canonicalVertex), dispose() {} };
  }
  if (typeof Worker === 'undefined') return local();
  let worker;
  let waiting;
  let failure;
  try {
    worker = new Worker(new URL('./swept-self-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      const task = waiting;
      waiting = undefined;
      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data.result);
    };
    worker.onerror = error => {
      failure = new Error(error.message || 'Continuous contact worker failed.');
      const task = waiting;
      waiting = undefined;
      task?.reject(failure);
    };

    function call(message, transfer) {
      if (failure) throw failure;
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject };
        worker.postMessage(message, transfer);
      });
    }
    const index = geometry.index.array.slice(), position = geometry.attributes.position.array.slice();
    const canonical = Uint32Array.from({ length: position.length / 3 }, (_, id) => canonicalVertex(id));
    await call({ index, position, canonical }, [index.buffer, position.buffer, canonical.buffer]);
    return {
      firstContact(previous, next) {
        const a = previous.slice(), b = next.slice();
        return call({ previous: a, next: b }, [a.buffer, b.buffer]);
      },
      dispose() { worker.terminate(); },
    };
  } catch {
    worker?.terminate();
    return local();
  }
}
