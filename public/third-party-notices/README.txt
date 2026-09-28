Tuveloz - third-party software notices

manifest.json preserves the original collection for the nine direct npm
dependencies listed in package.json. bundled-manifest.json adds the installed
package versions observed in a local production build. Both identify exact
versions, sources and SHA-256 hashes. Notice text is unmodified.

Eight notices come from the installed packages at the versions recorded in
package-lock.json. Drizzle ORM's notice comes from its official 0.45.2 release,
pinned to commit 273c78071d4841b497f5144734b38294df7ec64b.

The bundled collection reuses the existing direct notices where they match,
and stores additional notices in bundled/. Its build observation date and
source revision are recorded in bundled-manifest.json. Some observed modules
may be removed by tree shaking; inclusion is not proof that they run in a browser.

The embedded @hiogawa/utils@1.7.0 helper now includes the official MIT notice
added by its maintainer in response to issue #276. The bundled manifest records
that response, the exact source commit and the unmodified notice hash. This
supplements the original package archive, which had no license file.

This remains a scoped collection. No copyright text has been invented. The collection is not a complete review of embedded
components, deployment runtimes, trademarks, photos or media. It does not grant
a license to Tuveloz's own code, brand or third-party media.

When upgrading a dependency, preserve its current upstream notice and update
the version, source and hash here. Keep transitive-package and distribution
review in docs/records/code-ownership-and-contributors.md.
