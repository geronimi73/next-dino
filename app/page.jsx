"use client"

import { useState, useCallback, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, X, ImageIcon, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// transformer.js stuff
import { pipeline, RawImage, matmul } from "@huggingface/transformers"
const MODEL_ID = "onnx-community/dinov3-vits16-pretrain-lvd1689m-ONNX";
const EXAMPLE_IMAGE_URL = "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/cats.png";


export default function HomePage() {
  const [files, setFiles] = useState([])

  // ui state
  const [dragActive, setDragActive] = useState(false)
  const [modelReady, setModelReady] = useState(false)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function processFile(imageFile) {
    const blob = new Blob([imageFile], { type: imageFile.type });
    // do something ..
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

  useEffect(() => {
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [files]); 

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
      const newFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))
      setFiles((prev) => [...prev, ...newFiles])
    }
  }, [])

  const handleFileInput = useCallback((e) => {
    if (e.target.files && e.target.files[0]) {
      const newFiles = Array.from(e.target.files).filter((file) => file.type.startsWith("image/"))
      setFiles((prev) => [...prev, ...newFiles])
    }
  }, [])

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Image Upload</h1>
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

                <Button variant="outline" className="mt-4 bg-transparent">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Files
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
