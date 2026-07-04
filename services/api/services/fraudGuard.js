const DAILY_LIMIT = 200000;
const SINGLE_LIMIT = 50000;
const NEW_USER_LIMIT = 20000;

async function checkWithdrawalLimits({ user, amount, supabase }) {
  // 1. KYC check
  if (!user.kyc_verified) {
    if (amount > NEW_USER_LIMIT) {
      throw new Error('KYC required for withdrawals above ₦20,000');
    }
  }

  // 2. Single transaction limit
  if (amount > SINGLE_LIMIT) {
    throw new Error('Max withdrawal per transaction is ₦50,000');
  }

  // 3. Daily limit
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .eq('type', 'withdraw')
    .gte('created_at', new Date().toISOString().split('T')[0]);

  const totalToday = data.reduce((sum, tx) => sum + tx.amount, 0);

  if (totalToday + amount > DAILY_LIMIT) {
    throw new Error('Daily withdrawal limit exceeded');
  }

  // 4. Velocity check
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', oneHourAgo);

  if (recent.length >= 3) {
    throw new Error('Too many withdrawals. Try again later.');
  }

  return true;
}

module.exports = { checkWithdrawalLimits };