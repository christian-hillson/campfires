Toggle the Campfires share mode. Read the current mode from ~/.campfires/config.json, cycle to the next mode (full → heartbeat → off → full), write it back, and confirm the change.

Display what each mode means:

- **full**: Your presence AND session transcripts are streamed to your team in real-time. AI summaries of your work appear on Campfire Stories as you work, not just when you're done.
- **heartbeat**: Only your presence is shared (online/offline status). No transcripts, no activity details.
- **off**: Fully dark. Nothing is sent to the server. You're invisible on the campfire.

Use jq to update the config file in place. After writing, restore permissions with `chmod 600 ~/.campfires/config.json`. Show the old mode → new mode transition clearly.
