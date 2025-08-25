
export default class Dino {
  worker = null

  initialized = false
  modelReady = false

  modelReadyPromise = null
  modelReadyPromiseResolve = null

  constructor() {
    this.onWorkerMessage = this.onWorkerMessage.bind(this)
  }

  initWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('/public/webworkers/dino.js', import.meta.url))
      this.worker.onerror = function (error) {
        console.error(error.message)
      };
    }

    if (!this.initialized) {
      this.initialized = true
      this.modelReadyPromise = new Promise((resolve, reject) => {
        this.modelReadyPromiseResolve = resolve;
      });
      this.worker.addEventListener('message', this.onWorkerMessage)
      this.worker.postMessage({ type: 'ping' });    // ping the model
    }
  }

  async waitForModelReady() {
    this.initWorker()

    return this.modelReadyPromise
  } 

  onWorkerMessage(e) {
    const { type, data } = e.data;

    if (type === 'pong') {
      this.modelReady = true
      this.modelReadyPromiseResolve(data)
   
    // } else if (type === 'segment_result') {
    }
  }

  destroy() {
    if (this.initialized) {
      this.worker.removeEventListener('message', this.onWorkerMessage)
    }
    if (this.worker) {
      this.worker.terminate()
    }
  }
}
