'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  IconButton,
  Typography,
  Avatar,
  Chip,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as BotIcon,
  Person as PersonIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  sources?: string[];
  isTyping?: boolean;
}

interface ChatInterfaceProps {
  documentId?: string;
  onSendMessage?: (message: string) => Promise<ChatMessage>;
  initialMessages?: ChatMessage[];
  isLoading?: boolean;
  placeholder?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  documentId,
  onSendMessage,
  initialMessages = [],
  isLoading = false,
  placeholder = "Ask a question about your document...",
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const scrollToBottom = () => {
    if (messagesEndRef.current?.scrollIntoView) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      if (onSendMessage) {
        const response = await onSendMessage(inputValue.trim());
        setMessages(prev => [...prev, response]);
      } else {
        // Mock response for demonstration
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: `Based on your document, I can help explain that section. The clause you're asking about relates to your obligations as outlined in Section 3. This means you would be responsible for maintaining the property in good condition, but normal wear and tear should not be your responsibility.`,
          sender: 'assistant',
          timestamp: new Date(),
          sources: ['Section 3, Paragraph 2', 'Section 7, Paragraph 1'],
        };
        setMessages(prev => [...prev, mockResponse]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I encountered an error while processing your question. Please try again.",
        sender: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ pb: 1 }}>
        <Typography variant="h6" gutterBottom>
          Ask Questions About Your Document
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Get instant answers with references to specific sections
        </Typography>
      </CardContent>

      {/* Messages Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          pb: 1,
          maxHeight: '400px',
          minHeight: '300px',
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              color: 'text.secondary',
            }}
          >
            <BotIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
            <Typography variant="body2">
              Start a conversation by asking a question about your document
            </Typography>
          </Box>
        )}

        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              mb: 2,
              alignItems: 'flex-start',
              flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                mx: 1,
                bgcolor: message.sender === 'user' ? 'primary.main' : 'grey.300',
              }}
            >
              {message.sender === 'user' ? (
                <PersonIcon sx={{ fontSize: 18 }} />
              ) : (
                <BotIcon sx={{ fontSize: 18 }} />
              )}
            </Avatar>

            <Box
              sx={{
                maxWidth: '70%',
                minWidth: isMobile ? '60%' : '40%',
              }}
            >
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: message.sender === 'user' ? 'primary.main' : 'grey.100',
                  color: message.sender === 'user' ? 'white' : 'text.primary',
                  position: 'relative',
                  '&:hover .copy-button': {
                    opacity: 1,
                  },
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {message.content}
                </Typography>

                <IconButton
                  className="copy-button"
                  size="small"
                  onClick={() => copyToClipboard(message.content)}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    opacity: 0,
                    transition: 'opacity 0.2s',
                    color: message.sender === 'user' ? 'white' : 'text.secondary',
                  }}
                >
                  <CopyIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {message.sources.map((source, index) => (
                    <Chip
                      key={index}
                      label={source}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ))}
                </Box>
              )}

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, textAlign: message.sender === 'user' ? 'right' : 'left' }}
              >
                {formatTimestamp(message.timestamp)}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar sx={{ width: 32, height: 32, mx: 1, bgcolor: 'grey.300' }}>
              <BotIcon sx={{ fontSize: 18 }} />
            </Avatar>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Analyzing your question...
              </Typography>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      <Divider />

      {/* Input Area */}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading || isTyping}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          <IconButton
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading || isTyping}
            color="primary"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': {
                bgcolor: 'primary.dark',
              },
              '&:disabled': {
                bgcolor: 'grey.300',
                color: 'grey.500',
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>
    </Card>
  );
};