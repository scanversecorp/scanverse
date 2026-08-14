#!/usr/bin/env node
import { isOutreachWindowOpen, outsideHoursMessage } from './lib/business-hours.mjs';

if (!isOutreachWindowOpen()) {
  console.error(outsideHoursMessage());
  process.exit(1);
}
