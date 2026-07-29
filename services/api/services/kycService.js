import supabase from '../supabase.js';

export async function submitKyc(userId, payload) {
 // Identity has already been authenticated and resolved by Wanky Protect.
  // Do not trust or re-resolve client-supplied identity here.

  // Step 1: Validate required fields

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
  // Step 1: Find the KYC record
  const { data: kyc, error: kycError } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("id", kycId)
    .single();

  if (kycError) {
    throw new Error(kycError.message);
  }

  if (!kyc) {
    throw new Error("KYC record not found.");
  }

  // Step 2: Find the associated user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, role, kyc_verified")
    .eq("id", kyc.user_id)
    .single();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error("User not found.");
  }

  // Step 3: Only runners can be KYC verified
  if (user.role !== "runner") {
    return {
      success: false,
      message: "Only runner accounts can be KYC verified.",
    };
  }

  // Step 4: Only pending KYC can be approved
  if (kyc.status !== "pending") {
    return {
      success: false,
      message: `Cannot approve a ${kyc.status} KYC submission.`,
    };
  }

  // Step 5: Approve the KYC
  const { data: updatedKyc, error: updateError } = await supabase
    .from("kyc_profiles")
    .update({
      status: "approved",
    })
    .eq("id", kycId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Step 6: Mark the runner as verified
  console.log("Updating runner:", user.id);

const { data: updatedUser, error: runnerUpdateError } = await supabase
  .from("users")
  .update({
    kyc_verified: true,
  })
  .eq("id", user.id)
  .select()
  .single();

console.log("Updated user:", updatedUser);
console.log("Update error:", runnerUpdateError);

if (runnerUpdateError) {
  throw new Error(runnerUpdateError.message);
}

  // Step 7: Return success
  return {
    success: true,
    message: "KYC approved successfully.",
    data: updatedKyc,
  };
}

export async function rejectKyc(kycId, reason) {
  // Step 1: Find the KYC record
  const { data: kyc, error: kycError } = await supabase
    .from("kyc_profiles")
    .select("*")
    .eq("id", kycId)
    .single();

  if (kycError) {
    throw new Error(kycError.message);
  }

  if (!kyc) {
    throw new Error("KYC record not found.");
  }

  // Step 2: Find the associated user
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", kyc.user_id)
    .single();

  if (userError) {
    throw new Error(userError.message);
  }

  if (!user) {
    throw new Error("User not found.");
  }

  // Step 3: Only runners can have KYC rejected
  if (user.role !== "runner") {
    return {
      success: false,
      message: "Only runner accounts can be KYC reviewed.",
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

  // Step 6: Reject the KYC
  const { data: updatedKyc, error: updateError } = await supabase
    .from("kyc_profiles")
    .update({
      status: "rejected",
      rejection_reason: reason,
      rejected_at: new Date().toISOString(),
    })
    .eq("id", kycId)
    .select()
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Step 7: Ensure runner stays unverified
  await supabase
    .from("users")
    .update({
      kyc_verified: false,
    })
    .eq("id", user.id);

  // Step 8: Return success
  return {
    success: true,
    message: "KYC rejected successfully.",
    data: updatedKyc,
  };
}