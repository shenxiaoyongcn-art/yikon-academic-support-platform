# Monogenic disease catalog

`monogenic-catalog.json` is generated from the Gene Curation Coalition (GenCC)
new-format CSV export with `scripts/build-monogenic-catalog.mjs`.

- Source: https://thegencc.org/download
- License: CC0 1.0
- Included relationships: Definitive, Strong, Moderate, and Limited
- Excluded: Disputed, Refuted, Animal Model Only, and No Known Disease Relationship
- Important: GenCC downloads do not include OMIM assertions because of OMIM licensing restrictions.

The data are a decision-support index, not a diagnostic database. Every selected
gene-disease relationship and variant must be reviewed by qualified genetics
professionals before clinical or PGT use.
