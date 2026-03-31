'use client'

import QRCode from 'qrcode'
import { useState } from 'react'

type DownloadIdQrButtonProps = {
    employeeId: string
}

export default function DownloadIdQrButton({ employeeId }: DownloadIdQrButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false)

    const handleDownload = async () => {
        if (!employeeId || isGenerating) {
            return
        }

        setIsGenerating(true)

        try {
            const qrCanvas = document.createElement('canvas')
            await QRCode.toCanvas(qrCanvas, employeeId, {
                width: 960,
                margin: 2,
                errorCorrectionLevel: 'M',
                color: {
                    dark: '#0f172a',
                    light: '#ffffff',
                },
            })

            // JPEG does not support transparency, so we draw on a white background first.
            const jpgCanvas = document.createElement('canvas')
            jpgCanvas.width = qrCanvas.width
            jpgCanvas.height = qrCanvas.height
            const context = jpgCanvas.getContext('2d')

            if (!context) {
                throw new Error('Unable to initialize image context')
            }

            context.fillStyle = '#ffffff'
            context.fillRect(0, 0, jpgCanvas.width, jpgCanvas.height)
            context.drawImage(qrCanvas, 0, 0)

            const blob = await new Promise<Blob | null>((resolve) => {
                jpgCanvas.toBlob((result) => resolve(result), 'image/jpeg', 0.95)
            })

            if (!blob) {
                throw new Error('Unable to generate JPG output')
            }

            const objectUrl = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = objectUrl
            anchor.download = `employee-${employeeId}-qr.jpg`
            anchor.click()
            URL.revokeObjectURL(objectUrl)
        } catch {
            alert('Unable to generate QR image right now. Please try again.')
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <div className="mt-3">
            <button
                type="button"
                onClick={handleDownload}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                >
                    <path d="M12 3v12" />
                    <path d="m7 10 5 5 5-5" />
                    <path d="M5 21h14" />
                </svg>
                {isGenerating ? 'Generating QR JPG...' : 'Download ID QR Code Image'}
            </button>
        </div>
    )
}
