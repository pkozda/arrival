export { fetchUserContext, submitMutation, MutationClientError } from './client';
export type { MutationSubmitError, MutationSubmitResponse, MutationSubmitResult } from './client';
export {
  buildHeaderLanguageMutation,
  buildHeaderThemeMutation,
  generateMutationRequestId,
} from './request-builders';
export {
  mergeUserProfileIntoDefaults,
  userProfileToModulePrefill,
} from './user-profile-prefill';
