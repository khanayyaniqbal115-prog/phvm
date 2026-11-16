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
// You can also set the environment variables PHOENIX_DISCORD_CLIENT_ID / PHOENIX_MS_CLIENT_ID.
module.exports = {
  DISCORD_CLIENT_ID: process.env.PHOENIX_DISCORD_CLIENT_ID || '1571845947309162577',
  MICROSOFT_CLIENT_ID: process.env.PHOENIX_MS_CLIENT_ID || '',
  DISCORD_LARGE_IMAGE_KEY: 'phoenix',
};
