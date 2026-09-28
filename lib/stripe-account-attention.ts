type AccountStatus = {
  readyToReceivePayments: boolean;
  requirementsStatus: string;
  requirements: readonly unknown[];
};

// Requirements can become due while transfers are still active. Keep the
// secure update action available before Stripe has to restrict the account.
export function stripeAccountNeedsAttention(status: AccountStatus) {
  return !status.readyToReceivePayments
    || status.requirementsStatus !== "none"
    || status.requirements.length > 0;
}
