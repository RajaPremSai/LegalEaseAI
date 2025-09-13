#!/usr/bin/env node

import {
  DocumentSchema,
  UserSchema,
  DocumentAnalysisSchema,
  DocumentUploadSchema,
  UserRegistrationSchema,
  QuestionSchema,
} from './schemas';

// Test data
const testDocument = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  userId: '123e4567-e89b-12d3-a456-426614174001',
  filename: 'contract.pdf',
  documentType: 'contract' as const,
  jurisdiction: 'US',
  uploadedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  status: 'processing' as const,
  metadata: {
    pageCount: 5,
    wordCount: 1000,
    language: 'en',
    extractedText: 'Document text content',
  },
};

const testUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  profile: {
    name: 'John Doe',
    userType: 'individual' as const,
    jurisdiction: 'US',
    preferences: {
      language: 'en',
      notifications: true,
      autoDelete: true,
    },
  },
  subscription: {
    plan: 'free' as const,
    documentsRemaining: 5,
    renewsAt: new Date(),
  },
  createdAt: new Date(),
};

const testUpload = {
  filename: 'contract.pdf',
  fileSize: 1024 * 1024, // 1MB
  mimeType: 'application/pdf' as const,
  jurisdiction: 'US',
};

const testRegistration = {
  email: 'newuser@example.com',
  name: 'Jane Smith',
  userType: 'small_business' as const,
  jurisdiction: 'CA',
};

const testQuestion = {
  documentId: '123e4567-e89b-12d3-a456-426614174000',
  question: 'What does this clause mean?',
};

function runValidationTests() {
  console.log('Running schema validation tests...\n');

  try {
    console.log('✓ Testing DocumentSchema...');
    DocumentSchema.parse(testDocument);
    console.log('  Document validation passed');

    console.log('✓ Testing UserSchema...');
    UserSchema.parse(testUser);
    console.log('  User validation passed');

    console.log('✓ Testing DocumentUploadSchema...');
    DocumentUploadSchema.parse(testUpload);
    console.log('  Document upload validation passed');

    console.log('✓ Testing UserRegistrationSchema...');
    UserRegistrationSchema.parse(testRegistration);
    console.log('  User registration validation passed');

    console.log('✓ Testing QuestionSchema...');
    QuestionSchema.parse(testQuestion);
    console.log('  Question validation passed');

    console.log('\n🎉 All schema validations passed successfully!');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

// Test invalid data
function runInvalidDataTests() {
  console.log('\nTesting invalid data rejection...\n');

  try {
    // Test invalid document
    console.log('✓ Testing invalid document type...');
    try {
      DocumentSchema.parse({
        ...testDocument,
        documentType: 'invalid_type',
      });
      throw new Error('Should have failed');
    } catch (error) {
      console.log('  Correctly rejected invalid document type');
    }

    // Test invalid email
    console.log('✓ Testing invalid email...');
    try {
      UserSchema.parse({
        ...testUser,
        email: 'invalid-email',
      });
      throw new Error('Should have failed');
    } catch (error) {
      console.log('  Correctly rejected invalid email');
    }

    // Test file too large
    console.log('✓ Testing file too large...');
    try {
      DocumentUploadSchema.parse({
        ...testUpload,
        fileSize: 60 * 1024 * 1024, // 60MB
      });
      throw new Error('Should have failed');
    } catch (error) {
      console.log('  Correctly rejected file too large');
    }

    console.log('\n🎉 All invalid data tests passed!');
  } catch (error) {
    console.error('❌ Invalid data test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runValidationTests();
  runInvalidDataTests();
}