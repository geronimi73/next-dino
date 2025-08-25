
import { pipeline, RawImage, matmul, env } from "@huggingface/transformers"

const MODEL_ID = "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX";
const DTYPE = "q4"
// const PATCH_SIZE = 16

export class ModelSingleton {
  static extractor;
  static modelinfo;

  static async getInstance() {
    if (!this.extractor) {
      try {
        // console.log("loading model ..")
        let extractor
        // try webgpu
        try {
          extractor = await pipeline(
            "image-feature-extraction", MODEL_ID,
            { "device": "webgpu", "dtype": DTYPE }
          )
        }
        catch(error) {
          // try wasm
          extractor = await pipeline(
            "image-feature-extraction", MODEL_ID,
            { "device": "wasm", "dtype": DTYPE }
          )
        }

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
        return null
      }
    }

    return this.extractor
  }
}

self.onmessage = async (e) => {
  const extractor = await ModelSingleton.getInstance();

  const { type, data } = e.data;
  // console.log(`worker received message ${type}`)

  if (!extractor) {
    console.error("Pipeline fail")
    // todo: postMessage error
  } else if (type === 'ping') {
    self.postMessage({
      type: 'pong',
      data: ModelSingleton.modelinfo
    });      
  } else if (type === 'process') {
    // convert stripped object back into RawImage
    const imageData = new RawImage(
      data.data, data.width, data.height, data.channels,
    )

    const features = await extractor(imageData);
    const numRegisterTokens = extractor.model.config.num_register_tokens ?? 0;
    const startIndex = 1 + numRegisterTokens;
    const patchFeatures = features.slice(null, [startIndex, null]);
    const normalizedFeatures = patchFeatures.normalize(2, -1);
    const scores = await matmul(normalizedFeatures, normalizedFeatures.permute(0, 2, 1));
    const similarityScores = (await scores.tolist())[0];

    self.postMessage({
      type: 'process_result',
      data: similarityScores
    });      
  } else {
    throw new Error(`Unknown message type: ${type}`);
  }
}
