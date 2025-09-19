# Elementor Template Format Research

## Elementor JSON Template Structure

### Core Template Properties
```json
{
  "version": "0.4",
  "title": "Template Name",
  "type": "page",
  "content": [],
  "page_settings": {},
  "metadata": {}
}
```

### Element Structure
Each element follows this pattern:
```json
{
  "id": "unique-id",
  "elType": "section|column|widget",
  "settings": {},
  "elements": [],
  "isInner": false
}
```

### Widget Types
- heading
- text-editor
- image
- button
- spacer
- divider
- video
- icon
- image-box
- icon-box
- gallery
- carousel
- image-carousel
- tabs
- accordion
- toggle
- social-icons
- testimonial
- counter
- progress
- countdown
- price-list
- price-table
- flip-box
- call-to-action
- form
- menu-anchor
- sidebar

### Settings Structure
```json
{
  "settings": {
    "background_background": "classic|gradient|video",
    "background_color": "#FFFFFF",
    "background_image": {
      "url": "",
      "id": ""
    },
    "padding": {
      "unit": "px",
      "top": "0",
      "right": "0",
      "bottom": "0",
      "left": "0"
    },
    "margin": {
      "unit": "px",
      "top": "0",
      "right": "0",
      "bottom": "0",
      "left": "0"
    },
    "typography_typography": "custom",
    "typography_font_family": "Arial",
    "typography_font_size": {
      "unit": "px",
      "size": 16
    },
    "typography_font_weight": "400",
    "typography_text_transform": "none",
    "typography_line_height": {
      "unit": "em",
      "size": 1.5
    }
  }
}
```

### Responsive Settings
```json
{
  "settings": {
    "property_desktop": "value",
    "property_tablet": "value",
    "property_mobile": "value"
  }
}
```

### Critical Requirements
1. Unique IDs for each element (8-character alphanumeric)
2. Proper nesting of sections > columns > widgets
3. Valid element types
4. Proper responsive breakpoints
5. Base64 encoded images or external URLs
6. Font declarations in page_settings
7. Color palette in page_settings