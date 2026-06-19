import { FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID, FINANCE_PIPELINE_ADMISSION_ROUTE, FINANCE_PIPELINE_ADMISSION_SOURCE_REF, type FinancePipelineAdmissionDescriptor } from './finance-types.js';

export function financePipelineAdmissionDescriptor():
FinancePipelineAdmissionDescriptor {
  return Object.freeze({
    packFamily: 'finance',
    nativeSurface: 'finance-pipeline',
    route: FINANCE_PIPELINE_ADMISSION_ROUTE,
    entryPointId: FINANCE_PIPELINE_ADMISSION_ENTRY_POINT_ID,
    sourceRef: FINANCE_PIPELINE_ADMISSION_SOURCE_REF,
    nativeDecisionOrder: [
      'release.filingExport.decisionStatus',
      'decision',
    ] as const,
    hostedRouteBehavior: 'unchanged',
  });
}
