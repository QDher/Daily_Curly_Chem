# Scene format and arrow rules (version 0.1.0)

Implemented by `src/arrows.js`, tested by `test/test_arrows.js`.

## Scene

```json
{
  "atoms": [{ "id": "O1", "el": "O", "q": -1, "h": 1, "x": 0, "y": 0 }],
  "bonds": [{ "id": "b1", "a": "C2", "b": "Br3", "order": 1 }]
}
```

| Field | Meaning |
|---|---|
| `id` | stable identifier (string); kept through every step, so an arrow can be shown in any view |
| `el`, `q` | element symbol, formal charge |
| `h` | implicit hydrogens (not drawn). A drawn hydrogen is an atom with `el` "H" |
| `x`, `y` (optional `z`) | coordinates; not used by the interpreter |
| `order` | 1, 2 or 3 (Kekulé form; no aromatic bond type) |

Lone pairs and vacant orbitals are not stored. They follow from the electron count:
nonbonding electrons = valence electrons − charge − implicit H − sum of bond orders.
Valence-shell limit: 2 for H; 8 for B, C, N, O, F; not checked for other elements.

Strokes, edits and 3D coordinates (plan, section B) are added to the scene by later work packages.

## Arrow

```json
{ "from": { "kind": "lp", "atom": "O1" }, "to": { "kind": "atom", "atom": "C2" } }
```

Two electrons per arrow. The atom that gives up its share of the pair gains +1, the atom that receives it gains −1.

| Source | Sink | Result |
|---|---|---|
| `lp` on A | `atom` B | new bond A–B, or one more bond order if A–B exists |
| `lp` on A | `bond` A–X (a bond of A) | one more bond order on A–X |
| `lp` on A | `pair` (A, B) | as `atom` B |
| `bond` X–Y | `atom` X or Y | heterolysis toward that atom |
| `bond` X–Y | `atom` Z with `via` X or Y | one bond order less on X–Y; new bond (or one more order) between `via` and Z |
| `bond` X–Y | `atom` Z without `via` | error `ambiguous`, options X and Y |
| `bond` X–Y | `bond` T sharing one atom S with X–Y | one order less on X–Y, one more on T |
| `bond` X–Y | `pair` (X or Y, Z) | as `atom` Z with `via` |

All arrows of an entry are applied together; the result is then checked.

| Error | Meaning |
|---|---|
| `no-lone-pair` | more arrows start on an atom than it has lone pairs |
| `bond-order` | more arrows start on a bond than its order; or a resulting order above 3 |
| `octet` | valence shell exceeded (e.g. an arrow ends on an sp3 carbon and no arrow breaks one of its bonds; a hydrogen with two bonds) |
| `electrons` | negative nonbonding electron count |
| `ambiguous` | bond to a distant atom without `via` |
| `sink-not-adjacent`, `self`, `unknown-atom`, `unknown-bond`, `bad-source`, `bad-sink` | malformed arrow |

The total charge is conserved by construction.

Hydrogens on carbon: an arrow never involves an implicit hydrogen (it is not an atom of the scene). `explicitH(scene,
atomId)` turns one implicit hydrogen into a drawn atom.

Not in this version: one-electron (radical) arrows, transition metals, stereochemistry, aromatic bond types.

## SMILES

`toSmiles(scene)` writes every atom in brackets with its hydrogens and charge (`[OH][CH3].[Br-]`). It is not
canonical; canonical SMILES and the comparison key come from RDKit and `chemkey.js` of the site repositories.
