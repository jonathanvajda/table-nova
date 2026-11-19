# RDFleece Functional and RDF Mapping Specification

Status: Draft for approval  
Target: RDFleece page in the Table Nova application family  
JSON Schema dialect: Draft 2020-12

## 1. Purpose

RDFleece converts JSON documents and JSON Schemas into RDF artifacts. It follows
Table Nova's staging, preview, naming-preference, persistence, serialization, and
export patterns while adding a hierarchical JSON schema model.

RDFleece produces:

- an ABox containing RDF instance data derived from JSON values;
- an OWL 2/RDFS TBox containing inferred or supplied vocabulary;
- a combined TBox and ABox dataset;
- SHACL shapes derived from inferred constraints or JSON Schema;
- a hierarchical data dictionary; and
- a JSON Schema generated from the reviewed RDFleece schema model.

The words MUST, SHOULD, and MAY describe required, recommended, and optional
behavior in this specification.

## 2. Inputs and staging

RDFleece MUST accept `.json` files containing any valid JSON value. It MUST also
accept a JSON Schema as either a separately identified input or a file detected
as a schema through `$schema` and schema vocabulary keywords.

The page MUST reuse Table Nova's staging interaction. Preview MUST parse the
entire document for correctness and display a bounded, navigable tree rather
than attempting to render an unbounded document at once.

When both instance JSON and a JSON Schema are supplied, RDFleece MUST validate
that their root shapes are compatible. Validation findings MUST be presented
without silently modifying or discarding source data.

The root JSON value MAY be an object, array, scalar, or `null`. Root arrays and
root scalars MUST NOT require artificial wrapping in the source file.

## 3. Internal schema model and leaf-first inference

RDFleece MUST first parse JSON into a lossless tree that distinguishes:

- object nodes;
- array nodes;
- string, number, integer, and boolean scalar nodes;
- explicit JSON `null`; and
- an absent object key or absent array position.

Inference MUST proceed deterministically from leaves toward the root:

1. Classify every observed leaf by JSON value kind and compatible XSD datatype.
2. Classify every array from the union of its observed item shapes.
3. Classify every object from its key set and the inferred shape of each value.
4. Merge compatible object shapes at the same schema path.
5. Record conflicts as unions or mixed-value properties; do not resolve a
   conflict by discarding observations.
6. Derive requiredness only after all sampled objects of a shape are compared.
7. Construct the root schema after all descendants have stable shapes.

Inference MUST be independent of object key order. Reordering keys in equivalent
JSON MUST NOT change generated vocabulary IRIs, class IRIs, or constraint
semantics.

Every schema field MUST be able to record:

- JSON Pointer/schema path;
- original JSON key;
- user-facing label and description;
- value kind or union of kinds;
- inferred or selected XSD datatype;
- generated RDF predicate IRI;
- generated range class IRI, when applicable;
- required and nullable state;
- minimum and maximum cardinality;
- array item shape and whether order is preserved;
- examples, default, enumeration, pattern, format, and numeric/string bounds;
- whether the field was inferred, schema-supplied, or user-overridden.

## 4. Node identity generation

No resource IRI may be derived from the first key, first value, display label,
or another incidental value in an object. In particular, an object such as
`{"name":"Argo"}` MUST NOT receive an IRI such as `:Argo` unless a future,
explicit user-selected identity rule identifies `name` as a stable identifier.

RDFleece MUST follow Table Nova's path-style instance convention:

```text
{baseInstanceIri}{role}-{six-digit-ordinal}-{uuid}
```

The default roles are:

- `root` for the one resource representing the document root;
- `object` for a nested JSON object resource;
- `array` only when an array must be represented as an addressable/order-bearing
  resource; and
- `value` only when a scalar or `null` must be represented as a value node.

Example generated IRIs:

```text
https://example.org/RDFleece/instance/root-000001-550e8400-e29b-41d4-a716-446655440000
https://example.org/RDFleece/instance/object-000001-7f15a780-ccaa-4caf-a4d9-887817a17b90
```

The string `row` MUST NOT occur in RDFleece-generated instance identifiers.
Ordinals MUST be assigned by a documented depth-first traversal using source
array order and a canonical sort of object keys. UUIDs provide collision
resistance; ordinals provide readable run-local traceability. Reprocessing is
not required to reproduce UUIDs unless a future deterministic-ID option is
selected.

A root object is represented directly by the generated `root` resource. For a
root array or scalar, the generated `root` resource MUST stand for the source
document and link to its contents using the rules below.

## 5. RDF term resolution and IRI transformation

Before emitting a subject, predicate, or object term, RDFleece MUST determine
whether the candidate is already a usable RDF IRI. This check occurs before
local-name normalization so that an existing IRI is not accidentally rewritten
as though it were an ordinary JSON label.

RDFleece MUST distinguish:

- an absolute IRI, which can be used directly;
- a compact IRI whose prefix is defined in the active prefix registry, which can
  be expanded to an absolute IRI;
- a relative IRI reference, which can be resolved only when the user has
  selected an appropriate base IRI;
- text that can be transformed into a valid IRI under the rules below; and
- text that remains a literal and is not intended to identify an RDF resource.

Validation MUST be based on RDF 1.1-compatible IRI syntax, not merely on whether
a browser accepts a string as a URL. Supported schemes MUST include non-HTTP
IRIs such as `urn:`. Whitespace, invalid percent escapes, prohibited characters,
and unresolved compact-IRI prefixes MUST prevent a candidate from being treated
as an already-valid absolute IRI.

### 5.1 Subject candidates

Generated structural IRIs from Section 4 remain the default for root and nested
objects. RDFleece MUST NOT search arbitrary instance values and choose one as a
subject identifier merely because it resembles an IRI.

The user MAY designate a JSON field or JSON Schema annotation as an identity
source. For that field only, RDFleece MUST:

1. preserve a valid absolute IRI;
2. expand a recognized compact IRI;
3. resolve a relative IRI against the configured instance base when enabled;
4. otherwise offer deterministic transformation beneath the configured instance
   base; or
5. reject/fall back to a generated structural IRI according to the reviewed
   identity policy.

IRI transformation MUST NOT change the document root identity unless the user
has explicitly designated and approved the identity source. Duplicate identity
IRIs MUST be reported before generation.

### 5.2 Predicate candidates

For every JSON key used as an RDF predicate, RDFleece MUST apply this precedence:

1. an explicit user override;
2. a valid absolute IRI supplied as the key or by JSON Schema metadata;
3. a recognized compact IRI expanded through the active prefix registry; and
4. a generated IRI formed from the configured predicate base plus the key
   transformed according to Table Nova naming preferences.

An existing absolute or expanded compact IRI MUST be preserved by default and
MUST NOT receive a `has` prefix or case transformation. The review UI MUST allow
the user to replace it deliberately.

If a key is not already a usable IRI, transformation MUST tokenize and normalize
it, apply the selected casing and optional `has` prefix, remove or encode
characters that cannot occur in the chosen IRI construction, resolve collisions,
and validate the completed absolute IRI. An empty transformation result MUST be
reported and MUST require an override or a deterministic fallback local name.

### 5.3 Object/value candidates

Every scalar value MUST be checked for RDF-term intent as well as lexical form.
A valid absolute IRI or recognized compact IRI MAY become an RDF named-node
object. Because strings such as website addresses, identifiers, and prose URLs
can legitimately be literal data, IRI-shaped strings MUST remain reviewable and
the field MUST support three modes:

- `literal`: always emit a literal;
- `iri`: require or transform every non-null value into a named node; and
- `auto`: preserve values explicitly typed as IRIs by JSON Schema/RDFleece
  metadata and surface other IRI-shaped strings as inference suggestions.

`auto` MUST be the default. It MUST NOT silently convert an unannotated JSON
string to a named node solely because it begins with `http:` or another scheme.

When a field is reviewed as `iri`, RDFleece MUST preserve valid absolute IRIs,
expand recognized compact IRIs, optionally resolve relative IRIs against the
configured object base, and support deterministic transformation of other text
beneath that base. Failed transformations MUST produce validation errors; they
MUST NOT be emitted as malformed named nodes or silently coerced to unrelated
literals.

Transformation MUST retain the original lexical value and transformation rule
in run/schema provenance. At minimum, the UI MUST preview the original value,
resolved IRI, resolution category, and any collision or validation warning.

The same IRI-resolution service SHOULD be shared by subject, predicate, and
object processing so that prefix expansion, validation, percent encoding, base
resolution, diagnostics, and provenance are consistent.

## 6. Key-to-predicate behavior

Every JSON object key MUST normally generate or select a valid RDF property IRI.
The local name MUST be derived from the key using the same user preferences as
Table Nova, including:

- optional `has` prefix;
- `camelCase`, `PascalCase`, `snake_case`, or `SHOUT_CASE` styling;
- user-edited label and local-name overrides; and
- collision suffixing after normalization.

For example, the key `crew` produces `:hasCrew` only when `has` is enabled and
`camelCase` is selected. The same key could produce `:crew`, `:has_crew`, or a
user-supplied local name under other settings.

The original JSON key and JSON Pointer MUST be retained as schema metadata so
that normalization does not erase source provenance.

A key-derived property is typed as an `owl:DatatypeProperty` only when all
allowed non-null values are scalar literals. It is typed as an
`owl:ObjectProperty` only when all allowed non-null values are resources. If its
range permits both literals and resources, RDFleece MUST NOT assert that it is
exclusively either OWL property type. It MAY be declared `rdf:Property` and MUST
receive SHACL union constraints.

## 7. Missing values, explicit null, and generic properties

JSON absence and JSON `null` are different:

- An absent key produces no ABox triple and contributes to inferred
  requiredness/cardinality.
- An explicit `null` contributes to nullability inference.

RDF has no native literal corresponding exactly to JSON `null`. The default
mapping for explicit `null` MUST therefore omit the ordinary key-derived value
triple and emit a value node only when null preservation is enabled.

When null preservation is enabled, RDFleece MUST use its own vocabulary:

```turtle
:subject :hasMiddleName _:nullValue .
_:nullValue a rdfleece:JsonNull .
```

`rdfleece:hasJsonValue` is reserved for a source position that has no usable
key-derived predicate, such as the item of a root array, a standalone root
scalar, or a preserved anonymous/null value. It MUST NOT replace a valid
predicate derived from an object key.

For example:

```json
["Argo", null]
```

may produce:

```turtle
<.../root-000001-...> rdfleece:hasJsonValue "Argo", _:nullValue .
_:nullValue a rdfleece:JsonNull .
```

## 8. Nested objects

A nested object MUST become a generated RDF resource. Its parent MUST link to it
using the property derived from the containing JSON key.

```json
{"captain":{"name":"Jason"}}
```

with `has` and `camelCase` enabled maps conceptually to:

```turtle
<.../root-000001-...> :hasCaptain <.../object-000001-...> .
<.../object-000001-...> :hasName "Jason" .
```

RDFleece MAY assert a generated class for each stable object shape. The class
name MUST be derived from the containing key or an imported schema title, never
from an instance value. The root class MUST use a document/schema-derived name
or a neutral `JsonDocument` name and remain user-editable.

## 9. Arrays and mixed arrays

An array property uses the predicate derived from its containing key. Each item
is an additional value of that predicate unless ordered-array preservation is
enabled.

- Scalar-only array: repeated literal objects; the property is a datatype
  property when the scalar datatypes are compatible.
- Object-only array: repeated generated resource objects; the property is an
  object property.
- Empty array: no ABox value triples; its existence and item constraints remain
  available in schema metadata.
- Nested array: an addressable array node is created so the boundary is not
  lost.
- Mixed scalar/object array: repeated literal and resource objects of the same
  key-derived predicate. The property is an `rdf:Property`, not exclusively an
  OWL datatype or object property, and SHACL expresses the union.

A mixed array is an array whose items have incompatible JSON kinds, for example:

```json
{
  "crew": [
    {"name":"Atalanta"},
    "Orpheus",
    12,
    null
  ]
}
```

With `has` and `camelCase`, all non-null items use `:hasCrew`:

```turtle
<.../root-000001-...> :hasCrew <.../object-000001-...> ;
                       :hasCrew "Orpheus" ;
                       :hasCrew 12 .
<.../object-000001-...> :hasName "Atalanta" .
```

This is valid RDF even though OWL's exclusive datatype-property/object-property
distinction cannot describe it cleanly. RDFleece MUST warn about the mixed
range, preserve the observations, and offer the user three review actions:

1. retain a mixed `rdf:Property` with a SHACL union (default);
2. coerce compatible scalar items into generated value resources so the
   property becomes an object property; or
3. reject the input as violating the reviewed schema.

An array may contain an object, and that object may contain keyed members. The array's containing key determines the parent-to-item predicate; the object's own keys determine its outgoing predicates.

Array order is ignored by default. If preserve-order is enabled, RDFleece MUST
represent the array as a resource and use deterministic membership statements
carrying zero-based `rdfleece:index` values. It SHOULD NOT use `rdf:_1`,
`rdf:_2`, etc. unless offered as an alternate export profile.

## 10. TBox generation

The TBox MUST contain generated classes and properties that were approved in the
schema review. It MUST include labels, source-key/path annotations, domain where
stable, range where valid, and property typing consistent with Sections 6-9.

Scalar fields SHOULD become `owl:DatatypeProperty` declarations with XSD ranges.
Object fields SHOULD become `owl:ObjectProperty` declarations with generated or
schema-supplied class ranges. Mixed fields MUST avoid logically incorrect
exclusive typing.

OWL cardinality restrictions MAY be emitted as an optional strict ontology
profile. They MUST NOT be presented as closed-world validation. Requiredness,
closed shapes, patterns, and most operational constraints belong primarily in
SHACL.

The TBox MUST carry the same Table Nova-style ontology metadata used for
generated artifacts, adapted to identify RDFleece as the generator.

## 11. ABox generation

The ABox MUST contain generated root/nested resources, their `rdf:type` triples
when classes are available, key-derived property assertions, and any enabled
structural/null/order metadata.

Primitive JSON values map by default as follows:

| JSON kind | RDF literal default |
| --- | --- |
| string | `xsd:string` or inferred reviewed datatype |
| integer number | `xsd:integer` |
| non-integer finite number | `xsd:decimal` |
| boolean | `xsd:boolean` |
| null | omitted or `rdfleece:JsonNull` node |

Numbers MUST preserve a valid lexical form and MUST NOT silently become zero on
conversion failure. Source values that cannot satisfy a selected datatype MUST
produce a review/validation error.

The combined artifact MUST be the RDF dataset union of the TBox and ABox without
changing the meaning or identifiers of either independent artifact.

## 12. JSON Schema ingestion

RDFleece MUST target JSON Schema Draft 2020-12. It MUST resolve local JSON
Pointers and `$defs`. Remote `$ref` resolution MUST be disabled by default and
require explicit user action because it performs network access.

The initial supported mapping is:

| JSON Schema construct | RDFleece / SHACL / OWL treatment |
| --- | --- |
| `type` | value kind, XSD datatype, or class |
| `properties` | schema fields and RDF properties |
| `required` | `sh:minCount 1`; reviewed required flag |
| `minItems`, `maxItems` | SHACL cardinality |
| `enum`, `const` | `sh:in`; optional OWL enumeration |
| `pattern` | `sh:pattern` |
| `format` | annotation and supported datatype mapping |
| numeric/string bounds | corresponding SHACL constraints |
| `additionalProperties: false` | `sh:closed true` where representable |
| `title`, `description`, `default`, `examples` | schema/ontology annotations |
| `$ref`, `$defs` | reusable object shapes/classes |
| `allOf` | merged compatible constraints |
| `anyOf`, `oneOf`, type arrays | explicit union/alternative shapes |
| `if`, `then`, `else`, `not`, dependent keywords | preserved with a warning until a faithful mapping is implemented |

Unsupported constraints MUST be preserved in the internal schema metadata and
reported. They MUST NOT be silently treated as enforced OWL or SHACL semantics.

## 13. SHACL generation

RDFleece MUST generate SHACL independently from the OWL TBox. Shapes MUST use
the reviewed field model and SHOULD include `sh:path`, `sh:datatype` or
`sh:class`, cardinality, enumeration, pattern, bounds, and closed-shape behavior
where available.

Nullable means an explicit JSON `null` is allowed by the source/schema. It does
not mean the field is optional. Requiredness and nullability MUST be independent
controls. Because RDF omission cannot distinguish null from missing, validation
of preserved nulls MUST recognize `rdfleece:JsonNull`; when null preservation is
off, RDF-only SHACL validation cannot fully reproduce that distinction and the
UI MUST disclose this limitation.

## 14. Data dictionary and JSON Schema generation

The data dictionary MUST be hierarchical or path-addressed and contain at least:

- JSON Pointer/path and parent path;
- original key, display label, description, and examples;
- value kind, datatype, and array item kind;
- required and nullable flags;
- minimum and maximum cardinality;
- default, enum, pattern, format, and bounds;
- generated class and property IRIs; and
- inference/source status.

The dictionary SHOULD be exportable as CSV for interoperability even though its
rows describe hierarchical paths.

Generated JSON Schema MUST use Draft 2020-12 and MUST be produced from the same
reviewed schema model used for RDF. It MUST support nested `properties`, arrays,
`required`, nullable type unions, `$defs`/`$ref` for reused shapes, cardinality,
enums, patterns, formats, defaults, examples, and bounds when present.

RDFleece MUST make `required` and nullable editable separately. A property may
therefore be required and nullable, optional and non-nullable, required and
non-nullable, or optional and nullable.

## 15. User review and preferences

Before generation, users MUST be able to review the inferred/imported schema as
a tree and edit:

- class, property, and label names;
- namespace/base IRIs and prefixes;
- `has` prefix and casing preferences;
- datatype and object range;
- requiredness, nullability, and cardinality;
- array-order behavior;
- mixed-array resolution;
- null-preservation behavior; and
- subject, predicate, and object IRI resolution/transformation policies; and
- descriptions and JSON Schema constraints.

Preference changes MUST recompute only generated names and MUST preserve explicit
user overrides. Naming collisions MUST be shown and resolved deterministically.

## 16. Output artifacts

Each run MUST make the following independently downloadable where applicable:

1. OWL/RDFS TBox;
2. RDF ABox;
3. combined TBox and ABox;
4. SHACL shapes;
5. hierarchical data dictionary CSV; and
6. JSON Schema Draft 2020-12.

RDF outputs MUST use the serialization formats already supported by Table Nova,
including Turtle, TriG, N-Triples, N-Quads, and JSON-LD where valid for the
selected dataset scope.

## 17. Reuse and implementation boundaries

RDFleece SHOULD reuse Table Nova's browser file I/O, namespace registry,
identifier normalization, RDF serialization, ontology metadata, report export,
run storage, status/toast system, and page shell.

It MUST add source-specific modules for:

- lossless JSON parsing and tree traversal;
- JSON Schema detection, resolution, and mapping;
- hierarchical schema inference and merge;
- JSON-tree-to-RDF dataset construction;
- SHACL construction; and
- hierarchical schema review UI.

The shared implementation MUST include one RDF term/IRI resolution service used
by identity, predicate, and object mapping.

The tabular and JSON adapters SHOULD converge on shared artifact interfaces, but
RDFleece MUST NOT flatten JSON into a table as its canonical internal model.

## 18. Determinism and diagnostics

Given the same input, settings, and explicit overrides, RDFleece MUST generate
the same vocabulary IRIs, class structure, constraints, and traversal ordinals.
UUID-bearing instance IRIs are the documented exception unless deterministic ID
generation is enabled later.

RDFleece MUST report JSON syntax errors, schema resolution errors, incompatible
shape merges, invalid datatype coercions, normalized-name collisions,
unsupported JSON Schema constraints, and lossy choices such as ignored array
order. It MUST also report unresolved prefixes, invalid IRI candidates,
transformation collisions, and failed base resolution. It MUST NOT silently drop
a valid non-null source value.

## 19. Initial acceptance criteria

The first implementation is conformant when it can:

1. stage and preview object-, array-, scalar-, and null-root JSON;
2. infer a deterministic hierarchical schema from nested objects and arrays;
3. apply Table Nova naming preferences to key-derived properties;
4. generate structural IRIs without using instance values or the word `row`;
5. distinguish missing, null, scalar, object, and array observations;
6. handle homogeneous and mixed arrays according to Section 9;
7. ingest the supported JSON Schema subset and disclose unsupported constraints;
8. permit review of requiredness, nullability, datatype, cardinality, and names;
9. export TBox, ABox, combined RDF, SHACL, data dictionary, and JSON Schema; and
10. persist and restore a run without changing its reviewed schema or quads.

IRI acceptance additionally requires tests proving that RDFleece preserves
absolute IRIs, expands registered compact IRIs, does not silently convert
unannotated URL-looking strings in `auto` mode, transforms reviewed identifier
text beneath the correct base, and rejects invalid final named-node IRIs.

## 20. Locked decisions for approval

This draft proposes the following decisions corresponding to the ten design
areas identified before implementation:

1. **Node identity:** structural role + padded ordinal + UUID; never first value;
   never `row`.
2. **Key-to-predicate:** use Table Nova normalization/preferences and explicit
   overrides; retain original key/path metadata.
3. **Nested objects:** generated resources linked by the containing key's object
   property.
4. **Arrays:** repeated key-derived predicate by default; optional indexed array
   resources for order; union treatment for mixed items.
5. **Null versus missing:** track separately; missing emits nothing; null is
   omitted by default or preserved as `rdfleece:JsonNull`.
6. **Root arrays/scalars:** generated root document resource using
   `rdfleece:hasJsonValue`; no artificial source wrapper.
7. **OWL versus SHACL:** OWL/RDFS describes vocabulary; SHACL carries operational
   validation constraints.
8. **JSON Schema support:** Draft 2020-12 with the explicit supported/preserved
   mapping in Section 12.
9. **Dictionary/schema fields:** use the hierarchical field model in Sections 3
   and 14, including independent required and nullable controls.
10. **Outputs:** independently export TBox, ABox, combined RDF, SHACL, dictionary,
    and JSON Schema through shared Table Nova serializers and run storage.

The following cross-cutting decision is also proposed: **RDF term resolution**
checks subject, predicate, and object candidates before emission; preserves valid
IRIs, expands known compact IRIs, and supports reviewed deterministic
transformation without treating arbitrary URL-looking strings as resources.

