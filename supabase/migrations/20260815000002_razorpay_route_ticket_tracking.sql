-- Track Razorpay support ticket for Route marketplace enablement (Admin Go-Live tab)

INSERT INTO platform_settings (key, value, description)
VALUES
  (
    'razorpay_route_ticket_id',
    '20389531',
    'Razorpay support ticket ID — Route enablement for ScanV (15% platform / 85% vendor)'
  ),
  (
    'razorpay_route_ticket_status',
    'open',
    'Razorpay Route ticket status: open | in_progress | resolved | closed'
  ),
  (
    'razorpay_route_ticket_subject',
    'Enable Razorpay Route for DCORE Global Corporation / ScanV marketplace',
    'Subject / summary of the Razorpay Route support request'
  ),
  (
    'razorpay_route_ticket_opened_at',
    '2026-08-14T23:30:00+05:30',
    'When the Razorpay Route support ticket was opened'
  ),
  (
    'razorpay_route_ticket_notes',
    'Requested Route for 15% platform commission and 85% vendor linked-account transfers on dispatch assign. Webhook active at razorpay-payment.',
    'Internal notes while tracking Razorpay Route activation'
  )
ON CONFLICT (key) DO NOTHING;
