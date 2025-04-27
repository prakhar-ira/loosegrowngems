# TODO: Update Diamonds Collection Page (`/collections/diamonds`) to Match Figma Design

Based on comparison between `http://localhost:3000/collections/diamonds` and the Figma design ([link](https://www.figma.com/design/C57Qfwk8vFmln5awCTAmDH/Equal-AI-%3C%3E-IPL?node-id=82-103&t=19oUSaq0wcyGflZj-11)), the following changes are required in `app/components/collections/DiamondsCollection.tsx` and potentially `app/routes/($locale).collections.$handle.tsx` and CSS:

- [ ] **Filter Section (`DiamondsCollection.tsx`, `loader` in route, CSS)**
    - [x] **Layout:** Implement the detailed filter panel UI as shown in Figma (vertical column, `id: '82:128'`, padding 16px 24px 32px, 32px gap, white bg).
    - [ ] Make the filter section sticky/fixed with a defined height and internal scrolling (`position: sticky`, `height`, `overflow-y: auto`).
    - [x] **Filter Options (UI):**
        - [x] Add Natural/Lab-Grown toggle (`id: '82:130'`): Horizontal row in light gray border (`#E4E4E4`). Selected: Black bg (`#000000`), white text (`#FFFFFF`). Unselected: Gray text (`#999999`). Both 24px Helvetica Neue Regular.
        - [x] Add Shape filter (`id: '82:135'`): Section title "SHAPE" (black, 20px). Options in 4-column rows (`id: '82:138'`). Each item (`id: '82:139'` instance) has icon + text label (black, 16px), white bg, gray border (`#E4E4E4`). Include "MORE SHAPES" link (black, 20px + chevron).
        - [x] Implement Price range slider (`id: '82:153'`): Section title "PRICE" (black, 20px). Slider has black track (2px), gradient handles (`fill_II2G9U`, 2px black border). Min/max input fields (white bg, gray border `#D9D9D9`, black 20px text).
        - [x] Implement Carat range slider (`id: '82:167'`): Section title "CARAT" (black, 20px). Identical style to Price slider.
        - [x] Add Certification filter (`id: '82:181'`): Section title "CERTIFICATION" (black, 20px). Options (GIA/IGI) horizontal (`id: '82:183'`). Styled checkboxes implemented.
        - [x] Add Color filter (`id: '82:194'`): Section title "COLOR" (black, 20px). Sub-sections ("Colorless", "Near Colorless", gray 16px text). Checkboxes (D, E, F, G, H, I) in 3-column rows (`id: '82:198'`). Checkbox item style like Certification.
        - [x] Add Clarity filter (`id: '82:231'`): Section title "CLARITY" (black, 20px). Sub-sections ("Flawless", "Eye Clear", gray 16px text). Checkboxes (IF, FL, VVS1, VS2, VS1, VVS2) in 3-column rows (`id: '82:235'`). Checkbox item style like Certification.
        - [x] Add Cut filter (`id: '82:268'`): Section title "CUT" (black, 20px). Options (Ideal, Excellent, Very Good) horizontal (`id: '82:270'`). Checkbox item style like Certification.
        - [ ] Add "Advanced Filters" link/button (`id: '82:286'`): Centered row, black 20px text + chevron.
    - [ ] **Filter Logic (Implementation Plan):**
        -   **Overall Strategy:**
            1.  **Data Source:** Utilize `product.descriptionHtml` and `product.title`.
            2.  **Parsing:** Enhance `parseProductAttributesFromHtml` for all filterable attributes.
            3.  **State Management:** Use existing `filters` state.
            4.  **Filtering Logic:** Implement client-side filtering using `useMemo` on `displayedProducts`.
            5.  **Rendering:** Map over `filteredProducts`.
            6.  **Infinite Scroll:** Use `useFetcher` and `IntersectionObserver` to load more pages into `displayedProducts`.
        -   **Implementation Steps by Filter:**
            1.  **Diamond Type (Natural/Lab-Grown)**
                *   [x] Update `ParsedProductAttributes` type.
                *   [x] Update `parseProductAttributesFromHtml` to detect type.
                *   [x] Implement filtering logic in `useMemo`.
                *   [x] Ensure toggle updates state.
            2.  **Shape**
                *   [x] `ParsedProductAttributes` includes `shape`.
                *   [x] `parseProductAttributesFromHtml` parses `shape`.
                *   [x] `filters.shape` state and handler exist.
                *   [x] Implement filtering logic in `useMemo`.
            3.  **Price Range**
                *   [x] `filters.priceRange` state exists.
                *   [x] Input range updates `filters.priceRange[1]` (now uses `rc-slider` range mode).
                *   [x] Added Min/Max text inputs coupled with the slider.
                *   [x] Implement filtering logic in `useMemo`: Filter products where `product.priceRange.minVariantPrice.amount` is between `filters.priceRange[0]` and `filters.priceRange[1]`.
            4.  **Carat Range**
                *   [x] `ParsedProductAttributes` includes `carat`.
                *   [x] `parseProductAttributesFromHtml` parses `carat`.
                *   [x] `filters.caratRange` state exists.
                *   [x] Input range updates `filters.caratRange[1]` (now uses `rc-slider` range mode).
                *   [x] Added Min/Max text inputs coupled with the slider.
                *   [x] Implement filtering logic in `useMemo`: Parse `attributes.carat` to float. Filter products where parsed carat is between `filters.caratRange[0]` and `filters.caratRange[1]`. Handle errors.
            5.  **Color** (Requires UI first)
                *   [x] Add `color` filter UI elements.
                *   [x] Create `handleColorChange` for `filters.color` state.
                *   [x] `ParsedProductAttributes` includes `color`.
                *   [x] `parseProductAttributesFromHtml` parses `color`.
                *   [x] Implement filtering logic in `useMemo`.
            6.  **Clarity** (Requires UI first)
                *   [x] Add `clarity` filter UI elements.
                *   [x] Create `handleClarityChange` for `filters.clarity` state.
                *   [x] `ParsedProductAttributes` includes `clarity`.
                *   [x] `parseProductAttributesFromHtml` parses `clarity`.
                *   [x] Implement filtering logic in `useMemo`.
            7.  **Cut** (Requires UI first)
                *   [x] Add `cut` filter UI elements.
                *   [x] Create `handleCutChange` for `filters.cut` state.
                *   [x] `ParsedProductAttributes` includes `cut`.
                *   [x] `parseProductAttributesFromHtml` parses `cut`.
                *   [x] Implement filtering logic in `useMemo`.
            8.  **Certification** (Requires UI first)
                *   [x] Add `certification` filter UI elements.
                *   [x] Add `certification` to `FilterState` and create handler.
                *   [x] `ParsedProductAttributes` includes `certification`.
                *   [x] `parseProductAttributesFromHtml` parses `certification`.
                *   [x] Implement filtering logic in `useMemo`.
        -   **Refinement:**
            *   Consider performance (debouncing?).
            *   Improve parsing robustness.
            *   Add filtered item count `(filteredProducts.length)`. (Done, with '+' indicator).
    - [ ] **Data Fetching (`loader`):** Potentially fetch distinct values for shapes, colors, clarity, etc., to populate filters dynamically (deferred).
- [ ] **Product Grid (`DiamondsCollection.tsx`, CSS)**
    - [ ] **Layout:** Change grid from 4 columns to 3 columns.
    - [ ] **Sorting:** Add a sort dropdown (e.g., "Price: Low to High"). Implement sorting logic.
    - [ ] **Item Count:** Display the count of currently filtered items. (Done, uses `filteredProducts.length`).
- [ ] **Product Item Card (`ProductItem` in `DiamondsCollection.tsx`, `loader`, CSS)**
    - [x] **Data Handling & Attribute Extraction (`loader`, `ProductItem`, parser):**
        - [x] Modify `loader` to fetch `descriptionHtml`.
        - [x] Create `parseProductAttributesFromHtml` helper.
        - [x] Implement basic parsing logic.
        - [x] Call helper from `ProductItem`.
        - [ ] (**Deferred:** Fetch Nivoda Color/Clarity/Cut data and pass down).
    - [ ] **Layout:** Adjust card layout to match Figma (Partially done).
    - [x] **Attributes:** Display parsed attributes using `Tag`.
    - [x] **Certification Badge:** Add using `Tag` component variant.
    - [x] **Add to Cart:** Add button. Implement logic (Deferred).
- [ ] **Styling (CSS / Tailwind)**
    - [ ] Update CSS rules for the 3-column grid (`products-grid`).
    - [ ] Add styles for all new filter elements.