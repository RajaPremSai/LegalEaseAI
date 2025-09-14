import { pool } from '../database/connection';
import { TemplateRepository } from '../database/repositories/templateRepository';
import { DocumentTemplate } from '@legal-ai/shared';

const templateRepository = new TemplateRepository(pool);

const sampleTemplates: Omit<DocumentTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usage'>[] = [
  {
    name: 'Standard Service Agreement',
    description: 'A comprehensive service agreement template for professional services with customizable terms and industry-standard clauses.',
    category: 'contract',
    industry: ['Technology', 'Consulting', 'Legal Services'],
    jurisdiction: ['US', 'CA', 'UK'],
    templateContent: `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into on {{contract_date}} between {{client_name}} ("Client") and {{service_provider_name}} ("Service Provider").

1. SERVICES
Service Provider agrees to provide the following services: {{service_description}}

2. COMPENSATION
Client agrees to pay Service Provider {{payment_amount}} for the services described herein. Payment terms: {{payment_terms}}.

3. TERM
This Agreement shall commence on {{start_date}} and shall continue until {{end_date}}, unless terminated earlier in accordance with the terms herein.

4. TERMINATION
Either party may terminate this Agreement with {{termination_notice}} days written notice.

5. CONFIDENTIALITY
Both parties agree to maintain the confidentiality of any proprietary information shared during the course of this Agreement.

6. LIMITATION OF LIABILITY
Service Provider's liability shall not exceed the total amount paid under this Agreement.

7. GOVERNING LAW
This Agreement shall be governed by the laws of {{governing_jurisdiction}}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

Client: _________________________    Service Provider: _________________________
{{client_name}}                      {{service_provider_name}}
    `,
    annotations: [
      {
        id: '1',
        location: { startIndex: 200, endIndex: 250 },
        type: 'customization',
        title: 'Service Description',
        content: 'Clearly define the specific services to be provided. Be as detailed as possible to avoid misunderstandings.',
        importance: 'high'
      },
      {
        id: '2',
        location: { startIndex: 400, endIndex: 450 },
        type: 'warning',
        title: 'Payment Terms',
        content: 'Specify clear payment terms including due dates, late fees, and accepted payment methods.',
        importance: 'high'
      }
    ],
    standardClauses: [
      {
        id: '1',
        title: 'Limitation of Liability',
        content: 'Service Provider\'s liability shall not exceed the total amount paid under this Agreement.',
        category: 'liability',
        isRequired: true,
        alternatives: [
          {
            id: '1a',
            title: 'Standard Liability Cap',
            content: 'Service Provider\'s liability shall not exceed the total amount paid under this Agreement.',
            description: 'Limits liability to the contract value',
            favorability: 'neutral',
            useCase: 'Standard business services'
          },
          {
            id: '1b',
            title: 'Enhanced Liability Protection',
            content: 'Service Provider\'s liability shall not exceed $1,000 or the total amount paid under this Agreement, whichever is less.',
            description: 'Provides additional protection with a monetary cap',
            favorability: 'favorable',
            useCase: 'High-risk or complex services'
          }
        ],
        explanation: 'This clause limits the service provider\'s financial exposure in case of disputes or damages.',
        riskLevel: 'medium'
      }
    ],
    customizationOptions: [
      {
        id: '1',
        fieldName: 'contract_date',
        fieldType: 'date',
        label: 'Contract Date',
        description: 'The date when the contract is signed',
        required: true
      },
      {
        id: '2',
        fieldName: 'client_name',
        fieldType: 'text',
        label: 'Client Name',
        description: 'Full legal name of the client',
        required: true,
        validation: { minLength: 2, maxLength: 100 }
      },
      {
        id: '3',
        fieldName: 'service_provider_name',
        fieldType: 'text',
        label: 'Service Provider Name',
        description: 'Full legal name of the service provider',
        required: true,
        validation: { minLength: 2, maxLength: 100 }
      },
      {
        id: '4',
        fieldName: 'service_description',
        fieldType: 'text',
        label: 'Service Description',
        description: 'Detailed description of services to be provided',
        required: true,
        validation: { minLength: 10, maxLength: 1000 }
      },
      {
        id: '5',
        fieldName: 'payment_amount',
        fieldType: 'text',
        label: 'Payment Amount',
        description: 'Total payment amount (e.g., $5,000 or $100/hour)',
        required: true
      },
      {
        id: '6',
        fieldName: 'payment_terms',
        fieldType: 'select',
        label: 'Payment Terms',
        description: 'When payment is due',
        required: true,
        options: ['Net 30', 'Net 15', 'Due on receipt', 'Monthly', 'Upon completion'],
        defaultValue: 'Net 30'
      }
    ],
    version: '1.0',
    isActive: true
  },
  {
    name: 'Residential Lease Agreement',
    description: 'Standard residential lease agreement template with tenant and landlord protections, suitable for most jurisdictions.',
    category: 'lease',
    industry: ['Real Estate'],
    jurisdiction: ['US', 'CA'],
    templateContent: `
RESIDENTIAL LEASE AGREEMENT

This Lease Agreement is entered into on {{lease_date}} between {{landlord_name}} ("Landlord") and {{tenant_name}} ("Tenant").

1. PROPERTY
Landlord leases to Tenant the property located at: {{property_address}}

2. TERM
The lease term begins on {{start_date}} and ends on {{end_date}}.

3. RENT
Monthly rent is {{monthly_rent}}, due on the {{rent_due_date}} of each month.

4. SECURITY DEPOSIT
Tenant shall pay a security deposit of {{security_deposit}} prior to occupancy.

5. USE OF PREMISES
The premises shall be used solely as a private residence for Tenant and {{number_of_occupants}} occupants.

6. MAINTENANCE AND REPAIRS
Tenant is responsible for minor maintenance. Landlord is responsible for major repairs and structural issues.

7. PETS
{{pet_policy}}

8. TERMINATION
Either party may terminate this lease with {{termination_notice}} days written notice.

Landlord: _________________________    Tenant: _________________________
{{landlord_name}}                      {{tenant_name}}
    `,
    annotations: [
      {
        id: '1',
        location: { startIndex: 300, endIndex: 350 },
        type: 'explanation',
        title: 'Security Deposit',
        content: 'Security deposits are typically 1-2 months rent and must be returned within 30 days of lease termination, minus any damages.',
        importance: 'high'
      }
    ],
    standardClauses: [
      {
        id: '1',
        title: 'Maintenance and Repairs',
        content: 'Tenant is responsible for minor maintenance. Landlord is responsible for major repairs and structural issues.',
        category: 'other',
        isRequired: true,
        alternatives: [],
        explanation: 'Clearly defines maintenance responsibilities to avoid disputes.',
        riskLevel: 'low'
      }
    ],
    customizationOptions: [
      {
        id: '1',
        fieldName: 'lease_date',
        fieldType: 'date',
        label: 'Lease Date',
        description: 'Date the lease is signed',
        required: true
      },
      {
        id: '2',
        fieldName: 'landlord_name',
        fieldType: 'text',
        label: 'Landlord Name',
        description: 'Full name of the landlord',
        required: true
      },
      {
        id: '3',
        fieldName: 'tenant_name',
        fieldType: 'text',
        label: 'Tenant Name',
        description: 'Full name of the tenant',
        required: true
      },
      {
        id: '4',
        fieldName: 'property_address',
        fieldType: 'text',
        label: 'Property Address',
        description: 'Complete address of the rental property',
        required: true
      },
      {
        id: '5',
        fieldName: 'monthly_rent',
        fieldType: 'text',
        label: 'Monthly Rent',
        description: 'Monthly rent amount (e.g., $1,500)',
        required: true
      },
      {
        id: '6',
        fieldName: 'security_deposit',
        fieldType: 'text',
        label: 'Security Deposit',
        description: 'Security deposit amount',
        required: true
      },
      {
        id: '7',
        fieldName: 'pet_policy',
        fieldType: 'select',
        label: 'Pet Policy',
        description: 'Policy regarding pets',
        required: true,
        options: ['No pets allowed', 'Pets allowed with deposit', 'Cats only', 'Dogs only', 'All pets welcome'],
        defaultValue: 'No pets allowed'
      }
    ],
    version: '1.0',
    isActive: true
  },
  {
    name: 'Non-Disclosure Agreement (NDA)',
    description: 'Mutual non-disclosure agreement template for protecting confidential information in business discussions.',
    category: 'nda',
    industry: ['Technology', 'Finance', 'Healthcare', 'Consulting'],
    jurisdiction: ['US', 'CA', 'UK', 'EU'],
    templateContent: `
MUTUAL NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into on {{agreement_date}} between {{party1_name}} and {{party2_name}} (collectively, the "Parties").

1. PURPOSE
The Parties wish to explore {{business_purpose}} and may disclose confidential information to each other.

2. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by either Party, including but not limited to technical data, trade secrets, business plans, and financial information.

3. OBLIGATIONS
Each Party agrees to:
- Keep all Confidential Information strictly confidential
- Use Confidential Information solely for the Purpose stated above
- Not disclose Confidential Information to third parties without written consent

4. EXCEPTIONS
This Agreement does not apply to information that:
- Is publicly available
- Was known prior to disclosure
- Is independently developed
- Is required to be disclosed by law

5. TERM
This Agreement shall remain in effect for {{agreement_duration}} from the date of signing.

6. RETURN OF INFORMATION
Upon termination, each Party shall return or destroy all Confidential Information.

Party 1: _________________________    Party 2: _________________________
{{party1_name}}                       {{party2_name}}
    `,
    annotations: [
      {
        id: '1',
        location: { startIndex: 400, endIndex: 500 },
        type: 'explanation',
        title: 'Confidential Information Definition',
        content: 'This broad definition ensures comprehensive protection of sensitive business information.',
        importance: 'high'
      }
    ],
    standardClauses: [
      {
        id: '1',
        title: 'Return of Information',
        content: 'Upon termination, each Party shall return or destroy all Confidential Information.',
        category: 'confidentiality',
        isRequired: true,
        alternatives: [],
        explanation: 'Ensures confidential information is properly handled after the agreement ends.',
        riskLevel: 'low'
      }
    ],
    customizationOptions: [
      {
        id: '1',
        fieldName: 'agreement_date',
        fieldType: 'date',
        label: 'Agreement Date',
        description: 'Date the NDA is signed',
        required: true
      },
      {
        id: '2',
        fieldName: 'party1_name',
        fieldType: 'text',
        label: 'First Party Name',
        description: 'Name of the first party',
        required: true
      },
      {
        id: '3',
        fieldName: 'party2_name',
        fieldType: 'text',
        label: 'Second Party Name',
        description: 'Name of the second party',
        required: true
      },
      {
        id: '4',
        fieldName: 'business_purpose',
        fieldType: 'text',
        label: 'Business Purpose',
        description: 'Purpose of the confidential discussions',
        required: true
      },
      {
        id: '5',
        fieldName: 'agreement_duration',
        fieldType: 'select',
        label: 'Agreement Duration',
        description: 'How long the NDA remains in effect',
        required: true,
        options: ['1 year', '2 years', '3 years', '5 years', 'Indefinitely'],
        defaultValue: '2 years'
      }
    ],
    version: '1.0',
    isActive: true
  }
];

async function seedTemplates() {
  try {
    console.log('Starting template seeding...');
    
    for (const template of sampleTemplates) {
      try {
        const templateId = await templateRepository.createTemplate(template);
        console.log(`Created template: ${template.name} (ID: ${templateId})`);
      } catch (error) {
        console.error(`Failed to create template ${template.name}:`, error);
      }
    }
    
    console.log('Template seeding completed!');
  } catch (error) {
    console.error('Template seeding failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedTemplates();
}

export { seedTemplates };