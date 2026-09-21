# 491A Reference Documents

The team's approved 491A deliverables, kept here as the source of truth
for this repo's domain names and structure.

| File | What it is | Used for in this repo |
|---|---|---|
| [SRS.pdf](SRS.pdf) | Software Requirements Specification | Non-functional requirements in `docs/REQUIREMENTS.md` (5-second order creation, 100 concurrent orders, 10-minute session timeout, PostgreSQL/ACID); baseline for the deviations listed in `docs/ARCHITECTURE.md` |
| [UseCases.pdf](UseCases.pdf) | The 14 use cases, with actors | `docs/USE_CASES.md`; the frontend screen-to-use-case map in `frontend/README.md`; sprint scope |
| [ListofObjects.pdf](ListofObjects.pdf) | Every class and its attributes | Source of every table and column name in `backend/migrations/0001_schema.sql`; the camelCase-to-snake_case mapping in `docs/DATA_MODEL.md` |
| [ListofMethods.pdf](ListofMethods.pdf) | Every class method with parameters and return types | Function names and signatures in `backend/services/` and `docs/API_CONTRACT.md` (e.g. `CreateNewOrder`) |
| [ClassDiagram.pdf](ClassDiagram.pdf) | UML class diagram: classes, relationships, multiplicities | Foreign keys, constraints and cardinalities in `backend/migrations/0001_schema.sql` |
| [SequenceDiagrams.pdf](SequenceDiagrams.pdf) | Sequence diagrams for the main flows | The order of calls between screens, services and the database, as described in `docs/ARCHITECTURE.md` |

Every entity, field name, controller name, and screen name in this repo
traces back to these documents (see `docs/DATA_MODEL.md`'s
camelCase-to-snake_case mapping in particular). If a discrepancy shows up
between the code and these PDFs, the PDFs win — fix the code, or open a
discussion if the code intentionally diverged and the docs need updating.
