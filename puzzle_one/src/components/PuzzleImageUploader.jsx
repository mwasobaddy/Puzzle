import React, { useState, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

const PuzzleImageUploader = ({ onImageProcessed = () => { } }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const createImageData = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const img = new Image();

      reader.onload = (e) => {
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const MAX_SIZE = 1024;
            let width = img.width;
            let height = img.height;

            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              } else {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            resolve({
              data: ctx.getImageData(0, 0, width, height),
              width,
              height,
              aspectRatio: width / height
            });
          } catch (err) {
            reject(new Error('Failed to process image: ' + err.message));
          }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const processImage = async (file) => {
    if (!file) {
      setError('No file selected');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image size should be less than 5MB');
      }

      const imageData = await createImageData(file);

      const storageRef = ref(storage, `puzzle-images/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);

      try {
        onImageProcessed({
          imageUrl,
          dimensions: {
            width: imageData.width,
            height: imageData.height,
            aspectRatio: imageData.aspectRatio
          }
        });
      } catch (callbackError) {
        console.error('Error in onImageProcessed callback:', callbackError);
        throw new Error('Failed to process image data');
      }

      setUploadProgress(100);
    } catch (err) {
      setError(err.message);
      console.error('Error processing image:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file) {
      processImage(file);
    }
  }, [processImage]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
    e.target.value = '';
  }, [processImage]);

  return (
    <div className="upload-container p-6 bg-white rounded-lg shadow">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload"
      />
      <label
        htmlFor="image-upload"
        className={`
          block w-full p-4 text-center border-2 border-dashed 
          rounded cursor-pointer transition-colors
          ${error ? 'border-red-300 hover:border-red-400' : 'border-gray-300 hover:border-blue-500'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {error ? (
          <div className="space-y-2">
            <p className="text-red-500">{error}</p>
            <p className="text-sm text-gray-500">Click to try again</p>
          </div>
        ) : uploading ? (
          <div className="space-y-2">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-600">Processing image... {uploadProgress}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600">Click or drag image here to upload</p>
            <p className="text-sm text-gray-400">Maximum size: 5MB</p>
          </div>
        )}
      </label>
    </div>
  );
};

export default PuzzleImageUploader;