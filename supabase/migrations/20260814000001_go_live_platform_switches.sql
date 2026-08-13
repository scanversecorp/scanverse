-- Go-live admin switches (toggle from Admin Hub → Go-Live tab)

INSERT INTO platform_settings (key, value, description)
VALUES
  (
    'otp_dev_mode',
    '0',
    'Dev bypass: OTP succeeds without SMS; relaxes payment webhook checks. MUST be off in production.'
  ),
  (
    'voice_otp_fallback',
    '1',
    'When SMS fails, call user with OTP via 2Factor voice. Turn off for SMS-only OTP.'
  ),
  (
    'dispatch_open',
    '0',
    'Allow booking-dispatch without DISPATCH_SECRET header. MUST be off in production.'
  )
ON CONFLICT (key) DO NOTHING;
