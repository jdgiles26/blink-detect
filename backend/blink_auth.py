"""
Blink account authentication with 2FA support.

First-time setup (interactive — run once):
    python blink_auth.py

Saves credentials to DATA_DIR/blink_credentials.json.
All subsequent starts load from that file.
"""
import asyncio
import json
import logging
import aiohttp
from pathlib import Path
from blinkpy.blinkpy import Blink
from blinkpy.auth import Auth
from config import BLINK_EMAIL, BLINK_PASSWORD, CREDS_FILE

logger = logging.getLogger(__name__)


async def first_time_auth() -> None:
    """Interactive first-time auth. Creates the credentials JSON file."""
    email    = BLINK_EMAIL    or input("Blink email: ").strip()
    password = BLINK_PASSWORD or input("Blink password: ").strip()

    session = aiohttp.ClientSession()
    blink   = Blink(session=session)

    auth = Auth({"username": email, "password": password}, no_prompt=False)
    blink.auth = auth

    await blink.start()
    await blink.setup_login()

    code = input("Enter 2FA code from your email: ").strip()
    await blink.auth.send_auth_key(blink, code)
    await blink.setup_post_verify()

    # Persist the auth response
    CREDS_FILE.parent.mkdir(parents=True, exist_ok=True)
    creds = blink.auth.login_response or {}
    CREDS_FILE.write_text(json.dumps(creds, indent=2))

    logger.info(f"✓ Credentials saved → {CREDS_FILE}")
    print(f"\n✓ Done. Credentials saved to {CREDS_FILE}\n")

    await session.close()


async def load_auth() -> Auth:
    """Load persisted credentials. Raises FileNotFoundError if not yet set up."""
    if not CREDS_FILE.exists():
        raise FileNotFoundError(
            f"No credentials file at {CREDS_FILE}.\n"
            "Run:  python blink_auth.py\n"
            "Or set MOCK_MODE=true in .env to skip Blink auth."
        )
    creds = json.loads(CREDS_FILE.read_text())
    return Auth(creds, no_prompt=True)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(first_time_auth())
