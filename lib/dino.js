
export default class Dino {
  worker = null

  initialized = false
  modelReady = false
  modelReadyPromise = null
  modelReadyPromiseResolve = null
  processingPromiseResolve = null

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

  async process(imageData) {
    await this.modelReadyPromise

    this.worker.postMessage({ 
      type: 'process', 
      data: imageData 
    });

    return new Promise((resolve, reject) => {
      this.processingPromiseResolve = resolve;
    });      
  }

  onWorkerMessage(e) {
    const { type, data } = e.data;
    // console.log(`message received from worker: ${type}`)

    if (type === 'pong') {
      this.modelReady = true
      this.modelReadyPromiseResolve(data)
   
    } else if (type === 'process_result') {
      this.processingPromiseResolve(data)
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
