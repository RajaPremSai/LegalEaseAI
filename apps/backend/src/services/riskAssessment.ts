import { Risk, Clause, TextLocation } from '@legal-ai/shared';

export interface RiskPattern {
  id: string;
  name: string;
  category: 'financial' | 'legal' | 'privacy' | 'operational';
  severity: 'high' | 'medium' | 'low';
  patterns: string[];
  description: string;
  recommendation: string;
  documentTypes?: string[];
}

export interface RiskAssessmentResult {
  risks: Risk[];
  overallRiskScore: 'low' | 'medium' | 'high';
  riskSummary: string;
  recommendations: string[];
}

export interface ClauseRiskAnalysis {
  clause: Clause;
  risks: Risk[];
  riskScore: 'low' | 'medium' | 'high';
}

/**
 * Advanced risk assessment service for legal documents
 * Implements pattern matching, clause analysis, and risk scoring algorithms
 */
export class RiskAssessmentService {
  private riskPatterns: RiskPattern[];

  constructor() {
    this.riskPatterns = this.initializeRiskPatterns();
  }

  /**
   * Performs comprehensive risk assessment on a document
   */
  async assessDocumentRisks(
    documentText: string,
    clauses: Clause[],
    documentType: string,
    jurisdiction: string = 'US'
  ): Promise<RiskAssessmentResult> {
    // Analyze risks using multiple approaches
    const patternRisks = this.analyzeRiskPatterns(documentText, documentType);
    const clauseRisks = this.analyzeClauseRisks(clauses, documentType);
    const contextualRisks = this.analyzeContextualRisks(documentText, documentType, jurisdiction);

    // Combine and deduplicate risks
    const allRisks = [...patternRisks, ...clauseRisks, ...contextualRisks];
    const uniqueRisks = this.deduplicateRisks(allRisks);

    // Calculate overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(uniqueRisks);

    // Generate risk summary and recommendations
    const riskSummary = this.generateRiskSummary(uniqueRisks, overallRiskScore);
    const recommendations = this.generateRecommendations(uniqueRisks, documentType, overallRiskScore);

    return {
      risks: uniqueRisks,
      overallRiskScore,
      riskSummary,
      recommendations
    };
  }

  /**
   * Analyzes individual clauses for risk factors
   */
  analyzeClauseRisks(clauses: Clause[], documentType: string): Risk[] {
    const risks: Risk[] = [];

    for (const clause of clauses) {
      const clauseRisks = this.assessClauseRisk(clause, documentType);
      risks.push(...clauseRisks);
    }

    return risks;
  }

  /**
   * Analyzes a single clause for risk factors
   */
  private assessClauseRisk(clause: Clause, documentType: string): Risk[] {
    const risks: Risk[] = [];
    const clauseText = clause.content.toLowerCase();

    // Check against risk patterns
    for (const pattern of this.riskPatterns) {
      // Skip patterns not applicable to this document type
      if (pattern.documentTypes && !pattern.documentTypes.includes(documentType)) {
        continue;
      }

      for (const patternText of pattern.patterns) {
        if (clauseText.includes(patternText.toLowerCase())) {
          risks.push({
            category: pattern.category,
            severity: pattern.severity,
            description: `${pattern.description} Found in clause: "${clause.title}"`,
            affectedClause: clause.content.substring(0, 200) + (clause.content.length > 200 ? '...' : ''),
            recommendation: pattern.recommendation
          });
          break; // Only add one risk per pattern per clause
        }
      }
    }

    // Additional clause-specific risk analysis
    const additionalRisks = this.analyzeClauseSpecificRisks(clause, documentType);
    risks.push(...additionalRisks);

    return risks;
  }

  /**
   * Analyzes document text using pattern matching for known risk indicators
   */
  private analyzeRiskPatterns(documentText: string, documentType: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    for (const pattern of this.riskPatterns) {
      // Skip patterns not applicable to this document type
      if (pattern.documentTypes && !pattern.documentTypes.includes(documentType)) {
        continue;
      }

      for (const patternText of pattern.patterns) {
        if (lowerText.includes(patternText.toLowerCase())) {
          // Find the specific clause containing this pattern
          const affectedClause = this.extractAffectedClause(documentText, patternText);
          
          risks.push({
            category: pattern.category,
            severity: pattern.severity,
            description: pattern.description,
            affectedClause,
            recommendation: pattern.recommendation
          });
          break; // Only add one risk per pattern
        }
      }
    }

    return risks;
  }

  /**
   * Analyzes contextual risks based on document type and jurisdiction
   */
  private analyzeContextualRisks(
    documentText: string,
    documentType: string,
    jurisdiction: string
  ): Risk[] {
    const risks: Risk[] = [];

    // Document type specific contextual analysis
    switch (documentType) {
      case 'lease':
        risks.push(...this.analyzeLeaseContextualRisks(documentText, jurisdiction));
        break;
      case 'loan_agreement':
        risks.push(...this.analyzeLoanContextualRisks(documentText, jurisdiction));
        break;
      case 'contract':
        risks.push(...this.analyzeContractContextualRisks(documentText, jurisdiction));
        break;
      case 'terms_of_service':
        risks.push(...this.analyzeTermsContextualRisks(documentText, jurisdiction));
        break;
      case 'privacy_policy':
        risks.push(...this.analyzePrivacyContextualRisks(documentText, jurisdiction));
        break;
    }

    return risks;
  }

  /**
   * Analyzes lease-specific contextual risks
   */
  private analyzeLeaseContextualRisks(documentText: string, jurisdiction: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    // Check for missing tenant protections
    if (!lowerText.includes('security deposit') && !lowerText.includes('deposit')) {
      risks.push({
        category: 'financial',
        severity: 'medium',
        description: 'No mention of security deposit terms, which could lead to disputes',
        affectedClause: 'Document lacks security deposit clause',
        recommendation: 'Ensure security deposit terms are clearly defined before signing'
      });
    }

    // Check for automatic renewal clauses
    if (lowerText.includes('automatic renewal') || lowerText.includes('auto-renew')) {
      risks.push({
        category: 'legal',
        severity: 'medium',
        description: 'Automatic renewal clause may lock you into extended lease terms',
        affectedClause: this.extractAffectedClause(documentText, 'automatic renewal'),
        recommendation: 'Review renewal terms and ensure you can opt out with proper notice'
      });
    }

    return risks;
  }

  /**
   * Analyzes loan agreement contextual risks
   */
  private analyzeLoanContextualRisks(documentText: string, jurisdiction: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    // Check for variable interest rates
    if (lowerText.includes('variable rate') || lowerText.includes('adjustable rate')) {
      risks.push({
        category: 'financial',
        severity: 'high',
        description: 'Variable interest rate can significantly increase your payment obligations',
        affectedClause: this.extractAffectedClause(documentText, 'variable rate'),
        recommendation: 'Understand rate adjustment terms and consider fixed-rate alternatives'
      });
    }

    // Check for prepayment penalties
    if (lowerText.includes('prepayment penalty') || lowerText.includes('early payment fee')) {
      risks.push({
        category: 'financial',
        severity: 'medium',
        description: 'Prepayment penalties restrict your ability to pay off the loan early',
        affectedClause: this.extractAffectedClause(documentText, 'prepayment penalty'),
        recommendation: 'Negotiate removal of prepayment penalties if possible'
      });
    }

    return risks;
  }

  /**
   * Analyzes contract contextual risks
   */
  private analyzeContractContextualRisks(documentText: string, jurisdiction: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    // Check for broad indemnification clauses
    if (lowerText.includes('indemnify') && lowerText.includes('hold harmless')) {
      risks.push({
        category: 'legal',
        severity: 'high',
        description: 'Broad indemnification clause may make you liable for third-party claims',
        affectedClause: this.extractAffectedClause(documentText, 'indemnify'),
        recommendation: 'Limit indemnification to specific scenarios and exclude gross negligence'
      });
    }

    return risks;
  }

  /**
   * Analyzes terms of service contextual risks
   */
  private analyzeTermsContextualRisks(documentText: string, jurisdiction: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    // Check for unilateral modification rights
    if (lowerText.includes('modify these terms') && lowerText.includes('at any time')) {
      risks.push({
        category: 'legal',
        severity: 'medium',
        description: 'Service provider can change terms at any time without your consent',
        affectedClause: this.extractAffectedClause(documentText, 'modify these terms'),
        recommendation: 'Look for notification requirements and your right to terminate if terms change'
      });
    }

    return risks;
  }

  /**
   * Analyzes privacy policy contextual risks
   */
  private analyzePrivacyContextualRisks(documentText: string, jurisdiction: string): Risk[] {
    const risks: Risk[] = [];
    const lowerText = documentText.toLowerCase();

    // Check for broad data sharing
    if (lowerText.includes('share') && lowerText.includes('third parties')) {
      risks.push({
        category: 'privacy',
        severity: 'medium',
        description: 'Your personal data may be shared with third parties',
        affectedClause: this.extractAffectedClause(documentText, 'share'),
        recommendation: 'Review what data is shared and with whom, consider opting out if possible'
      });
    }

    return risks;
  }

  /**
   * Analyzes clause-specific risks beyond pattern matching
   */
  private analyzeClauseSpecificRisks(clause: Clause, documentType: string): Risk[] {
    const risks: Risk[] = [];
    const clauseText = clause.content.toLowerCase();

    // Analyze clause length and complexity
    if (clause.content.length > 1000 && clauseText.includes('provided that') && clauseText.includes('except')) {
      risks.push({
        category: 'legal',
        severity: 'medium',
        description: 'Complex clause with multiple exceptions may hide important limitations',
        affectedClause: clause.content.substring(0, 200) + '...',
        recommendation: 'Break down this clause and ensure you understand all conditions and exceptions'
      });
    }

    // Check for time-sensitive obligations
    const timePatterns = ['within \\d+ days', 'by [a-z]+ \\d+', 'no later than', 'immediately'];
    for (const pattern of timePatterns) {
      if (new RegExp(pattern).test(clauseText)) {
        risks.push({
          category: 'operational',
          severity: 'medium',
          description: 'Time-sensitive obligation that requires prompt action',
          affectedClause: clause.content.substring(0, 200) + '...',
          recommendation: 'Note all deadlines and set reminders to ensure compliance'
        });
        break;
      }
    }

    return risks;
  }

  /**
   * Calculates overall risk score based on individual risks
   */
  private calculateOverallRiskScore(risks: Risk[]): 'low' | 'medium' | 'high' {
    if (risks.length === 0) return 'low';

    const riskWeights = { high: 3, medium: 2, low: 1 };
    const totalWeight = risks.reduce((sum, risk) => sum + riskWeights[risk.severity], 0);
    const averageWeight = totalWeight / risks.length;

    const highRiskCount = risks.filter(r => r.severity === 'high').length;
    const mediumRiskCount = risks.filter(r => r.severity === 'medium').length;

    // High risk if multiple high-severity risks or very high average weight
    if (highRiskCount >= 2 || averageWeight >= 2.5) return 'high';
    
    // Medium risk if any high-severity risk or multiple medium risks
    if (highRiskCount >= 1 || mediumRiskCount >= 3 || averageWeight >= 1.8) return 'medium';
    
    return 'low';
  }

  /**
   * Generates a summary of identified risks
   */
  private generateRiskSummary(risks: Risk[], overallRiskScore: 'low' | 'medium' | 'high'): string {
    if (risks.length === 0) {
      return 'No significant risks identified in this document.';
    }

    const riskCounts = {
      high: risks.filter(r => r.severity === 'high').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      low: risks.filter(r => r.severity === 'low').length
    };

    const categoryBreakdown = risks.reduce((acc, risk) => {
      acc[risk.category] = (acc[risk.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    let summary = `Overall risk level: ${overallRiskScore.toUpperCase()}. `;
    summary += `Found ${risks.length} potential risk${risks.length > 1 ? 's' : ''}: `;
    
    const severityParts = [];
    if (riskCounts.high > 0) severityParts.push(`${riskCounts.high} high-severity`);
    if (riskCounts.medium > 0) severityParts.push(`${riskCounts.medium} medium-severity`);
    if (riskCounts.low > 0) severityParts.push(`${riskCounts.low} low-severity`);
    
    summary += severityParts.join(', ') + '. ';

    const topCategories = Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 2)
      .map(([category, count]) => `${category} (${count})`);
    
    if (topCategories.length > 0) {
      summary += `Primary risk areas: ${topCategories.join(', ')}.`;
    }

    return summary;
  }

  /**
   * Generates specific recommendations based on identified risks
   */
  private generateRecommendations(
    risks: Risk[],
    documentType: string,
    overallRiskScore: 'low' | 'medium' | 'high'
  ): string[] {
    const recommendations: string[] = [];

    // Overall risk-based recommendations
    if (overallRiskScore === 'high') {
      recommendations.push('⚠️ HIGH RISK: Strongly consider consulting with a lawyer before signing this document.');
    } else if (overallRiskScore === 'medium') {
      recommendations.push('⚠️ MEDIUM RISK: Review carefully and consider legal consultation for complex terms.');
    }

    // Category-specific recommendations
    const highFinancialRisks = risks.filter(r => r.category === 'financial' && r.severity === 'high');
    if (highFinancialRisks.length > 0) {
      recommendations.push('💰 Review all financial obligations carefully and ensure you can meet payment terms.');
    }

    const privacyRisks = risks.filter(r => r.category === 'privacy');
    if (privacyRisks.length > 0) {
      recommendations.push('🔒 Consider privacy implications and whether you\'re comfortable with data handling practices.');
    }

    const legalRisks = risks.filter(r => r.category === 'legal' && r.severity === 'high');
    if (legalRisks.length > 0) {
      recommendations.push('⚖️ Pay special attention to legal obligations and dispute resolution terms.');
    }

    // Document type-specific recommendations
    switch (documentType) {
      case 'lease':
        recommendations.push('🏠 Verify all lease terms including rent, deposits, and maintenance responsibilities.');
        break;
      case 'loan_agreement':
        recommendations.push('💳 Understand all interest rates, fees, and repayment terms before committing.');
        break;
      case 'terms_of_service':
        recommendations.push('📱 Review what rights you\'re granting and what happens to your data.');
        break;
    }

    // Add specific risk recommendations (top 3 most severe)
    const topRisks = risks
      .filter(r => r.severity === 'high')
      .slice(0, 3);
    
    for (const risk of topRisks) {
      if (risk.recommendation && !recommendations.includes(risk.recommendation)) {
        recommendations.push(`🎯 ${risk.recommendation}`);
      }
    }

    // Default recommendation if none added
    if (recommendations.length === 0) {
      recommendations.push('✅ Document appears to have standard terms, but always read carefully before signing.');
    }

    return recommendations.slice(0, 8); // Limit to 8 recommendations
  }

  /**
   * Removes duplicate risks based on description similarity
   */
  private deduplicateRisks(risks: Risk[]): Risk[] {
    const uniqueRisks: Risk[] = [];
    
    for (const risk of risks) {
      const isDuplicate = uniqueRisks.some(existing => 
        existing.category === risk.category &&
        existing.severity === risk.severity &&
        this.calculateSimilarity(existing.description, risk.description) > 0.8
      );
      
      if (!isDuplicate) {
        uniqueRisks.push(risk);
      }
    }
    
    return uniqueRisks;
  }

  /**
   * Calculates similarity between two strings (simple implementation)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  /**
   * Extracts the clause or sentence containing a specific pattern
   */
  private extractAffectedClause(documentText: string, pattern: string): string {
    const sentences = documentText.split(/[.!?]+/);
    const matchingSentence = sentences.find(sentence => 
      sentence.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (matchingSentence) {
      return matchingSentence.trim().substring(0, 300) + 
        (matchingSentence.length > 300 ? '...' : '');
    }
    
    // Fallback: return context around the pattern
    const index = documentText.toLowerCase().indexOf(pattern.toLowerCase());
    if (index >= 0) {
      const start = Math.max(0, index - 100);
      const end = Math.min(documentText.length, index + pattern.length + 100);
      return '...' + documentText.substring(start, end) + '...';
    }
    
    return 'Pattern found in document';
  }

  /**
   * Initializes the comprehensive risk pattern database
   */
  private initializeRiskPatterns(): RiskPattern[] {
    return [
      // Financial Risk Patterns
      {
        id: 'unlimited-liability',
        name: 'Unlimited Liability',
        category: 'financial',
        severity: 'high',
        patterns: ['unlimited liability', 'unlimited damages', 'without limitation'],
        description: 'You may be liable for unlimited damages or losses',
        recommendation: 'Negotiate caps on liability or exclude consequential damages'
      },
      {
        id: 'automatic-renewal',
        name: 'Automatic Renewal',
        category: 'financial',
        severity: 'medium',
        patterns: ['automatic renewal', 'auto-renew', 'automatically renew'],
        description: 'Contract automatically renews, potentially locking you into unwanted terms',
        recommendation: 'Ensure you can cancel before renewal and understand notice requirements'
      },
      {
        id: 'penalty-fees',
        name: 'Penalty Fees',
        category: 'financial',
        severity: 'medium',
        patterns: ['penalty fee', 'late fee', 'cancellation fee', 'early termination fee'],
        description: 'Significant fees may apply for late payments or early termination',
        recommendation: 'Understand all fee structures and when they apply'
      },
      {
        id: 'variable-pricing',
        name: 'Variable Pricing',
        category: 'financial',
        severity: 'medium',
        patterns: ['subject to change', 'may increase', 'variable rate', 'adjustable'],
        description: 'Pricing or rates may change during the contract term',
        recommendation: 'Understand how and when prices can change, seek caps if possible'
      },

      // Legal Risk Patterns
      {
        id: 'broad-indemnification',
        name: 'Broad Indemnification',
        category: 'legal',
        severity: 'high',
        patterns: ['indemnify and hold harmless', 'defend, indemnify', 'indemnification'],
        description: 'You may be required to cover legal costs and damages for the other party',
        recommendation: 'Limit indemnification scope and exclude gross negligence or willful misconduct'
      },
      {
        id: 'mandatory-arbitration',
        name: 'Mandatory Arbitration',
        category: 'legal',
        severity: 'medium',
        patterns: ['binding arbitration', 'mandatory arbitration', 'waive right to jury trial'],
        description: 'You cannot sue in court and must use arbitration for disputes',
        recommendation: 'Understand arbitration process and consider if you\'re comfortable waiving court rights'
      },
      {
        id: 'class-action-waiver',
        name: 'Class Action Waiver',
        category: 'legal',
        severity: 'medium',
        patterns: ['class action waiver', 'waive class action', 'individual basis only'],
        description: 'You cannot join class action lawsuits against the other party',
        recommendation: 'Consider whether individual arbitration is adequate for potential disputes'
      },
      {
        id: 'unilateral-modification',
        name: 'Unilateral Modification Rights',
        category: 'legal',
        severity: 'medium',
        patterns: ['modify at any time', 'change these terms', 'unilateral right to modify'],
        description: 'The other party can change contract terms without your agreement',
        recommendation: 'Ensure you receive notice of changes and have right to terminate'
      },

      // Privacy Risk Patterns
      {
        id: 'broad-data-collection',
        name: 'Broad Data Collection',
        category: 'privacy',
        severity: 'medium',
        patterns: ['collect personal information', 'any information', 'all data'],
        description: 'Extensive personal data may be collected beyond what\'s necessary',
        recommendation: 'Review what specific data is collected and why it\'s needed'
      },
      {
        id: 'third-party-sharing',
        name: 'Third Party Data Sharing',
        category: 'privacy',
        severity: 'high',
        patterns: ['share with third parties', 'sell your information', 'disclose to partners'],
        description: 'Your personal data may be shared or sold to other companies',
        recommendation: 'Understand who receives your data and opt out if possible'
      },
      {
        id: 'indefinite-retention',
        name: 'Indefinite Data Retention',
        category: 'privacy',
        severity: 'medium',
        patterns: ['retain indefinitely', 'keep forever', 'no deletion'],
        description: 'Your data may be kept indefinitely without deletion rights',
        recommendation: 'Request data deletion rights and reasonable retention periods'
      },

      // Operational Risk Patterns
      {
        id: 'exclusive-dealing',
        name: 'Exclusive Dealing Requirements',
        category: 'operational',
        severity: 'medium',
        patterns: ['exclusively', 'sole provider', 'cannot use competitors'],
        description: 'You may be restricted from using competing services or providers',
        recommendation: 'Consider if exclusivity restrictions are reasonable for your needs'
      },
      {
        id: 'broad-restrictions',
        name: 'Broad Use Restrictions',
        category: 'operational',
        severity: 'medium',
        patterns: ['prohibited uses', 'may not use', 'restricted activities'],
        description: 'Extensive restrictions on how you can use the service or product',
        recommendation: 'Ensure restrictions don\'t interfere with your intended use'
      },
      {
        id: 'compliance-obligations',
        name: 'Complex Compliance Requirements',
        category: 'operational',
        severity: 'medium',
        patterns: ['comply with all laws', 'regulatory compliance', 'certification required'],
        description: 'You may have ongoing compliance obligations that could be costly',
        recommendation: 'Understand all compliance requirements and associated costs'
      },

      // Document-specific patterns
      {
        id: 'lease-joint-liability',
        name: 'Joint and Several Liability',
        category: 'financial',
        severity: 'high',
        patterns: ['joint and several', 'jointly and severally liable'],
        description: 'Each tenant is responsible for the full rent amount, not just their share',
        recommendation: 'Understand that you could be liable for roommates\' unpaid rent',
        documentTypes: ['lease']
      },
      {
        id: 'loan-cross-default',
        name: 'Cross-Default Provisions',
        category: 'financial',
        severity: 'high',
        patterns: ['cross-default', 'default under other agreements'],
        description: 'Default on other loans could trigger default on this loan',
        recommendation: 'Understand how other financial obligations could affect this loan',
        documentTypes: ['loan_agreement']
      }
    ];
  }
}