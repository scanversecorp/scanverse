-- Allow in-app offer + cancellation statuses on dispatch attempts

ALTER TABLE booking_dispatch_attempts DROP CONSTRAINT IF EXISTS booking_dispatch_attempts_status_check;
ALTER TABLE booking_dispatch_attempts ADD CONSTRAINT booking_dispatch_attempts_status_check
  CHECK (status IN (
    'pending','sent','delivered','failed','ringing',
    'answered','no_answer','busy','accepted','rejected','timeout',
    'offered','cancelled'
  ));
