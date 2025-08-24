"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, ImageIcon, Loader2, CheckCircle, AlertCircle, RotateCcw, Squirrel } from "lucide-react"
import { cn } from "@/lib/utils"

// transformer.js stuff
import { pipeline, RawImage, matmul, env } from "@huggingface/transformers"
const MODEL_ID = "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX";
const PATCH_SIZE = 16

export default function HomePage() {

  // ui state
  const [dragActive, setDragActive] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageProcessed, setImageProcessed] = useState(false)

  const offscreenCanvasRef = useRef(null)
  const canvasRef = useRef(null)
  const extractorRef = useRef(null)
  const patchSimScoresRef = useRef(null)

  // process image 
  async function processImage() {
    setBusy(true)
    setStatus("Processing image ..")

    // sleep, terrible solution to allow the UI to update
    // workaround till webworker implemented
    await new Promise(resolve => setTimeout(resolve, 200));

    const extractor = extractorRef.current

    const imageData = await RawImage.fromCanvas(canvasRef.current);
    const features = await extractor(imageData);
    const numRegisterTokens = extractor.model.config.num_register_tokens ?? 0;
    const startIndex = 1 + numRegisterTokens;
    const patchFeatures = features.slice(null, [startIndex, null]);
    const normalizedFeatures = patchFeatures.normalize(2, -1);
    const scores = await matmul(normalizedFeatures, normalizedFeatures.permute(0, 2, 1));
    const similarityScores = (await scores.tolist())[0];

    patchSimScoresRef.current = similarityScores

    setImageProcessed(true)
    setBusy(false)
    setStatus(`Done (${similarityScores.length} patches). Move around`)
  }

  // redraw canvas from offscreen canvas (=original image)
  function redrawCanvas() {
    const offscreenCanvas = offscreenCanvasRef.current
    const onscreenCanvas = canvasRef.current

    const ctx = onscreenCanvas.getContext("2d")
    ctx.drawImage(
      offscreenCanvas, 
      0, 0, offscreenCanvas.width, offscreenCanvas.height,
      0, 0, onscreenCanvas.width, onscreenCanvas.height
    )
  }

  // draw chosen image file onto canvas
  async function drawImage() {
    // load image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = URL.createObjectURL(file)
    await img.decode()

    // actual image size, but ..
    let newDim = {
      width: img.naturalWidth,
      height: img.naturalHeight,
    }

    // .. resize if > max. pixels for device
    const isMobile = /Mobi|Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    const maxPixels = isMobile ? 1048576 : 2097152;
    const currPixels = img.naturalWidth * img.naturalHeight    
    if (currPixels > maxPixels) {
      const scaleF = Math.sqrt(maxPixels / currPixels)
      newDim.width = Math.floor(scaleF * newDim.width)
      newDim.height = Math.floor(scaleF * newDim.height)

      console.log(`${img.naturalWidth}x${img.naturalHeight} image resized to ${newDim.width}x${newDim.height}`)
    } 

    // and resize to closest-lowest multiple of patch size
    newDim.width = Math.floor(newDim.width / PATCH_SIZE) * PATCH_SIZE
    newDim.height = Math.floor(newDim.height / PATCH_SIZE) * PATCH_SIZE

    // draw original image onto offscreen screnvas
    const offscreenCanvas = document.createElement('canvas');
    const offscreenCtx = offscreenCanvas.getContext("2d")
    offscreenCanvas.width = newDim.width
    offscreenCanvas.height = newDim.height
    offscreenCtx.drawImage(img, 
      0, 0, img.naturalWidth, img.naturalHeight,
      0, 0, offscreenCanvas.width, offscreenCanvas.height
    )
    offscreenCanvasRef.current = offscreenCanvas

    // setup and draw onscreen canvas
    const canvas = canvasRef.current
    canvas.width = newDim.width
    canvas.height = newDim.height
    redrawCanvas()

    setImageLoaded(true)
  }

  async function loadModel() {
    setBusy(true)
    setStatus("Loading DINO ..")

    try {
      const isWebGpuSupported = !!navigator.gpu;
      const extractor = await pipeline("image-feature-extraction", MODEL_ID,
       {
        "device": isWebGpuSupported ? "webgpu" : "wasm",
        "dtype": "q4",
      });
      extractorRef.current = extractor
      extractor.processor.image_processor.do_resize = false;
      const patchSize = extractor.model.config.patch_size;
      const device = extractor.model.sessions.model.config.device
      const dtype = extractor.model.sessions.model.config.dtype

      setStatus(`Model ready on device ${device} (${dtype}) patch size ${patchSize}. Select an image.`);
      setModelReady(true)
    } catch (error) {
      setStatus("Failed to load the model. Please refresh.");
      console.error("Model loading error:", error);
    }

    setBusy(false)
  }

  async function loadExampleImage() {
    let imageFile = await fetch("/samples/frutas2.jpg")
    imageFile = await imageFile.blob()
    setFile(imageFile)
  }

  function updateHeatmap(mousePos) {
    // draw originial image
    redrawCanvas()

    // Get onscreen canvas and ctx
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    ctx.save()

    // Get idx of hovered patch 
    const patchesPerRow = Math.ceil(canvas.width / PATCH_SIZE)
    const queryPatchIdx = Math.floor(mousePos.y / PATCH_SIZE) * patchesPerRow + Math.floor(mousePos.x / PATCH_SIZE);

    // Get scores of queryPatch vs all others, normalize scores [0, 1]
    let patchScores = patchSimScoresRef.current[queryPatchIdx]
    const minScore = Math.min(...patchScores)
    const maxScore = Math.max(...patchScores)
    patchScores = patchSimScoresRef.current[queryPatchIdx].map(value => (value - minScore) / (maxScore - minScore))

    // Overlau all patches with (1-score)% darkness
    for (let patchIdx = 0; patchIdx < patchScores.length; patchIdx++) {
      const patchScore = patchScores[patchIdx] - minScore + (1-maxScore)
      const patchCoords = {
        x: (patchIdx % patchesPerRow) * PATCH_SIZE,
        y: Math.floor(patchIdx / patchesPerRow) * PATCH_SIZE,
      }

      const darkness = (1 - patchScore) * 0.8

      ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`
      ctx.fillRect(patchCoords.x, patchCoords.y, PATCH_SIZE, PATCH_SIZE)        
    }
    ctx.restore()

  }

  function resetUI() {
    setStatus("Select an image.")
    setFile(null)
    setImageLoaded(false)
    setImageProcessed(false)
    patchSimScoresRef.current = null
  }

  // model+image ready -> process
  useEffect(() => {
    if (modelReady && imageLoaded) {
      // disable for now
      processImage()
    }
  }, [modelReady, imageLoaded]); 

  // file is read -> draw image onto canvas
  useEffect(() => {
    if (file && canvasRef.current) {
      drawImage()
    }
  }, [file]); 

  // load model on page load
  useEffect(() => {
    if (!modelReady) {
      loadModel()
    }
  }, []); 

  // attach mousemove handler to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    let animationFrameId = null

    if (!canvas || !imageProcessed) {
      return
    }

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mousePos = {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
      }

      animationFrameId = requestAnimationFrame(() => {updateHeatmap(mousePos)})
    }

    const handleMouseOut = (e) => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      redrawCanvas()
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseout', handleMouseOut)
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseout', handleMouseOut)
    }
  }, [imageProcessed]) // Re-attach when image changes

  const handleDrag = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }, [])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">DINOv3 Demo</h1>
          <p className="text-muted-foreground">Drag and drop your images or click to browse</p>
        </div>

        {/* STATUS */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-0 m-0">
            <div className="flex items-center justify-center space-x-3">
              {busy && <Loader2 className="w-5 h-5 animate-spin" />}
              <p className={cn("font-medium", "")}>
                {status}
              </p>
            </div>
          </CardContent>
        </Card>

        { !file
          // No image selected yet -> File chooser
          ? (
            <Card className="border-2 border-dashed transition-colors duration-200 hover:border-primary/50">
              <CardContent className="p-8">
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
                    dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    // multiple
                    accept="image/*"
                    onChange={handleFileInput}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />

                  <div className="space-y-4">
                    <div className="mx-auto w-12 h-12 text-muted-foreground">
                      <Upload className="w-full h-full" />
                    </div>

                    <div className="space-y-2">
                      <p className="text-lg font-medium text-foreground">Drop your images here</p>
                      <p className="text-sm text-muted-foreground">or click to browse files</p>
                    </div>

                    <div className="flex gap-2 justify-center"> 
                      <Button 
                        onClick={loadExampleImage}
                        variant="outline" 
                        className="mt-4 bg-transparent z-10"
                      >
                        <Squirrel className="w-4 h-4 mr-2" />
                        Try example
                      </Button>
                      <Button  className="mt-4">
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Display chosen image
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Your Image</h3>
                  <Button variant="outline" 
                    onClick={resetUI}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>

                <div className="border-2 border-muted rounded-lg p-4 bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto border border-muted-foreground/20 rounded"
                    style={{ maxHeight: "600px" }}
                  />
                </div>
              </CardContent>
            </Card>
          )
        }
      </div>
    </div>
  )
}
