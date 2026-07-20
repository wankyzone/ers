import supabase from '../supabase.js';

export async function submitKyc(userId, payload) {
  // Step 1: Verify the user exists
  const { data: user, error: userError } = await supabase
  .from('users')
  .select('id')
  .eq('id', userId)
  .single();

if (userError || !user) {
  return {
    success: false,
    message: 'User not found',
  };
}

  // Step 2: Validate required fields
  if (
    !payload.fullName ||
    !payload.phone ||
    !payload.bvn ||
    !payload.bankCode ||
    !payload.accountNumber ||
    !payload.accountName
  ) {
    return {
      success: false,
      message: 'Missing required KYC fields.',
    };
  }

  // Step 3: Prepare the KYC data
  const kycData = {
    full_name: payload.fullName,
    phone: payload.phone,
    bvn: payload.bvn,
    bank_code: payload.bankCode,
    account_number: payload.accountNumber,
    account_name: payload.accountName,
    status: 'pending',
  };

  // Step 4: Check if a KYC profile already exists
  const { data: existingKyc, error: kycError } = await supabase
    .from('kyc_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (kycError) {
    return {
      success: false,
      message: 'Failed to check existing KYC.',
    };
  }

  // Step 5: Apply business rules
  if (existingKyc) {
    if (existingKyc.status === 'approved') {
      return {
        success: false,
        message: 'KYC has already been approved and cannot be modified.',
      };
    }

    if (existingKyc.status === 'rejected') {
      return {
        success: false,
        message: 'KYC was rejected. Please contact support before resubmitting.',
      };
    }

    // Step 6A: Update existing pending KYC
    const { data, error } = await supabase
      .from('kyc_profiles')
      .update(kycData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        message: 'Failed to update KYC.',
      };
    }

    return {
      success: true,
      data,
    };
  }

  // Step 6B: Create a new KYC record
  const { data, error } = await supabase
    .from('kyc_profiles')
    .insert({
      user_id: userId,
      ...kycData,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      message: 'Failed to submit KYC.',
    };
  }

  return {
    success: true,
    data,
  };
}