router.post('/verify', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const deviceId = req.headers['x-device-id'];
  const { code } = req.body;

  const otp = await db.otp.findLatest(userId);

  if (!otp || otp.used || otp.code !== code) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  if (new Date() > otp.expires_at) {
    return res.status(400).json({ message: 'OTP expired' });
  }

  // ✅ mark used
  await db.otp.update(otp.id, { used: true });

  // ✅ TRUST DEVICE
  await db.devices.create({
    user_id: userId,
    device_id: deviceId,
    is_trusted: true,
  });

  return res.json({ success: true });
});