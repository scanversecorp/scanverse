/**
 * Vercel Cron fallback for daily @scanvapp Instagram post.
 * Schedule: 10:00 AM IST (04:30 UTC) — see vercel.json crons.
 *
 * Env (Vercel project settings):
 *   META_PAGE_ACCESS_TOKEN, META_IG_USER_ID (or META_PAGE_ID)
 *   CRON_SECRET — Vercel sends Authorization: Bearer <CRON_SECRET>
 *   ADMIN_HUB_PIN — optional, for admin dashboard caption override
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');

const exec = promisify(execFile);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const dryRun = req.query?.dry_run === 'true';
  const script = path.join(process.cwd(), 'scripts/instagram_daily_post.mjs');
  const args = dryRun ? ['--dry-run'] : [];

  try {
    const { stdout, stderr } = await exec('node', [script, ...args], {
      env: process.env,
      cwd: process.cwd(),
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    return res.status(200).json({
      ok: true,
      dry_run: dryRun,
      stdout: stdout.trim(),
      stderr: stderr.trim() || undefined,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: e.message,
      stdout: e.stdout?.trim(),
      stderr: e.stderr?.trim(),
    });
  }
};
