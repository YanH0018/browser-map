# PRODUCT.md — What Browser Workspace Is Intended to Become

## Central premise

Browser tabs should not be represented only as a one-dimensional strip.
Tabs exist within a **spatial information workspace** where position
itself encodes information:

    Spatial location → meaning

Instead of searching a long tab list, the user remembers: *"the robotics
papers are over there."* The product uses spatial cognition as an
information-management mechanism.

## MVP (must already do real work)

- query currently open browser tabs;
- display tabs as visual cards (title, domain, URL, favicon);
- place/drag cards freely on a large 2D canvas;
- named clusters; move tabs between clusters;
- activate / close real browser tabs from the workspace;
- search and filter (title, URL, domain, cluster name);
- persist spatial arrangement and cluster metadata locally;
- sync reasonably with live browser-tab changes.

The workspace is a **full extension page**, not a toolbar popup.

## Spatial semantics (experimental, do not fix too early)

| Visual property | Possible meaning |
| --- | --- |
| Position | conceptual category or task |
| Distance | semantic similarity |
| Cluster | project or context |
| Size | importance or attention |
| Height/depth | recency or priority |
| Color | category or state |
| Connection | semantic/navigational relationship |

## Evolution path

2D canvas → automatic layout → semantic distance → hierarchical zoom →
2.5D → experimental 3D. AI enters the product only after the basic
interaction model is proven (embeddings → semantic clustering →
LLM cluster naming → spatial layout; natural-language commands such as
"group everything related to my thesis"). All of this can remain local.

## Long-term direction

If the concept proves useful, tabs become one class of object in a
broader **context-centric personal information environment** (papers,
notes, files, tasks, messages, datasets) organized by task, relationship,
and spatial meaning rather than application boundaries.

## Explicit non-goals for now

- No content scripts / no page injection (keeps permissions minimal).
- No AI features before M7.
- No 3D before M9.
- No Safari packaging before the MVP proves out on Chromium.
