import supabase from '../supabase.js';

export async function submitKyc(userId, payload) {
 // Identity has already been authenticated and resolved by Wanky Protect.
  // Do not trust or re-resolve client-supplied identity here.

  const fullName = payload.full_name ?? payload.fullName;
  const phone = payload.phone;
  const bvn = payload.bvn;
  const bankCode = payload.bank_code ?? payload.bankCode;
  const accountNumber = payload.account_number ?? payload.accountNumber;
  const accountName = payload.account_name ?? payload.accountName;

  // Step 1: Validate required fields

  // Step 2: Validate required fields
  if (
    !fullName ||
    !phone ||
    !bvn ||
    !bankCode ||
    !accountNumber ||
    !accountName
  ) {
    return {
      success: false,
      message: 'Missing required KYC fields.',
    };
  }

  // Step 3: Prepare the KYC data
  const kycData = {
    full_name: fullName,
    phone,
    bvn,
    bank_code: bankCode,
    account_number: accountNumber,
    account_name: accountName,
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
      message: 'KYC profile updated successfully.',
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
    message: 'KYC profile created successfully.',
    data,
  };
}

export async function getPendingKycs() {
  const { data, error } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function approveKyc(kycId) {
  const { data, error } = await supabase.rpc('approve_runner_kyc_atomic', {
    p_kyc_id: kycId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    message: 'KYC approved and runner access granted.',
    data,
  };
}

export async function rejectKyc(kycId, reason) {
  // Step 1: Find the KYC record (diagnostic-only: use .select() to inspect row counts)
  const { data: kycData, error: kycError } = await supabase
    .from("kyc_profiles")
    .select("id, user_id, status")
    .eq("id", kycId);

  const kycRowCount = Array.isArray(kycData) ? kycData.length : (kycData ? 1 : 0);
  console.log(`[rejectKyc][DB] query=kyc_lookup kycId=${kycId} userId=${kycRowCount===1 ? kycData[0].user_id : 'unknown'} rows=${kycRowCount} error=${kycError ? `${kycError.code || 'err'}:${kycError.message}` : 'none'}`);

  if (kycError) {
    throw new Error(kycError.message);
  }

  if (kycRowCount === 0) {
    throw new Error("KYC record not found.");
  }

  if (kycRowCount > 1) {
    throw new Error(`Unexpected multiple KYC records (${kycRowCount}) for id ${kycId}`);
  }

  const kyc = kycData[0];

  // Step 2: Find the associated profile (diagnostic-only: use .select() and enforce exactly one row)
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", kyc.user_id);

  const profileRowCount = Array.isArray(profileData) ? profileData.length : (profileData ? 1 : 0);
  console.log(`[rejectKyc][DB] query=profile_lookup kycId=${kycId} userId=${kyc.user_id} rows=${profileRowCount} error=${profileError ? `${profileError.code || 'err'}:${profileError.message}` : 'none'}`);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profileRowCount === 0) {
    throw new Error("User not found.");
  }

  if (profileRowCount > 1) {
    throw new Error(`Multiple profiles (${profileRowCount}) found for user ${kyc.user_id}`);
  }

  const profile = profileData[0];

  // Step 3: Only runners can have KYC rejected
  if (!["client", "runner"].includes(profile.role)) {
    return {
      success: false,
      message: "Only client or runner accounts can submit KYC for runner approval.",
    };
  }

  // Step 4: Only pending KYC can be rejected
  if (kyc.status !== "pending") {
    return {
      success: false,
      message: `Cannot reject a ${kyc.status} KYC submission.`,
    };
  }

  // Step 5: Reason is required
  if (!reason || !reason.trim()) {
    return {
      success: false,
      message: "Rejection reason is required.",
    };
  }

  // Step 6: Reject the KYC (diagnostic-only: inspect update row count)
  const { data: updatedKycData, error: updateError } = await supabase
    .from("kyc_profiles")
    .update({
      status: "rejected",
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", kycId)
    .select("id, user_id, status");

  const updateRowCount = Array.isArray(updatedKycData) ? updatedKycData.length : (updatedKycData ? 1 : 0);
  console.log(`[rejectKyc][DB] query=kyc_update kycId=${kycId} userId=${kyc.user_id} rows=${updateRowCount} error=${updateError ? `${updateError.code || 'err'}:${updateError.message}` : 'none'}`);

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (updateRowCount === 0) {
    throw new Error("Failed to update KYC (no rows returned).");
  }

  if (updateRowCount > 1) {
    throw new Error(`Unexpected multiple rows (${updateRowCount}) returned for KYC update id ${kycId}`);
  }

  const resultKyc = updatedKycData[0];

  // Return success
  return {
    success: true,
    message: "KYC rejected successfully.",
    data: resultKyc,
  };
}