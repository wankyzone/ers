import {
  getAdminProfileForUser,
  updateAdminProfileForUser,
} from '../services/settingsService.js';

export async function getAdminProfile(req, res) {
  try {
    const profile = await getAdminProfileForUser(req.user.id);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('[settingsController] getAdminProfile error:', error);

    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load profile settings.',
    });
  }
}

export async function updateAdminProfile(req, res) {
  try {
    const profile = await updateAdminProfileForUser(req.user.id, req.body ?? {});

    return res.status(200).json({
      success: true,
      data: profile,
      message: 'Profile updated successfully.',
    });
  } catch (error) {
    console.error('[settingsController] updateAdminProfile error:', error);

    const status = error && error.status === 400 ? 400 : 500;

    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to update profile settings.',
    });
  }
}
