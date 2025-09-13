// Shared TypeScript types

export interface Document {
  id: string;
  userId: string;
  filename: string;
  documentType: 'contract' | 'lease' | 'terms_of_service' | 'privacy_policy' | 'loan_agreement' | 'other';
  jurisdiction: string;
  uploadedAt: Date;
  expiresAt: Date;
  status: 'processing' | 'analyzed' | 'error';
  metadata: DocumentMetadata;
  analysis?: DocumentAnalysis;
}

export interface DocumentMetadata {
  pageCount: number;
  wordCount: number;
  language: string;
  extractedText: string;
}

export interface DocumentAnalysis {
  summary: string;
  riskScore: 'low' | 'medium' | 'high';
  keyTerms: KeyTerm[];
  risks: Risk[];
  recommendations: string[];
  clauses: Clause[];
  generatedAt: Date;
}

export interface KeyTerm {
  term: string;
  definition: string;
  importance: 'high' | 'medium' | 'low';
  location: TextLocation;
}

export interface Risk {
  category: 'financial' | 'legal' | 'privacy' | 'operational';
  severity: 'high' | 'medium' | 'low';
  description: string;
  affectedClause: string;
  recommendation: string;
}

export interface Clause {
  id: string;
  title: string;
  content: string;
  location: TextLocation;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}

export interface TextLocation {
  startIndex: number;
  endIndex: number;
  pageNumber?: number;
}

export interface User {
  id: string;
  email: string;
  profile: UserProfile;
  subscription: UserSubscription;
  createdAt: Date;
}

export interface UserProfile {
  name: string;
  userType: 'individual' | 'small_business' | 'enterprise';
  jurisdiction: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  notifications: boolean;
  autoDelete: boolean;
}

export interface UserSubscription {
  plan: 'free' | 'premium' | 'enterprise';
  documentsRemaining: number;
  renewsAt: Date;
}