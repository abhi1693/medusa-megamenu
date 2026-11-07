# Preparing and publishing Mega Menu

The thin release callers use the [central npm workflows](https://github.com/abhi1693/actions/blob/062b31c1f58654d1793dce62907a2f41ea792ba3/docs/npm-release.md). Common packaging, checksums, provenance, draft assets, OIDC publication and exact registry-byte verification stay in actions.

1. Review the package/lockfile version and matching docs/releases/VERSION.md notes. Normal CI includes unit tests, a packed native HTTP/migration integration and the shared archive verifier.
2. After review and authorization, run **Prepare release** with that exact version. It creates a draft and verifies uploaded assets; it does not publish to npm.
3. Review and publish the approved draft using a maintainer session after its source belongs to master. The release event invokes **Publish to npm** using the prepared bytes.

Configure npm trusted publishing separately for owner abhi1693, repository medusa-megamenu, caller publish.yml, no environment, and direct npm publish allowed. No npm token is passed by these callers. Cross-repository OIDC publication is not proved by RBAC's successful release; this package needs its own authorized real publication.

Recovery is a manual publish.yml run from master with only the existing published tag. The shared workflow derives the original builder revision from that immutable tag and verifies signed provenance; no per-release SHA setting or tag movement is needed.

The package declares extra required archive files in config.release.requiredFiles. Keep the migration snapshot and discovered route checks there. scripts/copy-snapshots.mjs remains part of local/source builds because Medusa's compiler does not copy the hidden native JSON snapshot.
