export { fetchUserContext, submitMutation } from './client';
export type { MutationSubmitError, MutationSubmitResponse } from './client';
export {
  buildHeaderLanguageMutation,
  buildHeaderThemeMutation,
  generateMutationRequestId,
} from './request-builders';
export {
  mergeUserProfileIntoDefaults,
  userProfileToModulePrefill,
} from './user-profile-prefill';
