# Temporary publishing host

Meta's Graph API does not accept file uploads for Reels — it fetches the media
from a public HTTPS URL. These files sit here so `scripts/publish-social.py` has
something to point at:

    https://tuveloz.com/media/<file>

Do NOT put customer media here, and do not make the `tuveloz-uploads` R2 bucket
public as an alternative — that bucket holds customer uploads.

**Delete these once the posts are live.** Meta copies the file at publish time;
the URL only has to stay up during the API call. Leaving them here bloats every
deploy for no reason.

    git rm -r public/media && git commit -m "Remove published ad media"
