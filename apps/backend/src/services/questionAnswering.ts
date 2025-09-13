import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { Document, Clause, TextLocation } from '@legal-ai/shared';
import { FirestoreService } from './firestore';

interface ConversationContext {
  id: string;
  documentId: string;
  userId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SourceCitation[];
}

interface SourceCitation {
  clauseId: string;
  clauseTitle: string;
  relevantText: string;
  location: TextLocation;
  confidence: number;
}

interface DocumentEmbedding {
  documentId: string;
  clauseId: string;
  text: string;
  embedding: number[];
  metadata: {
    clauseTitle: string;
    riskLevel: string;
    location: TextLocation;
  };
}

interface QAResponse {
  answer: string;
  sources: SourceCitation[];
  conversationId: string;
  confidence: number;
}

export class QuestionAnsweringService {
  private client: PredictionServiceClient;
  private firestoreService: FirestoreService;
  private projectId: string;
  private location: string;
  private embeddingModel: string;
  private textModel: string;

  constructor() {
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is required');
    }

    this.client = new PredictionServiceClient();
    this.firestoreService = new FirestoreService();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.embeddingModel = 'textembedding-gecko@003';
    this.textModel = 'text-bison@002';
  }

  /**
   * Process a question about a document and return an answer with sources
   */
  async askQuestion(
    documentId: string,
    userId: string,
    question: string,
    conversationId?: string
  ): Promise<QAResponse> {
    try {
      // Get or create conversation context
      const conversation = conversationId 
        ? await this.getConversation(conversationId)
        : await this.createConversation(documentId, userId);

      // Get document and its embeddings
      const documentRecord = await this.firestoreService.getDocument(documentId);
      if (!documentRecord) {
        throw new Error('Document not found');
      }

      // Get analysis for the document
      const analysisRecord = await this.firestoreService.getAnalysisByDocumentId(documentId);
      if (!analysisRecord) {
        throw new Error('Document analysis not found. Please analyze the document first.');
      }

      // Convert to Document type with analysis
      const document: Document = {
        id: documentRecord.id,
        userId: documentRecord.userId,
        filename: documentRecord.filename,
        documentType: documentRecord.documentType as Document['documentType'],
        jurisdiction: documentRecord.jurisdiction,
        uploadedAt: documentRecord.uploadedAt,
        expiresAt: documentRecord.expiresAt,
        status: documentRecord.status as Document['status'],
        metadata: {
          pageCount: documentRecord.metadata.pageCount,
          wordCount: documentRecord.metadata.wordCount,
          language: documentRecord.metadata.language,
          extractedText: '' // Will be populated from analysis if needed
        },
        analysis: {
          summary: analysisRecord.summary,
          riskScore: analysisRecord.riskScore,
          keyTerms: analysisRecord.keyTerms.map(term => ({
            term: term.term,
            definition: term.definition,
            importance: term.importance,
            location: {
              startIndex: 0,
              endIndex: 0,
              pageNumber: term.location.page
            }
          })),
          risks: analysisRecord.risks,
          recommendations: analysisRecord.recommendations,
          clauses: await this.getDocumentClauses(documentId),
          generatedAt: analysisRecord.generatedAt
        }
      };

      // Ensure document has embeddings
      await this.ensureDocumentEmbeddings(document);

      // Generate embedding for the question
      const questionEmbedding = await this.generateEmbedding(question);

      // Find relevant document sections using semantic search
      const relevantSections = await this.findRelevantSections(
        documentId,
        questionEmbedding,
        5 // Top 5 most relevant sections
      );

      // Generate contextual answer
      const answer = await this.generateAnswer(
        question,
        relevantSections,
        conversation.messages,
        document
      );

      // Create source citations
      const sources = this.createSourceCitations(relevantSections, answer);

      // Update conversation
      await this.updateConversation(conversation.id, question, answer, sources);

      return {
        answer,
        sources,
        conversationId: conversation.id,
        confidence: this.calculateAnswerConfidence(relevantSections, answer)
      };

    } catch (error) {
      console.error('Error in question answering:', error);
      throw new Error('Failed to process question');
    }
  }

  /**
   * Generate embeddings for all clauses in a document
   */
  async generateDocumentEmbeddings(document: Document): Promise<void> {
    if (!document.analysis?.clauses) {
      throw new Error('Document analysis with clauses is required');
    }

    const embeddings: DocumentEmbedding[] = [];

    for (const clause of document.analysis.clauses) {
      try {
        // Generate embedding for clause content
        const embedding = await this.generateEmbedding(clause.content);

        embeddings.push({
          documentId: document.id,
          clauseId: clause.id,
          text: clause.content,
          embedding,
          metadata: {
            clauseTitle: clause.title,
            riskLevel: clause.riskLevel,
            location: clause.location
          }
        });

        // Also create embedding for clause title + explanation for better semantic matching
        const titleExplanationText = `${clause.title}: ${clause.explanation}`;
        const titleEmbedding = await this.generateEmbedding(titleExplanationText);

        embeddings.push({
          documentId: document.id,
          clauseId: `${clause.id}-title`,
          text: titleExplanationText,
          embedding: titleEmbedding,
          metadata: {
            clauseTitle: clause.title,
            riskLevel: clause.riskLevel,
            location: clause.location
          }
        });

      } catch (error) {
        console.error(`Error generating embedding for clause ${clause.id}:`, error);
        // Continue with other clauses
      }
    }

    // Store embeddings in Firestore
    await this.storeDocumentEmbeddings(document.id, embeddings);
  }

  /**
   * Generate embedding for a text using Vertex AI
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.embeddingModel}`;

    const instanceValue = {
      content: text.substring(0, 3000) // Limit text length for embedding model
    };

    const request = {
      endpoint,
      instances: [instanceValue]
    };

    const [response] = await this.client.predict(request);
    
    if (response.predictions && response.predictions.length > 0) {
      return response.predictions[0].embeddings?.values || [];
    }

    throw new Error('Failed to generate embedding');
  }

  /**
   * Find relevant document sections using cosine similarity
   */
  private async findRelevantSections(
    documentId: string,
    questionEmbedding: number[],
    topK: number = 5
  ): Promise<Array<DocumentEmbedding & { similarity: number }>> {
    // Get document embeddings from Firestore
    const embeddings = await this.getDocumentEmbeddings(documentId);

    // Calculate cosine similarity for each embedding
    const similarities = embeddings.map(embedding => ({
      ...embedding,
      similarity: this.cosineSimilarity(questionEmbedding, embedding.embedding)
    }));

    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .filter(item => item.similarity > 0.3); // Filter out low-similarity results
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Generate contextual answer using relevant sections and conversation history
   */
  private async generateAnswer(
    question: string,
    relevantSections: Array<DocumentEmbedding & { similarity: number }>,
    conversationHistory: ConversationMessage[],
    document: Document
  ): Promise<string> {
    // Build context from relevant sections
    const contextSections = relevantSections.map((section, index) => 
      `[Section ${index + 1}] ${section.metadata.clauseTitle}: ${section.text}`
    ).join('\n\n');

    // Build conversation context
    const conversationContext = conversationHistory
      .slice(-6) // Last 3 exchanges (6 messages)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = this.createQAPrompt(
      question,
      contextSections,
      conversationContext,
      document.documentType,
      document.jurisdiction
    );

    const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.textModel}`;

    const instanceValue = {
      prompt: prompt,
      max_output_tokens: 512,
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40
    };

    const request = {
      endpoint,
      instances: [instanceValue]
    };

    const [response] = await this.client.predict(request);
    
    if (response.predictions && response.predictions.length > 0) {
      return response.predictions[0].content || response.predictions[0].text || 'I apologize, but I cannot provide an answer to that question based on the document content.';
    }

    throw new Error('Failed to generate answer');
  }

  /**
   * Create Q&A prompt template
   */
  private createQAPrompt(
    question: string,
    contextSections: string,
    conversationHistory: string,
    documentType: string,
    jurisdiction: string
  ): string {
    return `You are a legal document assistant helping users understand their ${documentType} document from ${jurisdiction}. 

Based on the relevant sections from the document and the conversation history, answer the user's question clearly and accurately.

RELEVANT DOCUMENT SECTIONS:
${contextSections}

CONVERSATION HISTORY:
${conversationHistory}

CURRENT QUESTION: ${question}

INSTRUCTIONS:
1. Answer based ONLY on the provided document sections
2. Use plain language (8th-grade reading level)
3. If the question cannot be answered from the provided sections, say so clearly
4. Reference specific sections when possible (e.g., "According to Section 1...")
5. Include relevant warnings about risks if applicable
6. Maintain conversation context from previous exchanges
7. Always remind users that this is not legal advice

ANSWER:`;
  }

  /**
   * Create source citations from relevant sections
   */
  private createSourceCitations(
    relevantSections: Array<DocumentEmbedding & { similarity: number }>,
    answer: string
  ): SourceCitation[] {
    return relevantSections
      .filter(section => section.similarity > 0.4) // Only high-confidence sources
      .map(section => ({
        clauseId: section.clauseId.replace('-title', ''), // Remove title suffix if present
        clauseTitle: section.metadata.clauseTitle,
        relevantText: section.text.substring(0, 200) + (section.text.length > 200 ? '...' : ''),
        location: section.metadata.location,
        confidence: section.similarity
      }))
      .slice(0, 3); // Limit to top 3 sources
  }

  /**
   * Calculate confidence score for the answer
   */
  private calculateAnswerConfidence(
    relevantSections: Array<DocumentEmbedding & { similarity: number }>,
    answer: string
  ): number {
    if (relevantSections.length === 0) return 0;

    // Base confidence on average similarity of top sections
    const avgSimilarity = relevantSections
      .slice(0, 3)
      .reduce((sum, section) => sum + section.similarity, 0) / Math.min(3, relevantSections.length);

    // Adjust based on answer characteristics
    let confidence = avgSimilarity;

    // Lower confidence if answer indicates uncertainty
    if (answer.toLowerCase().includes('cannot') || 
        answer.toLowerCase().includes('unclear') ||
        answer.toLowerCase().includes('not specified')) {
      confidence *= 0.7;
    }

    // Higher confidence if answer references specific sections
    if (answer.toLowerCase().includes('section') || 
        answer.toLowerCase().includes('clause')) {
      confidence *= 1.1;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Ensure document has embeddings generated
   */
  private async ensureDocumentEmbeddings(document: Document): Promise<void> {
    const existingEmbeddings = await this.getDocumentEmbeddings(document.id);
    
    if (existingEmbeddings.length === 0) {
      await this.generateDocumentEmbeddings(document);
    }
  }

  /**
   * Store document embeddings in Firestore
   */
  private async storeDocumentEmbeddings(
    documentId: string,
    embeddings: DocumentEmbedding[]
  ): Promise<void> {
    const batch = this.firestoreService.db.batch();

    embeddings.forEach((embedding, index) => {
      const docRef = this.firestoreService.db
        .collection('document_embeddings')
        .doc(`${documentId}_${index}`);
      
      batch.set(docRef, {
        ...embedding,
        createdAt: new Date()
      });
    });

    await batch.commit();
  }

  /**
   * Get document embeddings from Firestore
   */
  private async getDocumentEmbeddings(documentId: string): Promise<DocumentEmbedding[]> {
    const snapshot = await this.firestoreService.db
      .collection('document_embeddings')
      .where('documentId', '==', documentId)
      .get();

    return snapshot.docs.map(doc => doc.data() as DocumentEmbedding);
  }

  /**
   * Create new conversation
   */
  private async createConversation(documentId: string, userId: string): Promise<ConversationContext> {
    const conversation: ConversationContext = {
      id: this.generateId(),
      documentId,
      userId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.firestoreService.db
      .collection('conversations')
      .doc(conversation.id)
      .set(conversation);

    return conversation;
  }

  /**
   * Get existing conversation
   */
  private async getConversation(conversationId: string): Promise<ConversationContext> {
    const doc = await this.firestoreService.db
      .collection('conversations')
      .doc(conversationId)
      .get();

    if (!doc.exists) {
      throw new Error('Conversation not found');
    }

    return doc.data() as ConversationContext;
  }

  /**
   * Update conversation with new messages
   */
  private async updateConversation(
    conversationId: string,
    question: string,
    answer: string,
    sources: SourceCitation[]
  ): Promise<void> {
    const userMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'user',
      content: question,
      timestamp: new Date()
    };

    const assistantMessage: ConversationMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
      sources
    };

    await this.firestoreService.db
      .collection('conversations')
      .doc(conversationId)
      .update({
        messages: this.firestoreService.arrayUnion(userMessage, assistantMessage),
        updatedAt: new Date()
      });
  }

  /**
   * Get conversation history for a document
   */
  async getConversationHistory(
    documentId: string,
    userId: string
  ): Promise<ConversationContext[]> {
    const snapshot = await this.firestoreService.db
      .collection('conversations')
      .where('documentId', '==', documentId)
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();

    return snapshot.docs.map(doc => doc.data() as ConversationContext);
  }

  /**
   * Delete conversation and its embeddings when document expires
   */
  async cleanupDocumentData(documentId: string): Promise<void> {
    const batch = this.firestoreService.db.batch();

    // Delete conversations
    const conversationsSnapshot = await this.firestoreService.db
      .collection('conversations')
      .where('documentId', '==', documentId)
      .get();

    conversationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Delete embeddings
    const embeddingsSnapshot = await this.firestoreService.db
      .collection('document_embeddings')
      .where('documentId', '==', documentId)
      .get();

    embeddingsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  /**
   * Get document clauses from Firestore or generate them if they don't exist
   */
  private async getDocumentClauses(documentId: string): Promise<Clause[]> {
    try {
      // Try to get existing clauses
      const clausesSnapshot = await this.firestoreService.db
        .collection('document_clauses')
        .where('documentId', '==', documentId)
        .get();

      if (!clausesSnapshot.empty) {
        return clausesSnapshot.docs.map(doc => doc.data() as Clause);
      }

      // If no clauses exist, return empty array for now
      // In a real implementation, you might want to generate clauses from the document text
      return [];
    } catch (error) {
      console.error('Error getting document clauses:', error);
      return [];
    }
  }

  /**
   * Store document clauses in Firestore
   */
  private async storeDocumentClauses(documentId: string, clauses: Clause[]): Promise<void> {
    const batch = this.firestoreService.db.batch();

    clauses.forEach(clause => {
      const docRef = this.firestoreService.db
        .collection('document_clauses')
        .doc(`${documentId}_${clause.id}`);
      
      batch.set(docRef, {
        ...clause,
        documentId,
        createdAt: new Date()
      });
    });

    await batch.commit();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export const questionAnsweringService = new QuestionAnsweringService();