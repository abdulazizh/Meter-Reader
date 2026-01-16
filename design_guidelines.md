# Design Guidelines: Electricity Meter Reading App (Iraq)

## 1. Brand Identity

**Purpose**: Field application for electricity meter readers in Iraq to efficiently collect meter readings and photos during their daily routes.

**Aesthetic Direction**: **Structured & High-Contrast Professional**
- Clean, data-focused design with maximum readability in outdoor/variable lighting
- High contrast text and clear visual hierarchy for quick scanning
- Utilitarian efficiency over decoration
- Official/governmental aesthetic conveying trust and reliability

**Memorable Element**: Large, color-coded status indicators showing completion progress at a glance, making daily workflow tracking effortless.

## 2. Navigation Architecture

**Root Navigation**: Stack-only (single-purpose workflow app)

**Screens**:
1. **Meters List** - Main dashboard showing assigned meters for the reader
2. **Reading Entry** - Form to input new reading, capture photo, add notes
3. **Settings** - Basic preferences and reader profile

## 3. Screen Specifications

### 3.1 Meters List Screen
**Purpose**: Display all assigned meters for the reader with completion status

**Layout**:
- Header: Default navigation header (NON-transparent)
  - Title: "قراءات المشتركين" (Subscriber Readings)
  - Right button: Settings icon
  - Search bar below header
- Main content: ScrollView with FlatList of meter cards
- Top inset: Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**:
- Search bar (filter by account number, sequence, or meter number)
- Progress indicator showing "X/Y مكتملة" (X/Y completed)
- Meter card for each item showing:
  - Completion status badge (large, color-coded: green checkmark for done, gray outline for pending)
  - رقم الحساب (Account Number) - bold, large
  - التسلسل (Sequence: سجل/بلوك/عقار) - secondary text
  - رقم المقياس (Meter Number)
  - الصنف (Class)
  - القراءة السابقة (Previous Reading) + التاريخ (Date)
- Empty state: "لا يوجد مشتركين مخصصين" with illustration

### 3.2 Reading Entry Screen
**Purpose**: Input new meter reading, capture photo, and add notes

**Layout**:
- Header: Default navigation header (NON-transparent)
  - Title: رقم الحساب (Account Number)
  - Left button: Back arrow
  - Right button: "حفظ" (Save) - enabled only when reading and photo captured
- Main content: Scrollable form
- Top inset: Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**:
- Read-only info section (gray background card):
  - All meter details from list view
- Input section:
  - "القراءة الجديدة" (New Reading) - large numeric input field
  - "صورة المقياس" (Meter Photo) - camera button (large, prominent) or photo preview if taken
  - "ملاحظات" (Notes) - multiline text input (optional)
- Floating camera button (if no photo taken) with drop shadow

**Form submission**: Header "Save" button

### 3.3 Settings Screen
**Purpose**: Reader profile and app preferences

**Layout**:
- Header: Default navigation header (NON-transparent)
  - Title: "الإعدادات" (Settings)
  - Left button: Back arrow
- Main content: ScrollView with grouped sections
- Top inset: Spacing.xl
- Bottom inset: insets.bottom + Spacing.xl

**Components**:
- Profile section: Avatar (generated), display name field
- Preferences: Theme toggle, notification settings
- Data management: Export readings button

## 4. Color Palette

**Primary**: #1B5E20 (Dark Green - official/utility association)
**Primary Light**: #4CAF50 (Success green for completed items)
**Accent**: #FF6F00 (Orange - high visibility for actions)
**Background**: #F5F5F5 (Light gray)
**Surface**: #FFFFFF (White cards)
**Text Primary**: #212121 (Near black for maximum contrast)
**Text Secondary**: #757575 (Gray for metadata)
**Border**: #E0E0E0 (Light gray dividers)
**Error**: #D32F2F (Red for validation errors)
**Success**: #4CAF50 (Green for completed status)

## 5. Typography

**Primary Font**: Cairo (Google Font - excellent Arabic support, professional)
**Body Font**: Cairo (same for consistency)

**Type Scale**:
- Title: Cairo Bold, 24sp
- Header: Cairo SemiBold, 20sp
- Subheader: Cairo SemiBold, 16sp
- Body: Cairo Regular, 14sp
- Caption: Cairo Regular, 12sp
- Button: Cairo SemiBold, 16sp

## 6. Visual Design
- Use Feather icons from @expo/vector-icons for navigation and actions
- Meter cards: white surface with subtle border, NO drop shadow
- Camera button (floating): Drop shadow with shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
- Status badges: Solid fill (green or gray) with white icon/text, rounded corners
- All touchable elements: Press opacity feedback (0.7)
- RTL layout support throughout

## 7. Assets to Generate

**App Icon** (icon.png)
- Electric meter symbol in dark green circle with orange accent
- WHERE USED: Device home screen

**Splash Icon** (splash-icon.png)
- Simplified meter icon with app name in Arabic
- WHERE USED: App launch screen

**Empty Meters** (empty-meters.png)
- Illustration of clipboard with checkmarks
- Style: Simple line art in primary green color
- WHERE USED: Meters List screen when no assignments

**Avatar Preset** (avatar-reader.png)
- Generic reader profile icon
- Style: Circular badge with worker icon
- WHERE USED: Settings screen profile section

**Camera Placeholder** (camera-placeholder.png)
- Camera icon with dotted border indicating tap area
- Style: Minimal outline in accent orange
- WHERE USED: Reading Entry screen before photo captured