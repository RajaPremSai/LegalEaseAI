'use client';

import React, { useState } from 'react';
import { Box, Typography, Grid } from '@mui/material';
import { useRouter } from 'next/navigation';
import { 
  DocumentUpload, 
  AnalysisDashboard, 
  DocumentAnalysis,
  ChatInterface,
  ChatMessage,
  DocumentProcessingLoader,
  AnalysisDashboardSkeleton
} from '../components';

export default function HomePage() {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string>('');
  const [processingStage, setProcessingStage] = useState<'upload' | 'extract' | 'analyze' | 'complete'>('upload');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const router = useRouter();

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError('');
    setUploadedFileName(file.name);
    setProcessingStage('upload');
    
    try {
      // Simulate upload progress with stages
      setProcessingStage('upload');
      for (let i = 0; i <= 25; i += 5) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setProcessingStage('extract');
      for (let i = 25; i <= 60; i += 5) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      setProcessingStage('analyze');
      for (let i = 60; i <= 100; i += 5) {
        setUploadProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      setProcessingStage('complete');

      // Mock analysis data for demonstration
      const mockAnalysis: DocumentAnalysis = {
        summary: "This is a standard rental agreement with mostly fair terms. However, there are a few clauses that require attention, particularly regarding security deposits and maintenance responsibilities.",
        riskScore: 'medium',
        keyTerms: [
          {
            term: "Security Deposit",
            definition: "A refundable amount paid upfront to cover potential damages or unpaid rent.",
            importance: 'high',
            location: "Section 3, Paragraph 2"
          },
          {
            term: "Normal Wear and Tear",
            definition: "Expected deterioration from regular use that tenants are not responsible for.",
            importance: 'medium',
            location: "Section 7, Paragraph 1"
          }
        ],
        risks: [
          {
            category: 'financial',
            severity: 'high',
            description: "Security deposit amount exceeds local legal limits",
            affectedClause: "Section 3: Security deposit of $5,000 for a $2,000/month rental",
            recommendation: "Negotiate to reduce security deposit to 1-2 months' rent maximum"
          },
          {
            category: 'legal',
            severity: 'medium',
            description: "Broad maintenance responsibility clause",
            affectedClause: "Section 8: Tenant responsible for all repairs regardless of cause",
            recommendation: "Request to limit tenant responsibility to damage caused by negligence"
          }
        ],
        recommendations: [
          "Negotiate the security deposit amount to comply with local regulations",
          "Clarify maintenance responsibilities to exclude normal wear and tear",
          "Request a walk-through inspection clause before move-out",
          "Consider adding a clause for early lease termination with proper notice"
        ],
        clauses: [
          {
            id: '1',
            title: 'Security Deposit',
            content: 'Tenant shall pay a security deposit of $5,000 upon signing this agreement...',
            riskLevel: 'high',
            explanation: 'This security deposit is unusually high and may exceed local legal limits. Most jurisdictions limit security deposits to 1-2 months rent.'
          },
          {
            id: '2',
            title: 'Maintenance and Repairs',
            content: 'Tenant is responsible for all maintenance and repairs to the property...',
            riskLevel: 'medium',
            explanation: 'This clause is overly broad and could make you responsible for major repairs that should be the landlord\'s responsibility.'
          }
        ],
        generatedAt: new Date()
      };

      setAnalysis(mockAnalysis);
      setShowChat(true);
    } catch (err) {
      setError('Failed to analyze document. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleChatMessage = async (message: string): Promise<ChatMessage> => {
    // Mock chat response
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const responses = [
      {
        content: `Based on your document analysis, I can help explain that section. The clause you're asking about relates to your obligations as outlined in Section 3. This means you would be responsible for maintaining the property in good condition, but normal wear and tear should not be your responsibility.`,
        sources: ['Section 3, Paragraph 2', 'Section 7, Paragraph 1'],
      },
      {
        content: `That's a great question about the security deposit. According to the analysis, the $5,000 deposit mentioned in your document is unusually high and may exceed local legal limits. Most jurisdictions limit security deposits to 1-2 months' rent maximum.`,
        sources: ['Section 3: Security Deposit'],
      },
      {
        content: `The maintenance clause in your document is quite broad. It states that you're responsible for "all maintenance and repairs," which could include major structural issues that should typically be the landlord's responsibility. I'd recommend negotiating to limit this to minor repairs under a certain dollar amount.`,
        sources: ['Section 8: Maintenance Responsibilities'],
      },
    ];

    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    return {
      id: Date.now().toString(),
      content: randomResponse.content,
      sender: 'assistant',
      timestamp: new Date(),
      sources: randomResponse.sources,
    };
  };

  const handleCompareDocuments = () => {
    router.push('/compare');
  };

  const handleDownloadReport = () => {
    // Mock download functionality
    const reportData = {
      documentName: uploadedFileName,
      analysis: analysis,
      generatedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${uploadedFileName.replace(/\.[^/.]+$/, '')}_analysis_report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleShareAnalysis = () => {
    // Mock share functionality
    if (navigator.share) {
      navigator.share({
        title: `Legal Document Analysis - ${uploadedFileName}`,
        text: `I analyzed my legal document and found it has a ${analysis?.riskScore} risk score. Check out the detailed analysis!`,
        url: window.location.href,
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Analysis link copied to clipboard!');
    }
  };

  return (
    <Box>
      {!analysis ? (
        <>
          {!isUploading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h3" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
                Understand Your Legal Documents
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}>
                Upload any legal document and get instant AI-powered analysis in plain English. 
                Identify risks, understand key terms, and get actionable recommendations.
              </Typography>
              
              <DocumentUpload
                onFileUpload={handleFileUpload}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                error={error}
              />
            </Box>
          ) : (
            <Box sx={{ py: 4 }}>
              <DocumentProcessingLoader
                currentStep={processingStage}
                progress={uploadProgress}
                fileName={uploadedFileName}
              />
            </Box>
          )}
        </>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={showChat ? 8 : 12}>
            <AnalysisDashboard
              analysis={analysis}
              documentName={uploadedFileName}
              onCompareDocuments={handleCompareDocuments}
              onDownloadReport={handleDownloadReport}
              onShareAnalysis={handleShareAnalysis}
            />
          </Grid>
          {showChat && (
            <Grid item xs={12} lg={4}>
              <Box sx={{ position: 'sticky', top: 20 }}>
                <ChatInterface
                  documentId="current-document"
                  onSendMessage={handleChatMessage}
                  initialMessages={chatMessages}
                  placeholder="Ask a question about your document..."
                />
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}