'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import jsQR from 'jsqr'

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>
}

async function getCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    { video: true, audio: false },
  ]

  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch {
      // Try the next camera constraint fallback.
    }
  }

  throw new Error('Unable to access camera stream')
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup()
      reject(new Error('Camera preview did not become ready'))
    }, 5000)

    const onLoadedData = () => {
      cleanup()
      resolve()
    }

    const cleanup = () => {
      window.clearTimeout(timeoutId)
      video.removeEventListener('loadeddata', onLoadedData)
    }

    video.addEventListener('loadeddata', onLoadedData)
  })
}

async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null
): Promise<HTMLVideoElement> {
  for (let i = 0; i < 20; i += 1) {
    const video = getVideo()
    if (video) {
      return video
    }

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50)
    })
  }

  throw new Error('Video element was not mounted in time')
}

export default function Home() {
  const router = useRouter()
  const [empOldID, setEmpOldID] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const redirectToEmployeePage = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) {
        return
      }

      router.push(`/view/${encodeURIComponent(trimmed)}`)
    },
    [router]
  )

  const stopScanner = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setScanning(false)
  }, [])

  const startScanner = useCallback(async () => {
    try {
      setScanError(null)

      const DetectorCtor = (window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
      }).BarcodeDetector
      const detector = DetectorCtor ? new DetectorCtor({ formats: ['qr_code'] }) : null

      const stream = await getCameraStream()

      streamRef.current = stream
      setScanning(true)

      const video = await waitForVideoElement(() => videoRef.current)
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      await video.play()
      await waitForVideoReady(video)

      const scanLoop = async () => {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(() => {
            void scanLoop()
          })
          return
        }

        try {
          let firstValue: string | undefined

          if (detector) {
            const results = await detector.detect(video)
            firstValue = results[0]?.rawValue?.trim()
          } else if (canvas) {
            const width = video.videoWidth
            const height = video.videoHeight

            if (width > 0 && height > 0) {
              canvas.width = width
              canvas.height = height
              const context = canvas.getContext('2d', { willReadFrequently: true })
              if (context) {
                context.drawImage(video, 0, 0, width, height)
                const imageData = context.getImageData(0, 0, width, height)
                const decoded = jsQR(imageData.data, width, height)
                firstValue = decoded?.data?.trim()
              }
            }
          }

          if (firstValue) {
            stopScanner()
            redirectToEmployeePage(firstValue)
            return
          }
        } catch {
          // Keep scanning on transient detection errors.
        }

        rafRef.current = requestAnimationFrame(() => {
          void scanLoop()
        })
      }

      void scanLoop()
    } catch {
      stopScanner()
      setScanError('Camera started but preview failed. Try again, switch browser, or use manual input.')
    }
  }, [redirectToEmployeePage, stopScanner])

  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [stopScanner])

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <main className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight">Timekeeping</h1>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            redirectToEmployeePage(empOldID)
          }}
        >
          <input
            type="text"
            value={empOldID}
            onChange={(event) => setEmpOldID(event.target.value)}
            placeholder="Enter ID number"
            className="h-16 min-h-16 w-full appearance-none rounded-lg border border-slate-300 px-4 text-xl outline-none ring-0 placeholder:text-slate-400 focus:border-slate-500 sm:h-14 sm:min-h-14 sm:text-lg"
          />
          <button
            type="submit"
            className="h-16 min-h-16 rounded-lg bg-slate-900 px-6 text-xl font-medium text-white transition hover:bg-slate-700 sm:h-14 sm:min-h-14 sm:text-lg"
          >
            View Records
          </button>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6">
          <p className="text-sm text-slate-600">Or scan your ID QR code</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {!scanning ? (
              <button
                type="button"
                onClick={() => {
                  void startScanner()
                }}
                className="inline-flex h-14 items-center gap-2 rounded-lg border border-slate-300 px-6 text-lg font-medium text-slate-800 transition hover:bg-slate-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 9V6a2 2 0 0 1 2-2h3" />
                  <path d="M20 9V6a2 2 0 0 0-2-2h-3" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h3" />
                  <path d="M20 15v3a2 2 0 0 1-2 2h-3" />
                  <rect x="8" y="8" width="3" height="3" />
                  <rect x="13" y="8" width="3" height="3" />
                  <rect x="8" y="13" width="3" height="3" />
                  <path d="M13 13h1v1h-1z" />
                  <path d="M15 15h1v1h-1z" />
                </svg>
                Start Camera Scan
              </button>
            ) : (
              <button
                type="button"
                onClick={stopScanner}
                className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100"
              >
                Stop Scan
              </button>
            )}
          </div>

          {scanError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {scanError}
            </p>
          ) : null}

          {scanning ? (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-black">
              <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
