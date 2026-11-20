// Phoenix Launcher settings you can edit.
//
// DISCORD_CLIENT_ID  -> shows "Playing Phoenix Launcher" in your Discord profile.
//   1. Open https://discord.com/developers/applications and click New Application.
//   2. Name it "Phoenix Launcher" (this is the name Discord shows).
//   3. Copy the Application ID and paste it below.
//   4. (Optional) Rich Presence > Art Assets: upload your logo with the key "phoenix".
//
// MICROSOFT_CLIENT_ID -> enables "Sign in with Microsoft".
//   Register an app in Azure (Microsoft Entra) as a "Mobile and desktop" public client,
//   allow personal Microsoft accounts, enable "Allow public client flows",
//   and request access to the Minecraft API at https://aka.ms/AppRegistration.
//   Paste the Application (client) ID below.
//
// CURSEFORGE_API_KEY -> enables searching and downloading worlds from CurseForge.
//   Get a free key at https://console.curseforge.com (API keys). Paste it below.
//
// GITHUB_REPO -> "owner/repo" used to check for launcher updates (GitHub Releases).
//
// You can also set the environment variables PHOENIX_DISCORD_CLIENT_ID / PHOENIX_MS_CLIENT_ID.
module.exports = {
  DISCORD_CLIENT_ID: process.env.PHOENIX_DISCORD_CLIENT_ID || '1571845947309162577',
  CURSEFORGE_API_KEY: process.env.PHOENIX_CURSEFORGE_KEY || '$2a$10$ZNd9uQR5EY/qDPlJwz0L..AGtOkSt06Eq979XiUfaq5vAZYnrKc4y',
  // Direct link to the built Phoenix Client jar (GitHub Release asset of the mod). Empty = do not install.
  PHOENIX_CLIENT_JAR_URL: process.env.PHOENIX_CLIENT_JAR_URL || '',
  PHOENIX_CLIENT_MC: '1.21.4',
  GITHUB_REPO: 'khanayyaniqbal115-prog/phvm',
  MICROSOFT_CLIENT_ID: process.env.PHOENIX_MS_CLIENT_ID || '',
  // Leave empty until you uploaded an art asset with this key (Rich Presence > Art Assets).
  DISCORD_LARGE_IMAGE_KEY: process.env.PHOENIX_DISCORD_IMAGE_KEY || '',
};
