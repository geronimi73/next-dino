"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, ImageIcon, Loader2, CheckCircle, AlertCircle, RotateCcw, Squirrel } from "lucide-react"
import { cn } from "@/lib/utils"

// transformer.js stuff
import { pipeline, RawImage, matmul } from "@huggingface/transformers"
const MODEL_ID = "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX";
const EXAMPLE_IMAGE_URL = "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png";

const DEFAULT_FILE = "/samples/image_05.jpg"

export default function HomePage() {

  // ui state
  const [dragActive, setDragActive] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState(null)
  const [imageReady, setImageReady] = useState(false)

  const canvasRef = useRef(null)

  // draw chosen image file onto canvas
  async function drawImageFile() {
    // load image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = URL.createObjectURL(file)
    await img.decode()

    // draw image onto canvas
    const canvas = canvasRef.current
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)

    setImageReady(true)
  }

  async function loadModel() {
    setBusy(true)
    setStatus("Loading DINO ..")

    try {
      const extractor = await pipeline("image-feature-extraction", MODEL_ID,
       {
        "device": "wasm",
        "dtype": "q4",
      });
      extractor.processor.image_processor.do_resize = false;
      const patchSize = extractor.model.config.patch_size;
      const device = extractor.model.sessions.model.config.device
      const dtype = extractor.model.sessions.model.config.dtype

      setStatus(`Model ready on device ${device} (${dtype}) patch size ${patchSize}. Select an image.`);
    } catch (error) {
      setStatus("Failed to load the model. Please refresh.");
      console.error("Model loading error:", error);
    }

    setBusy(false)
  }

  async function loadExampleImage() {
    let imageFile = await fetch(DEFAULT_FILE)
    imageFile = await imageFile.blob()
    setFile(imageFile)
  }


  useEffect(() => {
    if (file && canvasRef.current) {
      drawImageFile()
    }
  }, [file]); 

  useEffect(() => {
    if (!modelReady) {
      loadModel()
    }
  }, []); 

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
                        Choose Files
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
                    onClick={()=>{setFile(null)}}
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
