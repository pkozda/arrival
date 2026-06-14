import { InMemoryProfileStore, ProfileEngine } from '@arrivalos/profile';

export const profileStore = new InMemoryProfileStore();
export const profileEngine = new ProfileEngine(profileStore);
