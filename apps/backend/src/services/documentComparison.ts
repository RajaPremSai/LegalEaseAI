const { v4: uuidv4 } = require('uuid');
import { DocumentVersion, DocumentComparison, DocumentChange, ImpactAnalysis, SignificantChange, TextLocation } from '@legal-ai/shared';

/**
 * Document comparison service that implements text diff algorithms
 * and impact analysis for document versions
 */
export class DocumentComparisonService {
  /**
   * Compare two document versions and generate a detailed comparison
   */
  async compareDocuments(
    originalVersion: DocumentVersion,
    comparedVersion: DocumentVersion
  ): Promise<DocumentComparison> {
    const changes = await this.detectChanges(
      originalVersion.metadata.extractedText,
      comparedVersion.metadata.extractedText
    );

    const impactAnalysis = await this.analyzeImpact(
      changes,
      originalVersion.analysis,
      comparedVersion.analysis
    );

    return {
      id: uuidv4(),
      originalVersionId: originalVersion.id,
      comparedVersionId: comparedVersion.id,
      comparedAt: new Date(),
      changes,
      impactAnalysis,
    };
  }

  /**
   * Detect changes between two text documents using diff algorithms
   */
  private async detectChanges(originalText: string, comparedText: string): Promise<DocumentChange[]> {
    const changes: DocumentChange[] = [];
    
    // Split texts into sentences for more granular comparison
    const originalSentences = this.splitIntoSentences(originalText);
    const comparedSentences = this.splitIntoSentences(comparedText);

    // Use Myers diff algorithm implementation
    const diffResult = this.computeDiff(originalSentences, comparedSentences);

    let originalIndex = 0;
    let comparedIndex = 0;

    for (const operation of diffResult) {
      switch (operation.type) {
        case 'deletion':
          changes.push({
            id: uuidv4(),
            type: 'deletion',
            originalText: operation.text,
            location: this.calculateTextLocation(originalText, operation.text, originalIndex),
            severity: this.assessChangeSeverity(operation.text),
            description: `Deleted text: "${this.truncateText(operation.text, 100)}"`,
          });
          originalIndex++;
          break;

        case 'addition':
          changes.push({
            id: uuidv4(),
            type: 'addition',
            newText: operation.text,
            location: this.calculateTextLocation(comparedText, operation.text, comparedIndex),
            severity: this.assessChangeSeverity(operation.text),
            description: `Added text: "${this.truncateText(operation.text, 100)}"`,
          });
          comparedIndex++;
          break;

        case 'modification':
          changes.push({
            id: uuidv4(),
            type: 'modification',
            originalText: operation.originalText,
            newText: operation.newText,
            location: this.calculateTextLocation(comparedText, operation.newText!, comparedIndex),
            severity: this.assessChangeSeverity(operation.newText!),
            description: `Modified text from "${this.truncateText(operation.originalText!, 50)}" to "${this.truncateText(operation.newText!, 50)}"`,
          });
          originalIndex++;
          comparedIndex++;
          break;

        case 'equal':
          originalIndex++;
          comparedIndex++;
          break;
      }
    }

    return changes;
  }

  /**
   * Split text into sentences for comparison
   */
  private splitIntoSentences(text: string): string[] {
    // Enhanced sentence splitting that handles legal document formatting
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n\n)|(?<=\d+\.\s)|(?<=\([a-z]\)\s)/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);
  }

  /**
   * Compute diff using a simplified Myers algorithm
   */
  private computeDiff(original: string[], compared: string[]): DiffOperation[] {
    const operations: DiffOperation[] = [];
    const dp: number[][] = [];
    
    // Initialize DP table
    for (let i = 0; i <= original.length; i++) {
      dp[i] = [];
      for (let j = 0; j <= compared.length; j++) {
        dp[i][j] = 0;
      }
    }

    // Fill DP table with LCS lengths
    for (let i = 1; i <= original.length; i++) {
      for (let j = 1; j <= compared.length; j++) {
        if (this.textSimilarity(original[i - 1], compared[j - 1]) > 0.8) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to find operations
    let i = original.length;
    let j = compared.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && this.textSimilarity(original[i - 1], compared[j - 1]) > 0.8) {
        // Check if it's a modification or equal
        if (original[i - 1] === compared[j - 1]) {
          operations.unshift({ type: 'equal', text: original[i - 1] });
        } else {
          operations.unshift({
            type: 'modification',
            originalText: original[i - 1],
            newText: compared[j - 1],
          });
        }
        i--;
        j--;
      } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
        operations.unshift({ type: 'deletion', text: original[i - 1] });
        i--;
      } else {
        operations.unshift({ type: 'addition', text: compared[j - 1] });
        j--;
      }
    }

    return operations;
  }

  /**
   * Calculate text similarity using Jaccard similarity
   */
  private textSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate text location within document
   */
  private calculateTextLocation(fullText: string, searchText: string, approximateIndex: number): TextLocation {
    const startIndex = fullText.indexOf(searchText);
    if (startIndex === -1) {
      // Fallback to approximate position
      const textLength = fullText.length;
      const approximatePosition = Math.floor((approximateIndex / 100) * textLength);
      return {
        startIndex: approximatePosition,
        endIndex: approximatePosition + searchText.length,
      };
    }

    return {
      startIndex,
      endIndex: startIndex + searchText.length,
    };
  }

  /**
   * Assess the severity of a change based on content analysis
   */
  private assessChangeSeverity(text: string): 'low' | 'medium' | 'high' {
    const highRiskKeywords = [
      'liability', 'penalty', 'termination', 'breach', 'damages', 'indemnify',
      'payment', 'fee', 'cost', 'price', 'amount', 'obligation', 'responsibility'
    ];
    
    const mediumRiskKeywords = [
      'notice', 'consent', 'approval', 'right', 'privilege', 'access',
      'confidential', 'proprietary', 'intellectual property'
    ];

    const lowerText = text.toLowerCase();
    
    if (highRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    }
    
    if (mediumRiskKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Analyze the impact of changes between document versions
   */
  private async analyzeImpact(
    changes: DocumentChange[],
    originalAnalysis?: any,
    comparedAnalysis?: any
  ): Promise<ImpactAnalysis> {
    const significantChanges: SignificantChange[] = [];
    let riskScoreChange = 0;

    // Calculate risk score change if both analyses exist
    if (originalAnalysis && comparedAnalysis) {
      const originalRiskValue = this.riskScoreToNumber(originalAnalysis.riskScore);
      const comparedRiskValue = this.riskScoreToNumber(comparedAnalysis.riskScore);
      riskScoreChange = comparedRiskValue - originalRiskValue;
    }

    // Analyze significant changes
    for (const change of changes) {
      if (change.severity === 'high') {
        const significantChange = await this.categorizeChange(change);
        if (significantChange) {
          significantChanges.push(significantChange);
        }
      }
    }

    // Determine overall impact
    const overallImpact = this.determineOverallImpact(significantChanges, riskScoreChange);

    // Generate summary
    const summary = this.generateImpactSummary(changes, significantChanges, riskScoreChange);

    return {
      overallImpact,
      riskScoreChange,
      significantChanges,
      summary,
    };
  }

  /**
   * Convert risk score to numerical value for comparison
   */
  private riskScoreToNumber(riskScore: string): number {
    switch (riskScore) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      default: return 1;
    }
  }

  /**
   * Categorize a change into legal categories
   */
  private async categorizeChange(change: DocumentChange): Promise<SignificantChange | null> {
    const text = change.newText || change.originalText || '';
    const lowerText = text.toLowerCase();

    let category: SignificantChange['category'];
    let impact: SignificantChange['impact'] = 'neutral';
    let recommendation: string | undefined;

    // Categorize based on content
    if (lowerText.includes('payment') || lowerText.includes('fee') || lowerText.includes('cost')) {
      category = 'financial';
      impact = change.type === 'addition' ? 'unfavorable' : 'favorable';
      recommendation = 'Review financial implications carefully before agreeing.';
    } else if (lowerText.includes('right') || lowerText.includes('privilege')) {
      category = 'rights';
      impact = change.type === 'deletion' ? 'unfavorable' : 'favorable';
      recommendation = 'Ensure you understand how this affects your rights.';
    } else if (lowerText.includes('obligation') || lowerText.includes('responsibility') || lowerText.includes('must')) {
      category = 'obligations';
      impact = change.type === 'addition' ? 'unfavorable' : 'favorable';
      recommendation = 'Consider whether you can fulfill these obligations.';
    } else if (lowerText.includes('confidential') || lowerText.includes('privacy') || lowerText.includes('data')) {
      category = 'privacy';
      impact = 'neutral'; // Requires case-by-case analysis
      recommendation = 'Review privacy implications and data handling requirements.';
    } else if (lowerText.includes('liability') || lowerText.includes('damages') || lowerText.includes('indemnify')) {
      category = 'legal';
      impact = change.type === 'addition' ? 'unfavorable' : 'favorable';
      recommendation = 'Consider consulting a legal professional about liability implications.';
    } else {
      return null; // Not a significant change we can categorize
    }

    return {
      changeId: change.id,
      category,
      impact,
      description: change.description,
      recommendation,
    };
  }

  /**
   * Determine overall impact based on significant changes and risk score change
   */
  private determineOverallImpact(
    significantChanges: SignificantChange[],
    riskScoreChange: number
  ): 'favorable' | 'unfavorable' | 'neutral' {
    const favorableCount = significantChanges.filter(c => c.impact === 'favorable').length;
    const unfavorableCount = significantChanges.filter(c => c.impact === 'unfavorable').length;

    // Factor in risk score change
    if (riskScoreChange > 0.5) {
      return 'unfavorable';
    } else if (riskScoreChange < -0.5) {
      return 'favorable';
    }

    // Factor in significant changes
    if (unfavorableCount > favorableCount) {
      return 'unfavorable';
    } else if (favorableCount > unfavorableCount) {
      return 'favorable';
    }

    return 'neutral';
  }

  /**
   * Generate a human-readable summary of the impact analysis
   */
  private generateImpactSummary(
    changes: DocumentChange[],
    significantChanges: SignificantChange[],
    riskScoreChange: number
  ): string {
    const totalChanges = changes.length;
    const highSeverityChanges = changes.filter(c => c.severity === 'high').length;
    
    let summary = `Found ${totalChanges} changes between document versions`;
    
    if (highSeverityChanges > 0) {
      summary += `, including ${highSeverityChanges} high-severity changes`;
    }
    
    if (riskScoreChange !== 0) {
      const direction = riskScoreChange > 0 ? 'increased' : 'decreased';
      summary += `. Overall risk level has ${direction}`;
    }
    
    if (significantChanges.length > 0) {
      const categories = [...new Set(significantChanges.map(c => c.category))];
      summary += `. Significant changes affect: ${categories.join(', ')}`;
    }
    
    summary += '.';
    
    return summary;
  }

  /**
   * Truncate text for display purposes
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }
}

// Types for diff operations
interface DiffOperation {
  type: 'addition' | 'deletion' | 'modification' | 'equal';
  text?: string;
  originalText?: string;
  newText?: string;
}

export default DocumentComparisonService;