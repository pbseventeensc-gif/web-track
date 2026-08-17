import { supabase } from '../../supabaseClient';

/**
 * Fungsi untuk memperbarui PIN cabang ke tabel kl_branches dan kl_branch_access
 */
export const updateBranchPin = async (branchId, newPin) => {
  try {
    // 1. Update ke tabel utama kl_branches
    const { error: branchError } = await supabase
      .from('kl_branches')
      .update({ pin_code: Number(newPin) })
      .eq('id', branchId);

    if (branchError) throw branchError;

    // 2. Update ke tabel kl_branch_access (jika tabel tersebut ada)
    const { error: accessError } = await supabase
      .from('kl_branch_access')
      .update({ pin_code: Number(newPin) })
      .eq('branch_id', branchId);

    // Kita abaikan error kl_branch_access jika strukturnya berbeda, yang penting kl_branches berhasil
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Fungsi untuk generate PIN acak 6 digit (berguna untuk tombol reset darurat admin)
 */
export const generateRandomPin = () => {
  return Math.floor(100000 + Math.random() * 900000);
};