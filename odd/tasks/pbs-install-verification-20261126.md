# PBS install verification on PVE 9.3, 2026-11-26

## Log

L1. Original request: "perfetto allo ascrivi con wayfinder un ticket issue apterto da risolvere in futuro" and later "Autorizza azioni esterne" for the open-ticket backlog.

L2. Read-only baseline: host `pve-aoostart0`, `pve-manager/9.3.1/4cbab754a7da645d`, kernel `7.0.14-30-pve`. CT 108 absent, `proxmox-backup-server` not installed, no PBS storage, `/mnt/pve/PBS-NFS` mounted from `192.168.87.24:/mnt/NAS/pbs` with 2.0T available.

L3. Blocker resolution: the pinned local community-script copy rejected PVE 9.3, but current official core `community-scripts/core/core.func` SHA-256 `029ae356225091f2f31873c9d3ec0a5dd2048e947668d71b71a35436973e7e1f` supports PVE 9.0 through 9.3. No bypass was applied.

L4. Installation: official `ct/proxmox-backup-server.sh` SHA-256 `4baf2a31c5987d56525fd714309b3c4babaa194540d46ec7c7f245981b67164c` was run with `mode=default`, `var_ctid=108`, current upstream core, and `var_unprivileged=0` after an initial unprivileged CT proved NFS UID mapping could not satisfy PBS chunk-store ownership. The first unprivileged CT 108 was stopped and destroyed before reinstall; configuration backup is `/tmp/pbs108-config.bak-20261126`. Install log: `/tmp/pbs-install-93-priv.log`.

L5. NFS export 14 on TrueNAS was temporarily changed during diagnosis and restored to `maproot_user=root`, `maproot_group=root`, `mapall_user=null`, `mapall_group=null`. Export snapshot: `/tmp/nfs-exports.bak-20261126.json`. Host fstab changed the PBS mount from `noatime` to `atime`; backup `/tmp/fstab.bak-20261126-pbs`.

L6. Verified after install: CT 108 running, hostname `pbs`, unprivileged absent from config (privileged CT), bind mount `mp0: /mnt/pve/PBS-NFS,mp=/mnt/pve/PBS-NFS`, `proxmox-backup-server 4.2.14-1 running version: 4.2.14`, `proxmox-backup.service` active, UI listening on port 8007, reported URL `https://192.168.87.28:8007`.

L7. Datastore `pbs-nfs` was created at `/mnt/pve/PBS-NFS/datastore` after switching the export back to root/root mapping, recreating CT 108 as a privileged container, and remounting with `atime`. Task `UPID:pbs:0000307B:0046398E:00000001:6B07B5DD:create-datastore:pbs\x2dnfs:root@pam:` ended `OK`; `Access time update check successful`; prune job `default-pbs-nfs-0cd24a49-9490-4c` created. `datastore show pbs-nfs` reports path `/mnt/pve/PBS-NFS/datastore` and `gc-schedule 03:00`; retention was requested as keep-daily=7, keep-weekly=4, keep-monthly=6.

L8. Proxmox storage `pbs-nfs` was added with server `192.168.87.28`, datastore `pbs-nfs`, auth id `root@pam!pvesm2`, and PBS SHA-256 fingerprint `67:99:22:74:B8:D9:A8:F5:ED:03:FC:C0:E9:00:28:90:C7:A4:59:72:79:BD:94:AB:F7:DA:DE:BE:0B:BD:2E:F7`. The token secret was written only to `/etc/pve/private/pbs-token` and is not recorded here. The unused first token `root@pam!pvesm` was deleted; only `root@pam!pvesm2` remains. `pvesm status --storage pbs-nfs` reports `active`, about 2.0 TiB total.

L9. Backup job `74335f1a-032a-4e28-b058-3c23aadbde9f` is enabled with schedule `02:00`, storage `pbs-nfs`, mode `snapshot`, compression `zstd`, `zstd 4`, prune-backups `keep-daily=7,keep-weekly=4,keep-monthly=6`, `repeat-missed 1`, and `exclude-path /var/lib/zot/*`. VMID list excludes LXC 112, LXC 128, VM 101 and the PBS CT 108; it includes CT 124 with the zot path excluded.

L10. Test backup: `vzdump 132 --storage pbs-nfs --mode snapshot --compress zstd` exited 0 with `Backup job finished successfully`. The snapshot is visible as `pbs-nfs:backup/ct/132/2026-11-26T05:28:33Z`; processed 10.333 GiB, uploaded 6.764 GiB, duration 235.45s. The temporary snapshot was removed. Non-blocking warnings: thin-pool protection is disabled and the summed thin volumes exceed the thin pool size.

L11. Residual external state: `/etc/fstab` PBS mount now uses `atime` instead of `noatime`; TrueNAS export 14 is restored to root/root mapping; old unprivileged CT 108 was destroyed after backup of `/tmp/pbs108-config.bak-20261126`; logs `/tmp/pbs-install-93.log` and `/tmp/pbs-install-93-priv.log` preserved. No repository data was rewritten by these external actions.
