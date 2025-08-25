
import { pipeline, RawImage, matmul, env } from "@huggingface/transformers"

const MODEL_ID = "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX";
// const PATCH_SIZE = 16

export class ModelSingleton {
  static extractor;
  static modelinfo;

  static async getInstance() {
    if (!this.extractor) {
      try {
        // console.log("loading model ..")
        const extractor = await pipeline("image-feature-extraction", MODEL_ID,
        {
          "device": "webgpu",
          "dtype": "q4",
        })
        extractor.processor.image_processor.do_resize = false;
        this.modelinfo = {
          "patchSize": extractor.model.config.patch_size,
          "device": extractor.model.sessions.model.config.device,
          "dtype": extractor.model.sessions.model.config.dtype,
        }
        this.extractor = extractor 

        return extractor
      }
      catch (error) {
        throw error
      }
    }

    return null
  }
}

self.onmessage = async (e) => {
  const extractor = await ModelSingleton.getInstance();

  const { type, data } = e.data;
  console.log(`worker received message ${type}`)

  if (!extractor) {
    console.error("Pipeline fail")
    // return error
  } else if (type === 'ping') {
    self.postMessage({
      type: 'pong',
      data: ModelSingleton.modelinfo
    });      
  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
}
