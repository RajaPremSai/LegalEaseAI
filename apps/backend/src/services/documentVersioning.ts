import { DocumentVersion, DocumentComparison, Document } from '@legal-ai/shared';
import { DocumentVersionRepository } from '../database/repositories/documentVersionRepository';
import { DocumentComparisonService } from './documentComparison';
const { v4: uuidv4 } = require('uuid');

/**
 * Service for managing document versions and history
 */
export class DocumentVersioningService {
  constructor(
    private versionRepository: DocumentVersionRepository,
    private comparisonService: DocumentComparisonService
  ) {}

  /**
   * Create a new version of a document
   */
  async createVersion(
    documentId: string,
    filename: string,
    metadata: any,
    analysis?: any,
    parentVersionId?: string
  ): Promise<DocumentVersion> {
    const versionNumber = await this.versionRepository.getNextVersionNumber(documentId);

    const version: Omit<DocumentVersion, 'id'> = {
      documentId,
      versionNumber,
      filename,
      uploadedAt: new Date(),
      metadata,
      analysis,
      parentVersionId,
    };

    return await this.versionRepository.createVersion(version);
  }

  /**
   * Get version history for a document
   */
  async getVersionHistory(documentId: string): Promise<DocumentVersionHistory> {
    const versions = await this.versionRepository.getVersionsByDocumentId(documentId);
    const comparisons = await this.versionRepository.getComparisonsByDocumentId(documentId);

    // Build timeline with versions and comparisons
    const timeline = this.buildTimeline(versions, comparisons);

    return {
      documentId,
      versions,
      comparisons,
      timeline,
      currentVersion: versions[versions.length - 1] || null,
    };
  }

  /**
   * Compare two versions of a document
   */
  async compareVersions(
    originalVersionId: string,
    comparedVersionId: string
  ): Promise<DocumentComparison> {
    // Check if comparison already exists
    const existingComparison = await this.versionRepository.getComparison(
      originalVersionId,
      comparedVersionId
    );

    if (existingComparison) {
      return existingComparison;
    }

    // Get the versions
    const originalVersion = await this.versionRepository.getVersionById(originalVersionId);
    const comparedVersion = await this.versionRepository.getVersionById(comparedVersionId);

    if (!originalVersion || !comparedVersion) {
      throw new Error('One or both versions not found');
    }

    // Perform comparison
    const comparison = await this.comparisonService.compareDocuments(
      originalVersion,
      comparedVersion
    );

    // Save comparison for future use
    await this.versionRepository.saveComparison(comparison);

    return comparison;
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(versionId: string): Promise<DocumentVersion | null> {
    return await this.versionRepository.getVersionById(versionId);
  }

  /**
   * Get the latest version of a document
   */
  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    return await this.versionRepository.getLatestVersion(documentId);
  }

  /**
   * Rollback to a previous version (creates a new version based on an old one)
   */
  async rollbackToVersion(
    documentId: string,
    targetVersionId: string,
    filename: string
  ): Promise<DocumentVersion> {
    const targetVersion = await this.versionRepository.getVersionById(targetVersionId);
    if (!targetVersion) {
      throw new Error('Target version not found');
    }

    if (targetVersion.documentId !== documentId) {
      throw new Error('Version does not belong to the specified document');
    }

    // Create a new version based on the target version
    const newVersion = await this.createVersion(
      documentId,
      filename,
      targetVersion.metadata,
      targetVersion.analysis,
      targetVersionId // Set the target version as parent
    );

    return newVersion;
  }

  /**
   * Get version differences between consecutive versions
   */
  async getVersionDifferences(documentId: string): Promise<VersionDifference[]> {
    const versions = await this.versionRepository.getVersionsByDocumentId(documentId);
    const differences: VersionDifference[] = [];

    for (let i = 1; i < versions.length; i++) {
      const previousVersion = versions[i - 1];
      const currentVersion = versions[i];

      const comparison = await this.compareVersions(previousVersion.id, currentVersion.id);

      differences.push({
        fromVersion: previousVersion.versionNumber,
        toVersion: currentVersion.versionNumber,
        fromVersionId: previousVersion.id,
        toVersionId: currentVersion.id,
        changesCount: comparison.changes.length,
        significantChangesCount: comparison.impactAnalysis.significantChanges.length,
        overallImpact: comparison.impactAnalysis.overallImpact,
        riskScoreChange: comparison.impactAnalysis.riskScoreChange,
        comparedAt: comparison.comparedAt,
      });
    }

    return differences;
  }

  /**
   * Get version statistics for a document
   */
  async getVersionStatistics(documentId: string): Promise<VersionStatistics> {
    const versions = await this.versionRepository.getVersionsByDocumentId(documentId);
    const differences = await this.getVersionDifferences(documentId);

    const totalChanges = differences.reduce((sum, diff) => sum + diff.changesCount, 0);
    const totalSignificantChanges = differences.reduce(
      (sum, diff) => sum + diff.significantChangesCount,
      0
    );

    const riskTrend = this.calculateRiskTrend(versions);
    const mostActiveVersion = this.findMostActiveVersion(differences);

    return {
      documentId,
      totalVersions: versions.length,
      totalChanges,
      totalSignificantChanges,
      riskTrend,
      mostActiveVersion,
      firstVersion: versions[0] || null,
      latestVersion: versions[versions.length - 1] || null,
      averageChangesPerVersion: versions.length > 1 ? totalChanges / (versions.length - 1) : 0,
    };
  }

  /**
   * Clean up old versions (for maintenance)
   */
  async cleanupOldVersions(retentionDays: number = 30): Promise<CleanupResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedVersions = await this.versionRepository.deleteVersionsOlderThan(cutoffDate);
    const deletedComparisons = await this.versionRepository.deleteComparisonsOlderThan(cutoffDate);

    return {
      deletedVersions,
      deletedComparisons,
      cutoffDate,
    };
  }

  /**
   * Build a timeline of document changes
   */
  private buildTimeline(
    versions: DocumentVersion[],
    comparisons: DocumentComparison[]
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    // Add version events
    versions.forEach(version => {
      events.push({
        type: 'version_created',
        timestamp: version.uploadedAt,
        versionId: version.id,
        versionNumber: version.versionNumber,
        description: `Version ${version.versionNumber} created: ${version.filename}`,
      });
    });

    // Add comparison events
    comparisons.forEach(comparison => {
      const originalVersion = versions.find(v => v.id === comparison.originalVersionId);
      const comparedVersion = versions.find(v => v.id === comparison.comparedVersionId);

      if (originalVersion && comparedVersion) {
        events.push({
          type: 'comparison_made',
          timestamp: comparison.comparedAt,
          comparisonId: comparison.id,
          description: `Compared version ${originalVersion.versionNumber} with version ${comparedVersion.versionNumber}`,
          metadata: {
            changesCount: comparison.changes.length,
            overallImpact: comparison.impactAnalysis.overallImpact,
          },
        });
      }
    });

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Calculate risk trend across versions
   */
  private calculateRiskTrend(versions: DocumentVersion[]): 'increasing' | 'decreasing' | 'stable' {
    const versionsWithAnalysis = versions.filter(v => v.analysis);
    if (versionsWithAnalysis.length < 2) {
      return 'stable';
    }

    const riskScores = versionsWithAnalysis.map(v => this.riskScoreToNumber(v.analysis!.riskScore));
    const firstScore = riskScores[0];
    const lastScore = riskScores[riskScores.length - 1];

    if (lastScore > firstScore) {
      return 'increasing';
    } else if (lastScore < firstScore) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Find the version with the most changes
   */
  private findMostActiveVersion(differences: VersionDifference[]): number | null {
    if (differences.length === 0) {
      return null;
    }

    const mostActive = differences.reduce((max, current) =>
      current.changesCount > max.changesCount ? current : max
    );

    return mostActive.toVersion;
  }

  /**
   * Convert risk score to numerical value
   */
  private riskScoreToNumber(riskScore: string): number {
    switch (riskScore) {
      case 'low': return 1;
      case 'medium': return 2;
      case 'high': return 3;
      default: return 1;
    }
  }
}

// Types for version management
export interface DocumentVersionHistory {
  documentId: string;
  versions: DocumentVersion[];
  comparisons: DocumentComparison[];
  timeline: TimelineEvent[];
  currentVersion: DocumentVersion | null;
}

export interface VersionDifference {
  fromVersion: number;
  toVersion: number;
  fromVersionId: string;
  toVersionId: string;
  changesCount: number;
  significantChangesCount: number;
  overallImpact: 'favorable' | 'unfavorable' | 'neutral';
  riskScoreChange: number;
  comparedAt: Date;
}

export interface VersionStatistics {
  documentId: string;
  totalVersions: number;
  totalChanges: number;
  totalSignificantChanges: number;
  riskTrend: 'increasing' | 'decreasing' | 'stable';
  mostActiveVersion: number | null;
  firstVersion: DocumentVersion | null;
  latestVersion: DocumentVersion | null;
  averageChangesPerVersion: number;
}

export interface TimelineEvent {
  type: 'version_created' | 'comparison_made';
  timestamp: Date;
  versionId?: string;
  versionNumber?: number;
  comparisonId?: string;
  description: string;
  metadata?: any;
}

export interface CleanupResult {
  deletedVersions: number;
  deletedComparisons: number;
  cutoffDate: Date;
}

export default DocumentVersioningService;