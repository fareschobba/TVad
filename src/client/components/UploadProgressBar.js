import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Progress, Box, Text, VStack, Button, useToast } from '@chakra-ui/react';

const UploadProgressBar = ({ onUploadComplete }) => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const toast = useToast();

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsUploading(true);
    setProgress(0);
    
    const formData = new FormData();
    formData.append('video', file);
    formData.append('name', file.name);
    
    try {
      // Set up event source for SSE
      const eventSource = new EventSource('/api/cloudinary-advertisements/upload-with-progress');
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.event === 'progress') {
          setProgress(data.percentage);
          setUploadedBytes(data.bytesUploaded);
          setTotalBytes(data.totalBytes);
        } else if (data.event === 'complete') {
          eventSource.close();
          setIsUploading(false);
          setProgress(100);
          
          toast({
            title: 'Upload complete',
            description: 'Your video has been uploaded successfully',
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
          
          if (onUploadComplete) {
            onUploadComplete(data.data);
          }
        } else if (data.event === 'error') {
          eventSource.close();
          setIsUploading(false);
          
          toast({
            title: 'Upload failed',
            description: data.message,
            status: 'error',
            duration: 5000,
            isClosable: true,
          });
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
        setIsUploading(false);
        
        toast({
          title: 'Connection error',
          description: 'Lost connection to the server',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      };
      
      // Start the upload
      const response = await axios.post('/api/cloudinary-advertisements/upload-with-progress', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
    } catch (error) {
      setIsUploading(false);
      
      toast({
        title: 'Upload failed',
        description: error.response?.data?.message || 'An error occurred during upload',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <VStack spacing={4} width="100%">
      <input
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        disabled={isUploading}
        style={{ width: '100%' }}
      />
      
      <Button
        colorScheme="blue"
        onClick={handleUpload}
        isLoading={isUploading}
        loadingText="Uploading..."
        width="100%"
        disabled={!file || isUploading}
      >
        Upload Video
      </Button>
      
      {isUploading && (
        <Box width="100%">
          <Progress value={progress} size="md" colorScheme="blue" borderRadius="md" />
          <Text mt={2} fontSize="sm">
            {progress}% complete ({formatBytes(uploadedBytes)} of {formatBytes(totalBytes)})
          </Text>
        </Box>
      )}
    </VStack>
  );
};

export default UploadProgressBar;