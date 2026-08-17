-- Point live app links at custom domain getscanv.com

UPDATE scanv_social_config
SET app_link = 'https://getscanv.com', updated_at = NOW()
WHERE app_link IS DISTINCT FROM 'https://getscanv.com';

UPDATE scanv_social_content
SET caption = replace(caption, 'scanv-tau.vercel.app', 'getscanv.com'),
    updated_at = NOW()
WHERE caption LIKE '%scanv-tau.vercel.app%';
