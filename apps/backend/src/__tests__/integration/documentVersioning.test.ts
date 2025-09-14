import request from 'supertest';
import { DocumentVersioningService } from '../../services/documentVersioning';
import { DocumentComparisonService } from '../../services/documentComparison';
import { DocumentVersionRepository } from '../../database/repositories/documentVersionRepository';
import { DocumentVersion, DocumentAnalysis } from '@legal-ai/shared';

// Mock the database and services
jest.mock('../../database/repositories/documentVersionRepository');
jest.mock('../../services/documentComparison');
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
}));

describe('DocumentVersioningService Integration Tests', () => {
  let versioningService: DocumentVersioningService;
  let mockVersionRepository: jest.Mocked<DocumentVersionRepository>;
  let mockComparisonService: jest.Mocked<DocumentComparisonService>;

  beforeEach(() => {
    mockVersionRepository = new DocumentVersionRepository({} as any) as jest.Mocked<DocumentVersionRepository>;
    mockComparisonService = new DocumentComparisonService() as jest.Mocked<DocumentComparisonService>;
    versioningService = new DocumentVersioningService(mockVersionRepository, mockComparisonService);
  });

  describe('createVersion', () => {
    it('should create a new version with correct version number', async () => {
      const documentId = 'doc-123';
      const filename = 'contract-v2.pdf';
      const metadata = {
        pageCount: 5,
        wordCount: 1000,
        language: 'en',
        extractedText: 'Contract text here...',
      };

      mockVersionRepository.getNextVersionNumber.mockResolvedValue(2);
      mockVersionRepository.createVersion.mockResolvedValue({
        id: 'version-123',
        documentId,
        versionNumber: 2,
        filename,
        uploadedAt: new Date(),
        metadata,
      });

      const result = await versioningService.createVersion(documentId, filename, metadata);

      expect(mockVersionRepository.getNextVersionNumber).toHaveBeenCalledWith(documentId);
      expect(mockVersionRepository.createVersion).toHaveBeenCalledWith({
        documentId,
        versionNumber: 2,
        filename,
        uploadedAt: expect.any(Date),
        metadata,
        analysis: undefined,
        parentVersionId: undefined,
      });
      expect(result.versionNumber).toBe(2);
    });

    it('should create version with parent reference', async () => {
      const documentId = 'doc-123';
      const filename = 'contract-v3.pdf';
      const metadata = { pageCount: 5, wordCount: 1000, language: 'en', extractedText: 'Text' };
      const parentVersionId = 'version-456';

      mockVersionRepository.getNextVersionNumber.mockResolvedValue(3);
      mockVersionRepository.createVersion.mockResolvedValue({
        id: 'version-789',
        documentId,
        versionNumber: 3,
        filename,
        uploadedAt: new Date(),
        metadata,
        parentVersionId,
      });

      const result = await versioningService.createVersion(
        documentId,
        filename,
        metadata,
        undefined,
        parentVersionId
      );

      expect(result.parentVersionId).toBe(parentVersionId);
    });
  });

  describe('getVersionHistory', () => {
    it('should return complete version history with timeline', async () => {
      const documentId = 'doc-123';
      const versions: DocumentVersion[] = [
        {
          id: 'version-1',
          documentId,
          versionNumber: 1,
          filename: 'contract-v1.pdf',
          uploadedAt: new Date('2023-01-01'),
          metadata: { pageCount: 3, wordCount: 500, language: 'en', extractedText: 'Text 1' },
        },
        {
          id: 'version-2',
          documentId,
          versionNumber: 2,
          filename: 'contract-v2.pdf',
          uploadedAt: new Date('2023-01-02'),
          metadata: { pageCount: 4, wordCount: 600, language: 'en', extractedText: 'Text 2' },
        },
      ];

      const comparisons = [
        {
          id: 'comp-1',
          originalVersionId: 'version-1',
          comparedVersionId: 'version-2',
          comparedAt: new Date('2023-01-03'),
          changes: [],
          impactAnalysis: {
            overallImpact: 'neutral' as const,
            riskScoreChange: 0,
            significantChanges: [],
            summary: 'No significant changes',
          },
        },
      ];

      mockVersionRepository.getVersionsByDocumentId.mockResolvedValue(versions);
      mockVersionRepository.getComparisonsByDocumentId.mockResolvedValue(comparisons);

      const result = await versioningService.getVersionHistory(documentId);

      expect(result.documentId).toBe(documentId);
      expect(result.versions).toHaveLength(2);
      expect(result.comparisons).toHaveLength(1);
      expect(result.timeline).toHaveLength(3); // 2 versions + 1 comparison
      expect(result.currentVersion).toBe(versions[1]);
    });
  });

  describe('compareVersions', () => {
    it('should return existing comparison if available', async () => {
      const originalVersionId = 'version-1';
      const comparedVersionId = 'version-2';
      const existingComparison = {
        id: 'comp-1',
        originalVersionId,
        comparedVersionId,
        comparedAt: new Date(),
        changes: [],
        impactAnalysis: {
          overallImpact: 'neutral' as const,
          riskScoreChange: 0,
          significantChanges: [],
          summary: 'Cached comparison',
        },
      };

      mockVersionRepository.getComparison.mockResolvedValue(existingComparison);

      const result = await versioningService.compareVersions(originalVersionId, comparedVersionId);

      expect(result).toBe(existingComparison);
      expect(mockVersionRepository.getComparison).toHaveBeenCalledWith(
        originalVersionId,
        comparedVersionId
      );
    });

    it('should create new comparison if none exists', async () => {
      const originalVersionId = 'version-1';
      const comparedVersionId = 'version-2';
      
      const originalVersion: DocumentVersion = {
        id: originalVersionId,
        documentId: 'doc-123',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: { pageCount: 3, wordCount: 500, language: 'en', extractedText: 'Original text' },
      };

      const comparedVersion: DocumentVersion = {
        id: comparedVersionId,
        documentId: 'doc-123',
        versionNumber: 2,
        filename: 'contract-v2.pdf',
        uploadedAt: new Date(),
        metadata: { pageCount: 4, wordCount: 600, language: 'en', extractedText: 'Modified text' },
      };

      const newComparison = {
        id: 'comp-new',
        originalVersionId,
        comparedVersionId,
        comparedAt: new Date(),
        changes: [],
        impactAnalysis: {
          overallImpact: 'neutral' as const,
          riskScoreChange: 0,
          significantChanges: [],
          summary: 'New comparison',
        },
      };

      mockVersionRepository.getComparison.mockResolvedValue(null);
      mockVersionRepository.getVersionById
        .mockResolvedValueOnce(originalVersion)
        .mockResolvedValueOnce(comparedVersion);
      mockComparisonService.compareDocuments.mockResolvedValue(newComparison);
      mockVersionRepository.saveComparison.mockResolvedValue();

      const result = await versioningService.compareVersions(originalVersionId, comparedVersionId);

      expect(result).toBe(newComparison);
      expect(mockComparisonService.compareDocuments).toHaveBeenCalledWith(
        originalVersion,
        comparedVersion
      );
      expect(mockVersionRepository.saveComparison).toHaveBeenCalledWith(newComparison);
    });

    it('should throw error if version not found', async () => {
      const originalVersionId = 'version-1';
      const comparedVersionId = 'version-2';

      mockVersionRepository.getComparison.mockResolvedValue(null);
      mockVersionRepository.getVersionById
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await expect(
        versioningService.compareVersions(originalVersionId, comparedVersionId)
      ).rejects.toThrow('One or both versions not found');
    });
  });

  describe('rollbackToVersion', () => {
    it('should create new version based on target version', async () => {
      const documentId = 'doc-123';
      const targetVersionId = 'version-1';
      const filename = 'contract-rollback.pdf';

      const targetVersion: DocumentVersion = {
        id: targetVersionId,
        documentId,
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: { pageCount: 3, wordCount: 500, language: 'en', extractedText: 'Original text' },
      };

      const newVersion: DocumentVersion = {
        id: 'version-rollback',
        documentId,
        versionNumber: 3,
        filename,
        uploadedAt: new Date(),
        metadata: targetVersion.metadata,
        parentVersionId: targetVersionId,
      };

      mockVersionRepository.getVersionById.mockResolvedValue(targetVersion);
      mockVersionRepository.getNextVersionNumber.mockResolvedValue(3);
      mockVersionRepository.createVersion.mockResolvedValue(newVersion);

      const result = await versioningService.rollbackToVersion(documentId, targetVersionId, filename);

      expect(result.parentVersionId).toBe(targetVersionId);
      expect(result.metadata).toBe(targetVersion.metadata);
      expect(result.filename).toBe(filename);
    });

    it('should throw error if target version not found', async () => {
      const documentId = 'doc-123';
      const targetVersionId = 'version-nonexistent';
      const filename = 'contract-rollback.pdf';

      mockVersionRepository.getVersionById.mockResolvedValue(null);

      await expect(
        versioningService.rollbackToVersion(documentId, targetVersionId, filename)
      ).rejects.toThrow('Target version not found');
    });

    it('should throw error if version belongs to different document', async () => {
      const documentId = 'doc-123';
      const targetVersionId = 'version-1';
      const filename = 'contract-rollback.pdf';

      const targetVersion: DocumentVersion = {
        id: targetVersionId,
        documentId: 'doc-different',
        versionNumber: 1,
        filename: 'contract-v1.pdf',
        uploadedAt: new Date(),
        metadata: { pageCount: 3, wordCount: 500, language: 'en', extractedText: 'Original text' },
      };

      mockVersionRepository.getVersionById.mockResolvedValue(targetVersion);

      await expect(
        versioningService.rollbackToVersion(documentId, targetVersionId, filename)
      ).rejects.toThrow('Version does not belong to the specified document');
    });
  });

  describe('getVersionStatistics', () => {
    it('should calculate correct statistics', async () => {
      const documentId = 'doc-123';
      
      const versions: DocumentVersion[] = [
        {
          id: 'version-1',
          documentId,
          versionNumber: 1,
          filename: 'contract-v1.pdf',
          uploadedAt: new Date('2023-01-01'),
          metadata: { pageCount: 3, wordCount: 500, language: 'en', extractedText: 'Text 1' },
          analysis: { riskScore: 'low' } as DocumentAnalysis,
        },
        {
          id: 'version-2',
          documentId,
          versionNumber: 2,
          filename: 'contract-v2.pdf',
          uploadedAt: new Date('2023-01-02'),
          metadata: { pageCount: 4, wordCount: 600, language: 'en', extractedText: 'Text 2' },
          analysis: { riskScore: 'high' } as DocumentAnalysis,
        },
      ];

      mockVersionRepository.getVersionsByDocumentId.mockResolvedValue(versions);

      // Mock the getVersionDifferences method
      const mockDifferences = [
        {
          fromVersion: 1,
          toVersion: 2,
          fromVersionId: 'version-1',
          toVersionId: 'version-2',
          changesCount: 5,
          significantChangesCount: 2,
          overallImpact: 'unfavorable' as const,
          riskScoreChange: 2,
          comparedAt: new Date(),
        },
      ];

      // Mock the private method by spying on the service
      jest.spyOn(versioningService, 'getVersionDifferences').mockResolvedValue(mockDifferences);

      const result = await versioningService.getVersionStatistics(documentId);

      expect(result.documentId).toBe(documentId);
      expect(result.totalVersions).toBe(2);
      expect(result.totalChanges).toBe(5);
      expect(result.totalSignificantChanges).toBe(2);
      expect(result.riskTrend).toBe('increasing');
      expect(result.mostActiveVersion).toBe(2);
      expect(result.averageChangesPerVersion).toBe(5);
    });
  });

  describe('cleanupOldVersions', () => {
    it('should cleanup versions and comparisons older than retention period', async () => {
      const retentionDays = 30;
      const expectedCutoffDate = new Date();
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - retentionDays);

      mockVersionRepository.deleteVersionsOlderThan.mockResolvedValue(5);
      mockVersionRepository.deleteComparisonsOlderThan.mockResolvedValue(3);

      const result = await versioningService.cleanupOldVersions(retentionDays);

      expect(result.deletedVersions).toBe(5);
      expect(result.deletedComparisons).toBe(3);
      expect(result.cutoffDate.getDate()).toBe(expectedCutoffDate.getDate());
    });
  });
});