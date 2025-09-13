#!/usr/bin/env ts-node

/**
 * Risk Assessment Demo Script
 * 
 * This script demonstrates the risk assessment functionality
 * by analyzing sample legal documents and showing the results.
 */

import { RiskAssessmentService } from '../services/riskAssessment';
import { Clause } from '@legal-ai/shared';

async function demonstrateRiskAssessment() {
  const riskAssessmentService = new RiskAssessmentService();

  console.log('🔍 Legal Document Risk Assessment Demo\n');
  console.log('=' .repeat(60));

  // Demo 1: High-risk lease agreement
  console.log('\n📄 Demo 1: High-Risk Lease Agreement');
  console.log('-'.repeat(40));

  const highRiskLease = `
    RESIDENTIAL LEASE AGREEMENT

    1. JOINT LIABILITY: All tenants are jointly and severally liable for all 
       obligations under this lease, including the full amount of rent.

    2. INDEMNIFICATION: Tenant agrees to indemnify and hold harmless Landlord 
       from any and all claims, damages, or losses arising from tenant's use 
       of the premises, without limitation.

    3. AUTOMATIC RENEWAL: This lease automatically renews for successive 
       one-year terms unless either party provides written notice of 
       termination at least 90 days prior to expiration.

    4. LATE FEES: A late fee of $150 will be charged for rent payments 
       received after the 3rd day of the month.

    5. UNLIMITED LIABILITY: Tenant shall be liable for unlimited damages 
       in case of breach of this agreement.
  `;

  const leaseClauses: Clause[] = [
    {
      id: 'joint-liability',
      title: 'Joint and Several Liability',
      content: 'All tenants are jointly and severally liable for all obligations under this lease',
      location: { startIndex: 0, endIndex: 100 },
      riskLevel: 'high',
      explanation: 'Makes each tenant responsible for full rent amount'
    },
    {
      id: 'indemnification',
      title: 'Indemnification Clause',
      content: 'Tenant agrees to indemnify and hold harmless Landlord from any and all claims',
      location: { startIndex: 100, endIndex: 200 },
      riskLevel: 'high',
      explanation: 'Broad liability protection for landlord'
    }
  ];

  const leaseResult = await riskAssessmentService.assessDocumentRisks(
    highRiskLease,
    leaseClauses,
    'lease',
    'US'
  );

  console.log(`Overall Risk Score: ${leaseResult.overallRiskScore.toUpperCase()}`);
  console.log(`Number of Risks Identified: ${leaseResult.risks.length}`);
  console.log(`\nRisk Summary: ${leaseResult.riskSummary}`);
  
  console.log('\n🚨 Top Risks:');
  leaseResult.risks.slice(0, 3).forEach((risk, index) => {
    console.log(`${index + 1}. [${risk.severity.toUpperCase()}] ${risk.description}`);
    console.log(`   Category: ${risk.category}`);
    console.log(`   Recommendation: ${risk.recommendation}\n`);
  });

  console.log('💡 Recommendations:');
  leaseResult.recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`);
  });

  // Demo 2: Medium-risk loan agreement
  console.log('\n\n📄 Demo 2: Medium-Risk Loan Agreement');
  console.log('-'.repeat(40));

  const mediumRiskLoan = `
    PERSONAL LOAN AGREEMENT

    1. INTEREST RATE: This loan carries a variable interest rate that may 
       be adjusted quarterly based on the prime rate plus 2.5%.

    2. PREPAYMENT: Borrower may prepay this loan at any time, subject to 
       a prepayment penalty of 1% if paid within the first 12 months.

    3. DEFAULT: In case of default, borrower shall pay all collection costs 
       including reasonable attorney fees.

    4. GOVERNING LAW: This agreement shall be governed by the laws of the 
       State of California.
  `;

  const loanResult = await riskAssessmentService.assessDocumentRisks(
    mediumRiskLoan,
    [],
    'loan_agreement',
    'US'
  );

  console.log(`Overall Risk Score: ${loanResult.overallRiskScore.toUpperCase()}`);
  console.log(`Number of Risks Identified: ${loanResult.risks.length}`);
  console.log(`\nRisk Summary: ${loanResult.riskSummary}`);

  if (loanResult.risks.length > 0) {
    console.log('\n⚠️ Identified Risks:');
    loanResult.risks.forEach((risk, index) => {
      console.log(`${index + 1}. [${risk.severity.toUpperCase()}] ${risk.description}`);
    });
  }

  // Demo 3: Low-risk standard agreement
  console.log('\n\n📄 Demo 3: Low-Risk Standard Agreement');
  console.log('-'.repeat(40));

  const lowRiskContract = `
    SERVICE AGREEMENT

    1. SERVICES: Provider will deliver consulting services as described 
       in the attached Statement of Work.

    2. PAYMENT: Client will pay invoices within 30 days of receipt.

    3. TERMINATION: Either party may terminate this agreement with 
       30 days written notice.

    4. CONFIDENTIALITY: Both parties agree to maintain confidentiality 
       of proprietary information.

    5. DISPUTE RESOLUTION: Disputes will be resolved through good faith 
       negotiation, followed by mediation if necessary.
  `;

  const contractResult = await riskAssessmentService.assessDocumentRisks(
    lowRiskContract,
    [],
    'contract',
    'US'
  );

  console.log(`Overall Risk Score: ${contractResult.overallRiskScore.toUpperCase()}`);
  console.log(`Number of Risks Identified: ${contractResult.risks.length}`);
  console.log(`\nRisk Summary: ${contractResult.riskSummary}`);

  if (contractResult.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    contractResult.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });
  }

  // Demo 4: Privacy policy analysis
  console.log('\n\n📄 Demo 4: Privacy Policy Analysis');
  console.log('-'.repeat(40));

  const privacyPolicy = `
    PRIVACY POLICY

    1. DATA COLLECTION: We collect personal information including your name, 
       email address, location data, and browsing behavior.

    2. DATA SHARING: We may share your personal information with third parties 
       including our business partners and advertising networks.

    3. DATA RETENTION: We retain your personal information indefinitely 
       unless you request deletion.

    4. POLICY CHANGES: We may update this privacy policy at any time 
       without prior notice to users.
  `;

  const privacyResult = await riskAssessmentService.assessDocumentRisks(
    privacyPolicy,
    [],
    'privacy_policy',
    'US'
  );

  console.log(`Overall Risk Score: ${privacyResult.overallRiskScore.toUpperCase()}`);
  console.log(`Number of Risks Identified: ${privacyResult.risks.length}`);
  console.log(`\nRisk Summary: ${privacyResult.riskSummary}`);

  if (privacyResult.risks.length > 0) {
    console.log('\n🔒 Privacy Risks:');
    privacyResult.risks.filter(r => r.category === 'privacy').forEach((risk, index) => {
      console.log(`${index + 1}. [${risk.severity.toUpperCase()}] ${risk.description}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Risk Assessment Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Pattern-based risk detection');
  console.log('• Document-type specific analysis');
  console.log('• Risk scoring algorithm (Low/Medium/High)');
  console.log('• Contextual recommendations');
  console.log('• Multi-category risk assessment');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateRiskAssessment().catch(console.error);
}

export { demonstrateRiskAssessment };