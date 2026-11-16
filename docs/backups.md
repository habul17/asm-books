# Backups

There are three ways the data is kept safe.

| What | When | Where it goes |
| --- | --- | --- |
| Nightly backup | Every night, 2 am India time | The owner's Google Drive, encrypted, newest 7 kept |
| Download from the app | Whenever the owner presses **Download backup** | The owner's computer (JSON, read-only copy) |
| `pnpm backup` | By hand on a computer with this code | `~/Documents/ASM Books backups` (full, restorable) |

## Nightly backup

`.github/workflows/nightly-backup.yml` takes a full `pg_dump`, checks it,
encrypts it with AES-256 using a passphrase, and uploads it to the folder
**ASM Books backups** in the owner's Google Drive. The newest 7 copies are
kept; older ones are deleted for good, so Drive does not fill up (each copy is a
few MB). The repository is public, so the file is never stored unencrypted and
is not kept on GitHub. The app's **Backups** page shows when it last ran, and
turns red if it misses two nights.

Drive access uses the `drive.file` scope: the job can only see the files it
created itself, never anything else in the owner's Drive.

### One-time setup

Run these on a computer with this folder, `rclone`, `jq` and `gh` installed.
Nothing secret is printed or saved in the code.

1. Database connection (the same `DATABASE_URL` as in `.env.local`), pasted
   when asked:

   ```sh
   gh secret set BACKUP_DATABASE_URL
   ```

2. A long passphrase you will not lose. Save it in your password manager:
   **without it the backups cannot be opened.**

   ```sh
   gh secret set BACKUP_PASSPHRASE
   ```

3. Connect the owner's Google Drive. A browser opens: sign in with **the
   owner's** Google account and press Allow. Then the token goes straight into
   GitHub and the local copy is removed:

   ```sh
   rclone config create asm-drive drive scope=drive.file
   rclone config dump | jq -r '."asm-drive".token' | gh secret set GDRIVE_TOKEN
   rclone config delete asm-drive
   ```

4. Start a first run to check it works:

   ```sh
   gh workflow run "Nightly backup"
   ```

   After a few minutes the file is in Drive and the Backups page shows the time.

If the owner changes their Google password or removes the access, repeat step 3.

### Restore from a nightly backup

1. In Google Drive open **ASM Books backups** and download the night you want
   (`asm-books-YYYY-MM-DD.dump.gpg`).
2. Decrypt it (asks for the passphrase):

   ```sh
   gpg --output asm-books.dump --decrypt asm-books-YYYY-MM-DD.dump.gpg
   ```

3. Create a new, empty database (for example a new Neon branch) and restore
   into it. The script refuses a database that already has tables:

   ```sh
   RESTORE_DATABASE_URL='<new empty database>' pnpm restore asm-books.dump
   ```

4. Check the data in the app pointed at the new database, then switch
   `DATABASE_URL` on Vercel to it. Delete the decrypted `.dump` file afterwards.
