# Continuous Delivery

Production releases are deliberately manual. A merge or push to `main` runs CI
but does not change the server. The owner starts `Production release` from the
GitHub Actions page and types `DEPLOY`.

GitHub Free does not provide protected environments, environment secrets or
required deployment reviewers for a private personal repository. Manual
`workflow_dispatch`, an exact-current-`main` check and a successful-CI check are
therefore the release gate. Repository Actions secrets are used only for the
dedicated restricted SSH key.

## Security boundary

The workflow never synchronizes the repository to `/opt/rassvet` and cannot
replace production `.env`, Compose files, Nginx, SSH, TLS, fail2ban or backup
configuration. It sends only two Docker images built from the current `main`
commit.

The `deploy` account:

- has no password, interactive shell access, Docker group membership or general
  sudo;
- is restricted by its `authorized_keys` forced command;
- can request only health/status, a validated release, or rollback to a retained
  revision;
- reaches Docker only through the root-owned `/usr/local/sbin/rassvet-release`;
- cannot supply Compose content, file paths, image names or arbitrary commands.

Every release is bounded in size, SHA-256 checked, required to contain images
whose OCI revision label matches the requested 40-character commit, serialized
with `flock`, and preceded by an encrypted restic backup. Backend and frontend
are replaced independently with `--no-deps`; PostgreSQL and Redis are not
recreated. Container health and the public HTTPS health endpoint must pass. On
failure, the previous images are restored automatically.

No release image is deleted automatically. This preserves rollback until an
explicit, separately reviewed retention procedure is introduced.

## One-time server preparation

Do not apply this until the Ansible diff has been reviewed and a fresh backup
and VNC recovery path are confirmed.

```bash
cd infrastructure/ansible
ansible-playbook site.yml --check --diff --tags deployment,application,backup \
  --ask-become-pass --private-key ~/.ssh/rassvet_key
```

The first real application should use the same tags. It installs new deployment
files and updates `rassvet.service`, but does not start a release or replace the
running containers. After applying, verify:

```bash
ssh -i ~/.ssh/rassvet_deploy_key deploy@157.22.193.21 status
ssh -i ~/.ssh/rassvet_key birdfromsky@157.22.193.21 \
  'sudo visudo -cf /etc/sudoers.d/rassvet-deploy && sudo systemctl cat rassvet.service'
```

## Repository secrets

Create exactly two repository-level Actions secrets. Do not use `.env`, a sudo
password, the administrative SSH key or any production application secret.

- `PRODUCTION_DEPLOY_SSH_KEY`: contents of the dedicated private key
  `~/.ssh/rassvet_deploy_key`.
- `PRODUCTION_SSH_KNOWN_HOSTS`: the already verified ED25519 host-key line for
  `157.22.193.21` from the local `known_hosts`. Do not generate this value with
  `ssh-keyscan` inside the workflow because that would trust the network at
  deployment time.

The private key must remain an ED25519 key dedicated to this server and account.
Enable two-factor authentication on the GitHub account before adding it.

## Release procedure

1. Merge the tested `develop` commit into `main`.
2. Wait for all `CI` jobs on that exact `main` commit to pass.
3. Open **Actions → Production release → Run workflow** on `main`.
4. Enter `DEPLOY` and start the workflow.
5. Confirm the final `status` step and UptimeRobot remain green.
6. Perform a short application smoke test as administrator without changing
   infrastructure.

The workflow refuses non-`main` refs, stale commits and commits without a
successful `CI` run.

## Rollback

Rollback remains a deliberate operator action. Use a revision that is present
under `/var/lib/rassvet-deploy/releases` and whose images are still stored by
Docker:

```bash
ssh -i ~/.ssh/rassvet_deploy_key deploy@157.22.193.21 \
  'rollback FULL_40_CHARACTER_COMMIT_SHA'
```

Rollback also creates an encrypted backup first. Database migrations are
forward-only, so application rollback is safe only while the selected previous
version remains compatible with the migrated schema. If compatibility is in
doubt, stop and use the documented database recovery procedure instead of
repeatedly switching versions.
