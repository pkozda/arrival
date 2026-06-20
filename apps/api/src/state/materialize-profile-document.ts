import type { PersistentFactFieldId } from '@arrival-atlas/product-contract';
import { PROFILE_SCHEMA_VERSION, type ProfileDocument } from '@arrival-atlas/profile';
import type { ProfileState } from '@arrival-atlas/profile-engine';

function assignNested(
  target: ProfileDocument,
  fieldId: PersistentFactFieldId,
  value: unknown
): void {
  switch (fieldId) {
    case 'countryOfOrigin':
      target.countryOfOrigin = String(value);
      break;
    case 'residencyStatus':
      target.residency = { ...target.residency, status: value as ProfileDocument['residency'] extends infer R ? R extends { status?: infer S } ? S : never : never };
      break;
    case 'arrivedAt':
      target.residency = { ...target.residency, arrivedAt: String(value) };
      break;
    case 'bundesland':
      target.location = { ...target.location, bundesland: String(value) };
      break;
    case 'city':
      target.location = { ...target.location, city: String(value) };
      break;
    case 'monthlyColdRent':
      target.housing = { ...target.housing, monthlyColdRent: Number(value) };
      break;
    case 'monthlyUtilities':
      target.housing = { ...target.housing, monthlyUtilities: Number(value) };
      break;
    case 'householdSize':
      target.household = { ...target.household, size: Number(value) };
      break;
    case 'maritalStatus':
      target.household = { ...target.household, maritalStatus: value as NonNullable<ProfileDocument['household']>['maritalStatus'] };
      break;
    case 'children':
      target.household = { ...target.household, children: value as NonNullable<ProfileDocument['household']>['children'] };
      break;
    case 'employmentStatus':
      target.employment = { ...target.employment, status: value as NonNullable<ProfileDocument['employment']>['status'] };
      break;
    case 'taxClass':
      target.employment = { ...target.employment, taxClass: Number(value) as NonNullable<ProfileDocument['employment']>['taxClass'] };
      break;
    case 'churchTax':
      target.employment = { ...target.employment, churchTax: Boolean(value) };
      break;
    case 'grossMonthlyIncome':
      target.employment = { ...target.employment, grossMonthlyIncome: Number(value) };
      break;
    case 'insuranceType':
      target.insurance = { ...target.insurance, type: value as NonNullable<ProfileDocument['insurance']>['type'] };
      break;
    case 'hasCoverage':
      target.insurance = { ...target.insurance, hasCoverage: Boolean(value) };
      break;
    case 'receivingBuergergeld':
      target.benefits = { ...target.benefits, receivingBuergergeld: Boolean(value) };
      break;
    case 'receivingAlg1':
      target.benefits = { ...target.benefits, receivingAlg1: Boolean(value) };
      break;
    case 'receivingWohngeld':
      target.benefits = { ...target.benefits, receivingWohngeld: Boolean(value) };
      break;
    case 'daysInGermany':
      target.benefits = { ...target.benefits, daysInGermany: Number(value) };
      break;
    case 'preferredLanguage':
      target.preferredLanguage = value as ProfileDocument['preferredLanguage'];
      break;
    case 'theme':
    case 'uiDensity':
      break;
    default:
      break;
  }
}

/** Materialized ProfileDocument cache derived from reduced ProfileState. */
export function materializeProfileDocumentFromState(profileState: ProfileState): ProfileDocument {
  const document: ProfileDocument = {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    preferredLanguage: 'en',
    extensions: {},
  };

  for (const [fieldId, entry] of Object.entries(profileState.fields)) {
    assignNested(document, fieldId as PersistentFactFieldId, entry?.value);
  }

  return document;
}
