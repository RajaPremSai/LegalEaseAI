'use client';

import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Card, 
  CardContent,
  Alert,
  useTheme,
  useMediaQuery 
} from '@mui/material';
import { 
  DocumentComparison, 
  DocumentVersion, 
  DocumentChange,
  ComparisonLoading,
  DocumentUpload
} from '../../components';
import { ArrowBack as BackIcon, Upload as UploadIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

export default function ComparePage() {
  const [originalDocument, setOriginalDocument] = useState<DocumentVersion | null>(null);
  const [comparedDocument, setComparedDocument] = useState<DocumentVersion | null>(null);
  const [changes, setChanges] = useState<DocumentChange[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingFor, setUploadingFor] = useState<'original' | 'compared' | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const router = useRouter();

  const handleFileUpload = async (file: File, type: 'original' | 'compared') => {
    setIsUploading(true);
    setUploadingFor(type);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const mockDocument: DocumentVersion = {
        id: Date.now().toString(),
        name: file.name,
        uploadedAt: new Date(),
        content: `Mock content for ${file.name}`,
        analysis: {
          riskScore: type === 'original' ? 'high' : 'medium',
          keyChanges: type === 'compared' ? ['Security deposit reduced', 'Maintenance clause clarified'] : undefined,
        },
      };

      if (type === 'original') {
        setOriginalDocument(mockDocument);
      } else {
        setComparedDocument(mockDocument);
      }

      // Auto-analyze if both documents are uploaded
      if ((type === 'original' && comparedDocument) || (type === 'compared' && originalDocument)) {
        setTimeout(() => analyzeChanges(), 500);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadingFor(null);
      setUploadProgress(0);
    }
  };

  const analyzeChanges = async () => {
    if (!originalDocument || !comparedDocument) return;

    setIsAnalyzing(true);
    
    try {
      // Simulate analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockChanges: DocumentChange[] = [
        {
          type: 'modified',
          section: 'Security Deposit',
          oldContent: 'Tenant shall pay a security deposit of $5,000 upon signing this agreement.',
          newContent: 'Tenant shall pay a security deposit of $3,000 upon signing this agreement.',
          impact: 'positive',
          explanation: 'Security deposit reduced by $2,000, making it more reasonable and closer to legal limits.',
          riskChange: 'decreased',
        },
        {
          type: 'added',
          section: 'Early Termination Clause',
          newContent: 'Tenant may terminate this lease early with 60 days written notice and payment of one month\'s rent as penalty.',
          impact: 'positive',
          explanation: 'New clause provides flexibility for early termination, which protects tenant interests.',
          riskChange: 'decreased',
        },
        {
          type: 'modified',
          section: 'Maintenance Responsibilities',
          oldContent: 'Tenant is responsible for all maintenance and repairs to the property.',
          newContent: 'Tenant is responsible for minor maintenance and repairs under $200. Landlord responsible for major repairs and structural issues.',
          impact: 'positive',
          explanation: 'Maintenance responsibilities clarified and limited, reducing tenant financial burden.',
          riskChange: 'decreased',
        },
      ];

      setChanges(mockChanges);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <Box sx={{ py: 4 }}>
        <ComparisonLoading
          stage="analyzing"
          progress={75}
        />
      </Box>
    );
  }

  if (originalDocument && comparedDocument && changes.length > 0) {
    return (
      <Box>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/')}
            variant="outlined"
          >
            Back to Analysis
          </Button>
        </Box>
        
        <DocumentComparison
          originalDocument={originalDocument}
          comparedDocument={comparedDocument}
          changes={changes}
          onAnalyzeChanges={analyzeChanges}
          isAnalyzing={isAnalyzing}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: isMobile ? 1 : 2 }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" gutterBottom sx={{ fontWeight: 600 }}>
          Compare Document Versions
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Upload two versions of the same document to see what changed and understand the impact
        </Typography>
        
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/')}
          variant="outlined"
          sx={{ mb: 3 }}
        >
          Back to Analysis
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Original Document Upload */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 300 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Original Document
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload the first version of your document
              </Typography>

              {originalDocument ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">
                      {originalDocument.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Uploaded: {originalDocument.uploadedAt.toLocaleDateString()}
                    </Typography>
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => setOriginalDocument(null)}
                    size="small"
                  >
                    Upload Different File
                  </Button>
                </Box>
              ) : (
                <Box sx={{ flex: 1 }}>
                  <DocumentUpload
                    onFileUpload={(file) => handleFileUpload(file, 'original')}
                    isUploading={isUploading && uploadingFor === 'original'}
                    uploadProgress={uploadingFor === 'original' ? uploadProgress : 0}
                    acceptedFileTypes={['.pdf', '.doc', '.docx', '.txt']}
                    maxFileSize={50}
                    dropzoneText="Drop original document here"
                    buttonText="Select Original Document"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Compared Document Upload */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', minHeight: 300 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Updated Document
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload the newer version to compare changes
              </Typography>

              {comparedDocument ? (
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2">
                      {comparedDocument.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Uploaded: {comparedDocument.uploadedAt.toLocaleDateString()}
                    </Typography>
                  </Alert>
                  <Button
                    variant="outlined"
                    onClick={() => setComparedDocument(null)}
                    size="small"
                  >
                    Upload Different File
                  </Button>
                </Box>
              ) : (
                <Box sx={{ flex: 1 }}>
                  <DocumentUpload
                    onFileUpload={(file) => handleFileUpload(file, 'compared')}
                    isUploading={isUploading && uploadingFor === 'compared'}
                    uploadProgress={uploadingFor === 'compared' ? uploadProgress : 0}
                    acceptedFileTypes={['.pdf', '.doc', '.docx', '.txt']}
                    maxFileSize={50}
                    dropzoneText="Drop updated document here"
                    buttonText="Select Updated Document"
                    disabled={!originalDocument}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Instructions */}
      {!originalDocument && !comparedDocument && (
        <Box sx={{ mt: 4 }}>
          <Alert severity="info">
            <Typography variant="subtitle2" gutterBottom>
              How Document Comparison Works:
            </Typography>
            <Typography variant="body2" component="div">
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                <li>Upload your original document first</li>
                <li>Upload the updated version you want to compare</li>
                <li>Our AI will analyze the differences and explain the impact</li>
                <li>Review changes with risk assessments and recommendations</li>
              </ol>
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Ready to Compare */}
      {originalDocument && comparedDocument && changes.length === 0 && (
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            onClick={analyzeChanges}
            disabled={isAnalyzing}
            startIcon={<UploadIcon />}
          >
            {isAnalyzing ? 'Analyzing Changes...' : 'Compare Documents'}
          </Button>
        </Box>
      )}
    </Box>
  );
}