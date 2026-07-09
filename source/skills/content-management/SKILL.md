---
name: content-management
description:
  Managing content in Acquia Source via source MCP tools including canvas pages,
  nodes, media, taxonomy terms, menus, vocabularies, and site settings. No CLI
  or JSON:API credentials needed.
---

# Content Management Skill

Manages content in Acquia Source using **source MCP tools** directly. Requires
the source MCP server to be connected.

---

## Discover Available Resources

Use these URIs with `ReadMcpResourceTool(server: "source-mcp", uri: "...")` to
discover what exists before creating or modifying content.

| URI                             | Returns                                           |
| ------------------------------- | ------------------------------------------------- |
| `drupal://content-types`        | Content types with schemas                        |
| `drupal://content-types/fields` | Shared field storage definitions                  |
| `drupal://field-types`          | Available field type plugin IDs                   |
| `drupal://filter-formats`       | Valid format values for body/text fields          |
| `drupal://vocabularies`         | Available taxonomy vocabularies                   |
| `drupal://media-types`          | Media type schemas                                |
| `drupal://menus`                | Menus list with `items_uri` for each              |
| `drupal://site-info`            | Site name and configured homepage                 |
| `canvas://components`           | Canvas components with `id`, `props`, and `slots` |
| `canvas://pages`                | Editable Canvas pages with live/draft metadata    |
| `canvas://auto-saves`           | Current auto-saved drafts for publish/discard     |
| `canvas://page-regions`         | Global regions (header, footer, etc.)             |

Or list existing entities of a type:

```
list_entities(entity_type: "node", bundle: "article")
list_entities(entity_type: "taxonomy_term", bundle: "tags")
list_entities(entity_type: "canvas_page")
```

---

## Content Nodes

### Create

```
create_node(bundle: "article", fields: {
  "title": "My Article",
  "body": { "value": "<p>HTML body</p>", "format": "basic_html" },
  "field_tags": [{ "target_id": 1 }],
  "status": true,
  "path": { "alias": "/my-article" }
})
```

Use `batch_create_nodes` to create multiple nodes of the same bundle at once.

### Update (partial)

```
update_node(entity_id: 42, fields: {
  "title": "Updated Title",
  "body": { "value": "<p>Updated body</p>", "format": "basic_html" }
})
```

---

## Content Types and Fields

### Create a content type

```
create_content_type(machine_name: "event", label: "Event", workflow: "editorial")
```

### Add fields

Prefer `batch_add_fields_to_content_type` over repeated single calls — all
fields are processed in order, so storage created by an earlier item can be
reused in a later item on a different bundle.

```
batch_add_fields_to_content_type(fields: [
  {
    content_type: "event",
    field_name: "event_date",
    field_type: "datetime",
    label: "Event Date",
    required: true
  },
  {
    content_type: "event",
    field_name: "location",
    field_type: "string",
    label: "Location"
  }
])
```

Single field:

```
add_field_to_content_type(
  content_type: "event",
  field_name: "sponsor_tier",
  field_type: "list_string",
  label: "Sponsor Tier",
  storage_settings: { "allowed_values": { "gold": "Gold", "silver": "Silver" } }
)
```

### Update an existing field config

Mutable: `label`, `description`, `required`, `default_value`, `cardinality`,
`field_settings`. For `list_string`/`list_integer`, also `allowed_values`.
Storage-level settings (e.g. `max_length`, `target_type`) cannot be changed.

```
update_field_config(
  content_type: "event",
  field_name: "sponsor_tier",
  label: "Sponsorship Level",
  cardinality: -1
)
```

---

## Taxonomy

### Create a vocabulary

```
create_vocabulary(vid: "sponsor_tier", name: "Sponsor Tier")
```

If the vocabulary already exists, returns existing metadata without creating a
duplicate.

### Get or create a term

```
get_or_create_term(vid: "tags", name: "Technology")
```

Returns the term ID whether it already existed or was just created.

---

## Menus

### Create a menu

```
create_menu(id: "footer-links", label: "Footer Links")
```

### Add menu items

```
create_menu_item(
  menu_name: "footer-links",
  title: "About Us",
  link: "internal:/about"
)
→ returns autosave_key

publish_auto_saves(autosaves: [{ autosave_key: "...", data_hash: "..." }])
```

Supported link formats: `internal:/path`, `https://example.com`,
`entity:node/1`, `route:route.name`.

### Nest a child item

```
create_menu_item(
  menu_name: "main",
  title: "Undergraduate",
  link: "internal:/academics/undergraduate",
  parent: "menu_link_content:uuid-of-parent"
)
```

### Update a menu item

```
update_menu_item(id: 42, title: "New Label", weight: -5, enabled: true)
```

### Delete a menu item

```
delete_menu_item(id: 42)                          // children re-parented
delete_menu_item(id: 42, delete_children: true)   // descendants also deleted
```

### Rename a menu

```
update_menu(id: "footer-links", label: "Footer Navigation")
```

---

## Media (Images)

### Upload

```
create_media(
  bundle: "image",
  name: "My Image",
  filename: "photo.jpg",
  metadata: { "alt": "Alt text description" }
)
```

After calling `create_media`, upload the file using the returned signed URL:

```bash
curl -X PUT <upload_url> -H "Content-Type: application/octet-stream" --data-binary @/path/to/photo.jpg
```

The returned `target_id` is the **media entity's internal ID** — use this in
component props that reference images.

### Media vs File Entity IDs (Critical)

| Entity Type | ID Location                            | Usage                      |
| ----------- | -------------------------------------- | -------------------------- |
| **File**    | `drupal_internal__target_id` in rels   | Internal file reference    |
| **Media**   | `target_id` returned by `create_media` | **Use this in components** |

Always use the **media entity's internal ID**, not the file's.

### Remote video

```
create_remote_video(bundle: "remote_video", url: "https://www.youtube.com/watch?v=...")
```

---

## Site Settings

### Update site name

```
update_site_settings(site_name: "My University")
```

Changes are staged — call `publish_auto_saves` with the returned `autosave_key`
to apply.

### Update site logo

```
update_site_logo(filename: "logo.png")
→ returns upload_url
```

Then upload the file:

```bash
curl -X PUT <upload_url> -H "Content-Type: application/octet-stream" --data-binary @/path/to/logo.png
```

The logo is immediately visible once uploaded.

---

## Canvas Pages

Canvas pages are layout containers that compose uploaded components. Use for:
homepage, section landing pages (e.g. /academics, /news), utility pages.

**Never use canvas pages as a substitute for missing structured content types.**

### Full creation workflow

**1. Create the page:**

```
create_canvas_page(title: "My Page", path: "/my-page")
→ returns page_id
```

**2. Add components (single):**

```
add_component_to_page(page_id: 5, component_id: "js.hero", props: {
  "heading": "Welcome",
  "subheading": "Subtitle text"
})
→ returns new_instance_id
```

**3. Add components in batch (preferred for multi-component pages):**

Use `@temp_id` aliases so parents and children can be added in one call:

```
batch_add_components_to_page(page_id: 5, components: [
  {
    temp_id: "@hero",
    component_id: "js.hero",
    props: { "heading": "Welcome" }
  },
  {
    component_id: "js.hero_button",
    parent_instance_id: "@hero",
    slot: "ctaButtons",
    props: { "label": "Learn More", "url": "/about" }
  }
])
```

Omit `index` on all items to append in order. Only set `index` for precise
insertion into an existing layout.

**4. Publish — two options:**

Option A — publish page directly (also commits all drafts):

```
publish_canvas_page(page_id: 5)
```

Option B — publish via auto-saves (use when you need `data_hash` control):

```
ReadMcpResourceTool(server: "source-mcp", uri: "canvas://auto-saves")
→ get autosave_key and data_hash

publish_auto_saves(autosaves: [{ autosave_key: "canvas_page:5:en", data_hash: "..." }])
```

### Set as homepage

```
set_homepage(page_id: 5)
→ then publish_auto_saves with returned autosave_key
```

### Preview without login

```
get_canvas_preview_signed_url(page_id: 5)
→ returns a URL valid for 5 minutes (shareable, no Drupal session required)
```

### Other page operations

| Goal                      | Tool                                                                    |
| ------------------------- | ----------------------------------------------------------------------- |
| Update component props    | `update_component_props(page_id, instance_id, props)`                   |
| Reorder a component       | `move_component(page_id, instance_id, parent_instance_id, slot, index)` |
| Remove a component        | `remove_component(page_id, instance_id)`                                |
| Read current layout       | `get_page_layout(page_id)`                                              |
| Set raw layout payload    | `set_page_layout(page_id, layout)`                                      |
| Update page title/path    | `update_canvas_page(page_id, title, path)`                              |
| Delete a page             | `delete_canvas_page(page_id, force: true)`                              |
| Discard unpublished draft | `discard_auto_saves(autosave_keys: ["canvas_page:<id>:en"])`            |

### Canvas component nesting

Components are nested via `parent_instance_id` and `slot`. Root-level components
have no parent. Slotted children reference the parent's `instance_id` and the
slot name from `canvas://components`.

---

## Global Regions (Header / Footer)

Global regions are shared chrome that appears across all pages. Manage them
separately from individual page layouts.

### Read current layout

```
ReadMcpResourceTool(server: "source-mcp", uri: "canvas://page-regions")
→ lists available region IDs (e.g. "astral.header", "astral.footer")

get_page_region_layout(region_id: "astral.header")
```

### Add a component to a region

```
add_component_to_page_region(
  region_id: "astral.header",
  component_id: "js.nav_bar",
  props: { "menuName": "main" }
)
```

### Replace a region's full layout

```
set_page_region_layout(region_id: "astral.footer", layout: { ... })
```

---

## Canvas Component Structure

When composing pages, the layout is a tree of component instances:

```
Hero (js.hero) — root
  └── ctaButtons slot
        └── Hero Button (js.hero_button)
Campus Life (js.campus_life) — root
  └── activities slot
        └── Campus Activity (js.campus_activity)
        └── Campus Activity (js.campus_activity)
```

Add in top-down order: create the parent first, get its `instance_id`, then
create children referencing it. Use `batch_add_components_to_page` with
`@temp_id` to do this in a single call.

---

## Text Fields with HTML

Rich text fields use a specific format:

```json
{
  "body": {
    "value": "<p>HTML content with <a href=\"/page\">links</a>.</p>",
    "format": "basic_html"
  }
}
```

Canvas HTML block format (for component props):

```json
{
  "value": "<p>Content</p>",
  "format": "canvas_html_block"
}
```

### Allowed HTML elements

**Inline:** `<strong>` `<em>` `<u>` `<s>` `<sup>` `<sub>` `<a>` `<code>`

**Block:** `<p>` `<h2>`–`<h6>` `<ul>` `<ol>` `<li>` `<blockquote>`

**Alignment classes:** `.text-align-center` `.text-align-right`
`.text-align-justify`

**Embedded media:**

```html
<drupal-media data-entity-type="media" data-entity-uuid="MEDIA-UUID"
  >&nbsp;</drupal-media
>
```

Use the media entity UUID (from `create_media` response), not the file UUID. The
`&nbsp;` placeholder inside the tag is required.

### Content formatting best practices

1. Use `<strong>` for important text, `<em>` for emphasis — semantic, not just
   visual styling.
2. `<blockquote>` for external quotes only. For regular inline quotes, use
   quotation marks inside a `<p>` tag.
3. Use `<ul>`/`<ol>` for lists rather than comma-separated text.
4. Use `<h2>`–`<h6>` to create clear content structure.

---

## Workflow: Create a Page with Images

1. **Upload image:**

   ```
   create_media(bundle: "image", name: "Card Image", filename: "card.jpg",
     metadata: { "alt": "Description" })
   → target_id: 31
   ```

   Then upload the file using the returned signed URL.

2. **Create the canvas page:**

   ```
   create_canvas_page(title: "My Page", path: "/my-page")
   → page_id: 5
   ```

3. **Add component with image reference:**

   ```
   add_component_to_page(page_id: 5, component_id: "js.impact_card", props: {
     "cardTitle": "My Card",
     "description": "Card text",
     "image": { "target_id": 31 }
   })
   ```

4. **Publish:**

   ```
   publish_canvas_page(page_id: 5)
   ```

---

## Source MCP Capabilities and Limitations

Always be explicit with the user about what can and cannot be automated.

### ✅ Handled automatically by source MCP

| Operation                           | Tool                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| Create content type                 | `create_content_type`                                                                |
| Add fields to content type          | `add_field_to_content_type` / `batch_add_fields_to_content_type`                     |
| Update field config                 | `update_field_config`                                                                |
| Create taxonomy vocabulary          | `create_vocabulary`                                                                  |
| Create taxonomy terms               | `get_or_create_term`                                                                 |
| Create content nodes                | `create_node` / `batch_create_nodes`                                                 |
| Upload media (images, video)        | `create_media` / `create_remote_video`                                               |
| Create and publish Canvas pages     | `create_canvas_page` / `publish_canvas_page`                                         |
| Manage global regions               | `get_page_region_layout` / `add_component_to_page_region` / `set_page_region_layout` |
| Create menus                        | `create_menu`                                                                        |
| Create / update / delete menu items | `create_menu_item` / `update_menu_item` / `delete_menu_item`                         |
| Update site name                    | `update_site_settings`                                                               |
| Update site logo                    | `update_site_logo`                                                                   |
| Set site homepage                   | `set_homepage`                                                                       |

### ⚠️ Requires manual action in Drupal

| Task                                | Drupal path                                     | When needed                                                              |
| ----------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| **Expose content type in JSON:API** | `/admin/config/services/jsonapi/resource_types` | If a new content type was created and is not yet accessible via JSON:API |

**Nav components (header, footer):** These include a static fallback array and
work immediately. Once the corresponding Drupal menu exists with the correct
machine name, they automatically switch to live Drupal-managed links — no code
change needed.
