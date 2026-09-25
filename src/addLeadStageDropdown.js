import { api } from './api.js';

// The Add Lead form already owns a proper React status <select> and defaults
// form.status to "cold". The employee form used to hide that select whenever
// the old CRM "Require Status" flag was off. Engage now always shows the stage
// dropdown, while keeping Cold as the untouched/default value.
const originalGetSettings = api.salesmanGetSettings;
if (typeof originalGetSettings === 'function' && !originalGetSettings.__engageStageDropdownWrapped) {
  const wrapped = async (...args) => {
    const response = await originalGetSettings(...args);
    return {
      ...response,
      leadSettings: {
        ...(response?.leadSettings || {}),
        requireStatus: true,
      },
    };
  };
  wrapped.__engageStageDropdownWrapped = true;
  api.salesmanGetSettings = wrapped;
}
