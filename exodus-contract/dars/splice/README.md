# Splice Token Standard DARs (CIP-56, v1)

These are the official Canton Network Token Standard interface packages.
Exodus uses them so Canton wallets can see and send our tokens.

| File | Package ID |
|---|---|
| `splice-api-token-metadata-v1-1.0.0.dar` | `4ded6b668cb3b64f7a88a30874cd41c75829f5e064b3fbbadf41ec7e8363354f` |
| `splice-api-token-holding-v1-1.0.0.dar` | `718a0f77e505a8de22f188bd4c87fe74101274e9d4cb1bfac7d09aec7158d35b` |
| `splice-api-token-transfer-instruction-v1-1.0.0.dar` | `55ba4deb0ad4662c4168b39859738a0e91388d252286480c7331b3f71a517281` |

- **Source:** `splice-node/dars/` inside the Splice release bundle
  [v0.8.3 `0.8.3_splice-node.tar.gz`](https://github.com/digital-asset/decentralized-canton-sync/releases/tag/v0.8.3).
- **Daml source:** [canton-network/splice `token-standard/`](https://github.com/canton-network/splice/tree/main/token-standard).
- **License:** Apache-2.0 (Digital Asset).

## Why they are copied here

`dpm add dar` only installs DARs from an OCI registry, and these packages are
not published to the default `dpm` registry. So they are checked in and listed
under `data-dependencies` in `main/daml.yaml` and `test/daml.yaml`.

## Updating

Keep the pinned `1.0.0` versions. These interface packages are meant to be
stable forever (a breaking change would be a new `v2` package, not a new
version of `v1`). If you ever replace a file, make sure the package ID stays
the same (`dpm inspect-dar <file>`); otherwise wallets will not recognise our
contracts.
