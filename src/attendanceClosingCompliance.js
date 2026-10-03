export function closingComplianceForDay({ hasSessions, statuses = [], requireClosing }) {
  if (!hasSessions) return { required: false, completed: false };

  const completed = statuses.some((status) => status === "submitted" || status === "skipped");
  const explicitlyNotRequired = statuses.includes("not_required");

  // Preserve historical evidence. A completed closing remains a required/completed
  // closing even if the employee's current policy is later switched off.
  if (completed) return { required: true, completed: true };

  // End Day records created while closing was disabled explicitly carry
  // not_required and must never be counted in the compliance denominator.
  if (explicitlyNotRequired) return { required: false, completed: false };

  // For an open day (or a legacy worked day without a closing record), the
  // current employee policy is the only authoritative requirement available.
  return { required: requireClosing === true, completed: false };
}
