export const AUTH_ERROR_CODES = {
  invalidCredentials: 'INVALID_CREDENTIALS',
  emailNotVerified: 'EMAIL_NOT_VERIFIED',
  approvalPending: 'APPROVAL_PENDING',
  approvalRejected: 'APPROVAL_REJECTED',
  accountBlocked: 'ACCOUNT_BLOCKED',
  adminOnly: 'ADMIN_ONLY',
  ownerOnly: 'OWNER_ONLY',
} as const

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES]
