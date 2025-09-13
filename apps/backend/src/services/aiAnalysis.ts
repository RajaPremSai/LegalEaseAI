import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { DocumentAnalysis, KeyTerm, Risk, Clause, TextLocation } from '@legal-ai/shared';
import { RiskAssessmentService } from './riskAssessment';

interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
}

interface AnalysisPrompts {
  summarization: string;
  keyTerms: string;
  riskAssessment: string;
  clauseAnalysis: string;
}

export class AIAnalysisService {
  private client: PredictionServiceClient;
  private config: VertexAIConfig;
  private prompts: AnalysisPrompts;
  private riskAssessmentService: RiskAssessmentService;

  constructor() {
    if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is required');
    }
    
    this.client = new PredictionServiceClient();
    this.config = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
      model: 'text-bison@002' // PaLM 2 model
    };

    this.prompts = {
      summarization: this.createSummarizationPrompt(),
      keyTerms: this.createKeyTermsPrompt(),
      riskAssessment: this.createRiskAssessmentPrompt(),
      clauseAnalysis: this.createClauseAnalysisPrompt()
    };

    this.riskAssessmentService = new RiskAssessmentService();
  }

  /**
   * Analyzes a legal document and returns comprehensive analysis
   */
  async analyzeDocument(
    documentText: string,
    documentType: string,
    jurisdiction: string
  ): Promise<DocumentAnalysis> {
    try {
      // Run analysis tasks in parallel for better performance
      const [summary, keyTerms, aiRisks, clauses] = await Promise.all([
        this.generateSummary(documentText, documentType, jurisdiction),
        this.extractKeyTerms(documentText, documentType),
        this.assessRisks(documentText, documentType, jurisdiction),
        this.analyzeClauses(documentText, documentType)
      ]);

      // Perform comprehensive risk assessment using the dedicated service
      const riskAssessment = await this.riskAssessmentService.assessDocumentRisks(
        documentText,
        clauses,
        documentType,
        jurisdiction
      );

      // Combine AI-generated risks with pattern-based risks, prioritizing the advanced assessment
      const combinedRisks = this.combineRiskAssessments(aiRisks, riskAssessment.risks);
      const riskScore = riskAssessment.overallRiskScore;
      const recommendations = riskAssessment.recommendations;

      return {
        summary,
        riskScore,
        keyTerms,
        risks: combinedRisks,
        recommendations,
        clauses,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Error analyzing document:', error);
      throw new Error('Failed to analyze document with AI');
    }
  }

  /**
   * Generates a plain-language summary of the document
   */
  private async generateSummary(
    documentText: string,
    documentType: string,
    jurisdiction: string
  ): Promise<string> {
    const prompt = this.prompts.summarization
      .replace('{documentType}', documentType)
      .replace('{jurisdiction}', jurisdiction)
      .replace('{documentText}', this.truncateText(documentText, 8000));

    const response = await this.callVertexAI(prompt);
    return this.extractTextFromResponse(response);
  }

  /**
   * Extracts key legal terms and their definitions
   */
  private async extractKeyTerms(
    documentText: string,
    documentType: string
  ): Promise<KeyTerm[]> {
    const prompt = this.prompts.keyTerms
      .replace('{documentType}', documentType)
      .replace('{documentText}', this.truncateText(documentText, 6000));

    const response = await this.callVertexAI(prompt);
    return this.parseKeyTermsResponse(response, documentText);
  }

  /**
   * Assesses risks in the document
   */
  private async assessRisks(
    documentText: string,
    documentType: string,
    jurisdiction: string
  ): Promise<Risk[]> {
    const prompt = this.prompts.riskAssessment
      .replace('{documentType}', documentType)
      .replace('{jurisdiction}', jurisdiction)
      .replace('{documentText}', this.truncateText(documentText, 6000));

    const response = await this.callVertexAI(prompt);
    return this.parseRisksResponse(response);
  }

  /**
   * Analyzes individual clauses in the document
   */
  private async analyzeClauses(
    documentText: string,
    documentType: string
  ): Promise<Clause[]> {
    const prompt = this.prompts.clauseAnalysis
      .replace('{documentType}', documentType)
      .replace('{documentText}', this.truncateText(documentText, 6000));

    const response = await this.callVertexAI(prompt);
    return this.parseClausesResponse(response, documentText);
  }

  /**
   * Makes a request to Vertex AI PaLM 2 model
   */
  private async callVertexAI(prompt: string): Promise<any> {
    const endpoint = `projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${this.config.model}`;

    const instanceValue = {
      prompt: prompt,
      max_output_tokens: 1024,
      temperature: 0.2,
      top_p: 0.8,
      top_k: 40
    };

    const instances = [instanceValue];
    const parameters = {
      temperature: 0.2,
      maxOutputTokens: 1024,
      topP: 0.8,
      topK: 40
    };

    const request = {
      endpoint,
      instances,
      parameters
    };

    const [response] = await this.client.predict(request);
    return response;
  }

  /**
   * Creates the summarization prompt template
   */
  private createSummarizationPrompt(): string {
    return `You are a legal expert helping everyday people understand legal documents. 
Analyze this {documentType} document from {jurisdiction} and provide a clear, plain-language summary.

Document:
{documentText}

Please provide:
1. A brief overview of what this document is about (2-3 sentences)
2. The main obligations for each party
3. Key rights and protections
4. Important deadlines or time limits
5. Any notable restrictions or limitations

Write at an 8th-grade reading level. Avoid legal jargon and explain any necessary legal terms in simple language.

Summary:`;
  }

  /**
   * Creates the key terms extraction prompt template
   */
  private createKeyTermsPrompt(): string {
    return `Analyze this {documentType} document and identify the most important legal terms that a non-lawyer should understand.

Document:
{documentText}

For each key term, provide:
- The exact term as it appears in the document
- A simple, clear definition (1-2 sentences)
- Why it's important (high/medium/low importance)

Focus on terms that directly affect the reader's rights, obligations, or financial responsibilities.
Limit to the 10 most important terms.

Format as JSON array:
[
  {
    "term": "exact term from document",
    "definition": "simple explanation",
    "importance": "high|medium|low"
  }
]

Key Terms:`;
  }

  /**
   * Creates the risk assessment prompt template
   */
  private createRiskAssessmentPrompt(): string {
    return `You are a legal expert analyzing this {documentType} document from {jurisdiction} for potential risks to the person signing it.

Document:
{documentText}

Identify specific risks in these categories:
- Financial: costs, fees, penalties, liability
- Legal: binding obligations, dispute resolution, jurisdiction
- Privacy: data collection, sharing, retention
- Operational: restrictions, requirements, compliance

For each risk:
- Describe the specific risk in plain language
- Identify the exact clause or section
- Rate severity (high/medium/low)
- Suggest what the person should do about it

Format as JSON array:
[
  {
    "category": "financial|legal|privacy|operational",
    "severity": "high|medium|low",
    "description": "clear description of the risk",
    "affectedClause": "relevant text from document",
    "recommendation": "specific action to take"
  }
]

Risk Assessment:`;
  }

  /**
   * Creates the clause analysis prompt template
   */
  private createClauseAnalysisPrompt(): string {
    return `Analyze this {documentType} document and break it down into its main clauses or sections.

Document:
{documentText}

For each major clause or section:
- Give it a clear, descriptive title
- Summarize what it means in plain language
- Assess its risk level (high/medium/low)
- Explain why it matters to the reader

Focus on clauses that create obligations, grant rights, or could cause problems.

Format as JSON array:
[
  {
    "title": "descriptive title",
    "content": "original clause text (first 200 chars)",
    "riskLevel": "high|medium|low",
    "explanation": "what this means for the reader"
  }
]

Clause Analysis:`;
  }

  /**
   * Extracts text content from Vertex AI response
   */
  private extractTextFromResponse(response: any): string {
    try {
      if (response.predictions && response.predictions.length > 0) {
        const prediction = response.predictions[0];
        return prediction.content || prediction.text || '';
      }
      return '';
    } catch (error) {
      console.error('Error extracting text from AI response:', error);
      return '';
    }
  }

  /**
   * Parses key terms from AI response
   */
  private parseKeyTermsResponse(response: any, documentText: string): KeyTerm[] {
    try {
      const text = this.extractTextFromResponse(response);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return [];
      }

      const keyTermsData = JSON.parse(jsonMatch[0]);
      return keyTermsData.map((item: any) => ({
        term: item.term || '',
        definition: item.definition || '',
        importance: item.importance || 'medium',
        location: this.findTextLocation(item.term, documentText)
      }));
    } catch (error) {
      console.error('Error parsing key terms response:', error);
      return [];
    }
  }

  /**
   * Parses risks from AI response
   */
  private parseRisksResponse(response: any): Risk[] {
    try {
      const text = this.extractTextFromResponse(response);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return [];
      }

      const risksData = JSON.parse(jsonMatch[0]);
      return risksData.map((item: any) => ({
        category: item.category || 'legal',
        severity: item.severity || 'medium',
        description: item.description || '',
        affectedClause: item.affectedClause || '',
        recommendation: item.recommendation || ''
      }));
    } catch (error) {
      console.error('Error parsing risks response:', error);
      return [];
    }
  }

  /**
   * Parses clauses from AI response
   */
  private parseClausesResponse(response: any, documentText: string): Clause[] {
    try {
      const text = this.extractTextFromResponse(response);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      
      if (!jsonMatch) {
        return [];
      }

      const clausesData = JSON.parse(jsonMatch[0]);
      return clausesData.map((item: any, index: number) => ({
        id: `clause-${index + 1}`,
        title: item.title || '',
        content: item.content || '',
        location: this.findTextLocation(item.content.substring(0, 50), documentText),
        riskLevel: item.riskLevel || 'low',
        explanation: item.explanation || ''
      }));
    } catch (error) {
      console.error('Error parsing clauses response:', error);
      return [];
    }
  }

  /**
   * Finds the location of text within the document
   */
  private findTextLocation(searchText: string, documentText: string): TextLocation {
    const index = documentText.toLowerCase().indexOf(searchText.toLowerCase());
    return {
      startIndex: index >= 0 ? index : 0,
      endIndex: index >= 0 ? index + searchText.length : 0
    };
  }

  /**
   * Calculates overall risk score based on individual risks
   */
  private calculateOverallRiskScore(risks: Risk[]): 'low' | 'medium' | 'high' {
    if (risks.length === 0) return 'low';

    const highRisks = risks.filter(r => r.severity === 'high').length;
    const mediumRisks = risks.filter(r => r.severity === 'medium').length;

    if (highRisks >= 2) return 'high';
    if (highRisks >= 1 || mediumRisks >= 2) return 'medium';
    return 'low';
  }

  /**
   * Generates recommendations based on identified risks
   */
  private generateRecommendations(risks: Risk[], documentType: string): string[] {
    const recommendations: string[] = [];

    const highRisks = risks.filter(r => r.severity === 'high');
    if (highRisks.length > 0) {
      recommendations.push('Consider consulting with a lawyer before signing due to high-risk clauses identified.');
    }

    const financialRisks = risks.filter(r => r.category === 'financial');
    if (financialRisks.length > 0) {
      recommendations.push('Review all financial obligations and ensure you can meet the payment terms.');
    }

    const privacyRisks = risks.filter(r => r.category === 'privacy');
    if (privacyRisks.length > 0) {
      recommendations.push('Consider the privacy implications and whether you\'re comfortable with the data handling practices.');
    }

    if (recommendations.length === 0) {
      recommendations.push('The document appears to have standard terms, but always read carefully before signing.');
    }

    return recommendations;
  }

  /**
   * Combines AI-generated risks with pattern-based risks from the risk assessment service
   */
  private combineRiskAssessments(aiRisks: Risk[], patternRisks: Risk[]): Risk[] {
    const combinedRisks: Risk[] = [...patternRisks]; // Start with pattern-based risks (more reliable)
    
    // Add AI risks that don't duplicate pattern risks
    for (const aiRisk of aiRisks) {
      const isDuplicate = patternRisks.some(patternRisk => 
        patternRisk.category === aiRisk.category &&
        this.calculateRiskSimilarity(patternRisk.description, aiRisk.description) > 0.7
      );
      
      if (!isDuplicate) {
        combinedRisks.push(aiRisk);
      }
    }
    
    // Sort by severity (high first) and limit total risks
    return combinedRisks
      .sort((a, b) => {
        const severityOrder = { high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, 15); // Limit to top 15 risks to avoid overwhelming users
  }

  /**
   * Calculates similarity between two risk descriptions
   */
  private calculateRiskSimilarity(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(/\s+/);
    const words2 = desc2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 3);
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / Math.max(totalUniqueWords, 1);
  }

  /**
   * Truncates text to fit within token limits
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}