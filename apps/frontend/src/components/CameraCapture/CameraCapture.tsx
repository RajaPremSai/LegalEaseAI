'use client';

import React, { useRef, useState, useCallback } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  CameraAlt,
  Close,
  FlipCameraAndroid,
  FlashOn,
  FlashOff,
  PhotoCamera,
} from '@mui/icons-material';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onError?: (error: string) => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onError,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if camera is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [facingMode, onError]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const handleOpen = () => {
    setIsOpen(true);
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    setIsOpen(false);
    setError(null);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    stopCamera();
    setTimeout(startCamera, 100);
  };

  const toggleFlash = async () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: flashMode === 'off' }]
          });
          setFlashMode(prev => prev === 'off' ? 'on' : 'off');
        } catch (err) {
          console.warn('Flash not supported:', err);
        }
      }
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const file = new File([blob], `document-${timestamp}.jpg`, {
          type: 'image/jpeg',
        });
        onCapture(file);
        handleClose();
      }
    }, 'image/jpeg', 0.9);
  }, [onCapture]);

  // Check if device has camera
  const isCameraAvailable = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

  if (!isCameraAvailable) {
    return null;
  }

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<CameraAlt />}
        onClick={handleOpen}
        sx={{
          display: { xs: 'flex', sm: 'none' }, // Only show on mobile
        }}
      >
        Camera
      </Button>

      <Dialog
        open={isOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        fullScreen
        PaperProps={{
          sx: {
            bgcolor: 'black',
            color: 'white',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Capture Document</Typography>
          <IconButton onClick={handleClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden' }}>
          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {isLoading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '50vh',
              }}
            >
              <CircularProgress />
            </Box>
          )}

          <Box sx={{ position: 'relative', width: '100%', height: '70vh' }}>
            <video
              ref={videoRef}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              playsInline
              muted
            />

            {/* Camera controls overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              }}
            >
              <IconButton
                onClick={switchCamera}
                sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
              >
                <FlipCameraAndroid />
              </IconButton>
              
              <IconButton
                onClick={toggleFlash}
                sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: 'white' }}
              >
                {flashMode === 'on' ? <FlashOn /> : <FlashOff />}
              </IconButton>
            </Box>

            {/* Capture guidelines overlay */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                border: '2px solid white',
                borderRadius: 2,
                width: '80%',
                height: '60%',
                pointerEvents: 'none',
              }}
            />

            <Typography
              variant="body2"
              sx={{
                position: 'absolute',
                bottom: 100,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                bgcolor: 'rgba(0,0,0,0.7)',
                px: 2,
                py: 1,
                borderRadius: 1,
              }}
            >
              Position document within the frame
            </Typography>
          </Box>

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <IconButton
            onClick={capturePhoto}
            disabled={!stream || isLoading}
            sx={{
              bgcolor: 'white',
              color: 'black',
              width: 80,
              height: 80,
              '&:hover': {
                bgcolor: 'grey.200',
              },
              '&:disabled': {
                bgcolor: 'grey.500',
              },
            }}
          >
            <PhotoCamera sx={{ fontSize: 40 }} />
          </IconButton>
        </DialogActions>
      </Dialog>
    </>
  );
};